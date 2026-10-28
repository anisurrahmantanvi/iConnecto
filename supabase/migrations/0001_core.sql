-- iConnecto 0001: core objects (profiles, blocks, communities, posts)
-- Idempotent and non-destructive: creates missing objects, adds missing columns, never drops tables or data.
-- Run inspect_schema.sql first. If your existing tables use different column names, adapt before running.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Adds a constraint only if it does not exist yet (use "not valid" in p_def to spare legacy rows).
create or replace function public._ic_add_constraint(p_table regclass, p_name text, p_def text) returns void
language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conname = p_name and conrelid = p_table) then
    execute format('alter table %s add constraint %I %s', p_table, p_name, p_def);
  end if;
end $$;
revoke all on function public._ic_add_constraint(regclass, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists followers_count integer not null default 0;
alter table public.profiles add column if not exists following_count integer not null default 0;
alter table public.profiles add column if not exists posts_count integer not null default 0;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Fails if legacy data already has case-insensitive duplicate usernames; fix those rows first.
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
create index if not exists profiles_username_trgm on public.profiles using gin (lower(username) extensions.gin_trgm_ops);
create index if not exists profiles_display_name_trgm on public.profiles using gin (lower(display_name) extensions.gin_trgm_ops);

select public._ic_add_constraint('public.profiles', 'profiles_username_format',
  $$check (username ~ '^[A-Za-z0-9_]{3,20}$') not valid$$);
select public._ic_add_constraint('public.profiles', 'profiles_bio_length',
  $$check (bio is null or char_length(bio) <= 300) not valid$$);
select public._ic_add_constraint('public.profiles', 'profiles_display_name_length',
  $$check (display_name is null or char_length(display_name) between 1 and 50) not valid$$);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

-- Generates a unique, valid username from a seed.
create or replace function public.make_username(p_seed text, p_uid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n integer := 0;
begin
  base := lower(regexp_replace(coalesce(p_seed, ''), '[^A-Za-z0-9_]', '', 'g'));
  if length(base) < 3 then
    base := 'user' || substr(replace(p_uid::text, '-', ''), 1, 6);
  end if;
  base := left(base, 16);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  return candidate;
end $$;
revoke all on function public.make_username(text, uuid) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text;
begin
  uname := public.make_username(
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.id
  );
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), uname))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Fallback used by the client when a signed-in user has no profile row (older accounts, failed trigger).
create or replace function public.ensure_my_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  u auth.users;
  p public.profiles;
  uname text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = uid;
  if found then
    return p;
  end if;
  select * into u from auth.users where id = uid;
  uname := public.make_username(
    coalesce(nullif(u.raw_user_meta_data ->> 'username', ''), split_part(coalesce(u.email, ''), '@', 1)),
    uid
  );
  insert into public.profiles (id, username, display_name)
  values (uid, uname, coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), uname))
  on conflict (id) do nothing;
  select * into p from public.profiles where id = uid;
  return p;
end $$;

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- ---------------------------------------------------------------------------
-- blocks (needed early: other policies call is_blocked_between)
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks add column if not exists created_at timestamptz not null default now();
select public._ic_add_constraint('public.blocks', 'blocks_not_self', $$check (blocker_id <> blocked_id) not valid$$);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  avatar_url text,
  is_private boolean not null default false,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  member_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.communities add column if not exists name text;
alter table public.communities add column if not exists slug text;
alter table public.communities add column if not exists description text;
alter table public.communities add column if not exists avatar_url text;
alter table public.communities add column if not exists is_private boolean not null default false;
alter table public.communities add column if not exists owner_id uuid default auth.uid();
alter table public.communities add column if not exists member_count integer not null default 0;
alter table public.communities add column if not exists created_at timestamptz not null default now();
create unique index if not exists communities_slug_lower_key on public.communities (lower(slug));
create index if not exists communities_name_trgm on public.communities using gin (lower(name) extensions.gin_trgm_ops);
select public._ic_add_constraint('public.communities', 'communities_slug_format',
  $$check (slug ~ '^[a-z0-9-]{3,40}$') not valid$$);
select public._ic_add_constraint('public.communities', 'communities_name_length',
  $$check (char_length(name) between 2 and 60) not valid$$);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
alter table public.community_members add column if not exists role text not null default 'member';
alter table public.community_members add column if not exists joined_at timestamptz not null default now();
select public._ic_add_constraint('public.community_members', 'community_members_role_check',
  $$check (role in ('owner','moderator','member')) not valid$$);
create index if not exists community_members_user_idx on public.community_members (user_id);

create or replace function public.is_community_member(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members where community_id = p_community and user_id = auth.uid());
$$;

create or replace function public.is_community_mod(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community and user_id = auth.uid() and role in ('owner','moderator')
  );
$$;

create or replace function public.is_community_owner(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities where id = p_community and owner_id = auth.uid());
$$;

create or replace function public.community_is_public(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities where id = p_community and not is_private);
$$;

create or replace function public.can_view_community(p_community uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.communities c
    where c.id = p_community
      and (not c.is_private or exists (
        select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()
      ))
  );
$$;

-- Owner becomes a member automatically.
create or replace function public.communities_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists communities_owner_member on public.communities;
create trigger communities_owner_member after insert on public.communities
for each row execute function public.communities_after_insert();

create or replace function public.community_members_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  elsif tg_op = 'DELETE' then
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end $$;
drop trigger if exists community_members_count_trg on public.community_members;
create trigger community_members_count_trg after insert or delete on public.community_members
for each row execute function public.community_members_count();

-- Owner-only role changes (member <-> moderator).
create or replace function public.set_member_role(p_community uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_role not in ('member','moderator') then raise exception 'invalid role'; end if;
  if not public.is_community_owner(p_community) then raise exception 'only the owner can change roles'; end if;
  update public.community_members set role = p_role
  where community_id = p_community and user_id = p_user and role <> 'owner';
end $$;

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null default '',
  media_urls text[] not null default '{}',
  community_id uuid references public.communities(id) on delete cascade,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts add column if not exists author_id uuid default auth.uid();
alter table public.posts add column if not exists content text not null default '';
alter table public.posts add column if not exists media_urls text[] not null default '{}';
alter table public.posts add column if not exists community_id uuid references public.communities(id) on delete cascade;
alter table public.posts add column if not exists like_count integer not null default 0;
alter table public.posts add column if not exists comment_count integer not null default 0;
alter table public.posts add column if not exists share_count integer not null default 0;
alter table public.posts add column if not exists created_at timestamptz not null default now();
alter table public.posts add column if not exists updated_at timestamptz not null default now();

select public._ic_add_constraint('public.posts', 'posts_content_length',
  $$check (char_length(content) <= 5000) not valid$$);
select public._ic_add_constraint('public.posts', 'posts_not_empty',
  $$check (char_length(btrim(content)) > 0 or cardinality(media_urls) > 0) not valid$$);
select public._ic_add_constraint('public.posts', 'posts_media_limit',
  $$check (cardinality(media_urls) <= 10) not valid$$);

create index if not exists posts_created_idx on public.posts (created_at desc, id desc);
create index if not exists posts_author_created_idx on public.posts (author_id, created_at desc);
create index if not exists posts_community_created_idx on public.posts (community_id, created_at desc);
create index if not exists posts_content_trgm on public.posts using gin (lower(content) extensions.gin_trgm_ops);

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
for each row execute function public.touch_updated_at();

create or replace function public.posts_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.author_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.author_id;
  end if;
  return null;
end $$;
drop trigger if exists posts_count_trg on public.posts;
create trigger posts_count_trg after insert or delete on public.posts
for each row execute function public.posts_count_sync();

-- ---------------------------------------------------------------------------
-- Row Level Security + column privileges
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.posts enable row level security;

-- Column-level grants stop clients from writing counters, owners or timestamps directly.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url) on public.profiles to authenticated;

revoke insert, update, delete on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;

revoke insert, update, delete on public.communities from anon, authenticated;
grant select, delete on public.communities to authenticated;
grant insert (name, slug, description, avatar_url, is_private) on public.communities to authenticated;
grant update (name, description, avatar_url, is_private) on public.communities to authenticated;

revoke insert, update, delete on public.community_members from anon, authenticated;
grant select, delete on public.community_members to authenticated;
grant insert (community_id) on public.community_members to authenticated;

revoke insert, update, delete on public.posts from anon, authenticated;
grant select, delete on public.posts to authenticated;
grant insert (content, media_urls, community_id) on public.posts to authenticated;
grant update (content, media_urls) on public.posts to authenticated;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- blocks: visible only to the blocker
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists blocks_insert_own on public.blocks;
create policy blocks_insert_own on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- communities
drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities for select to authenticated
  using (not is_private or public.is_community_member(id));
drop policy if exists communities_insert on public.communities;
create policy communities_insert on public.communities for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists communities_update_mod on public.communities;
create policy communities_update_mod on public.communities for update to authenticated
  using (public.is_community_mod(id)) with check (public.is_community_mod(id));
drop policy if exists communities_delete_owner on public.communities;
create policy communities_delete_owner on public.communities for delete to authenticated
  using (owner_id = auth.uid());

-- community_members
drop policy if exists cm_select on public.community_members;
create policy cm_select on public.community_members for select to authenticated
  using (public.can_view_community(community_id));
drop policy if exists cm_join on public.community_members;
create policy cm_join on public.community_members for insert to authenticated
  with check (user_id = auth.uid() and role = 'member' and public.community_is_public(community_id));
drop policy if exists cm_leave_or_remove on public.community_members;
create policy cm_leave_or_remove on public.community_members for delete to authenticated
  using (
    role <> 'owner' and (
      user_id = auth.uid()
      or (public.is_community_mod(community_id) and (role = 'member' or public.is_community_owner(community_id)))
    )
  );

-- posts
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (
    not public.is_blocked_between(auth.uid(), author_id)
    and (community_id is null or public.can_view_community(community_id))
  );
drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own on public.posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (community_id is null or public.is_community_member(community_id))
  );
drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists posts_delete_own_or_mod on public.posts;
create policy posts_delete_own_or_mod on public.posts for delete to authenticated
  using (author_id = auth.uid() or (community_id is not null and public.is_community_mod(community_id)));

-- Functions callable by signed-in users only (username_available stays open for the signup form).
revoke execute on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
