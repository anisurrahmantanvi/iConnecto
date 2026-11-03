-- iConnecto 0027: Pages (creator / brand / business). Own tables, does not change existing ones except home_feed().
-- A page post is a normal post written by an admin/editor and linked to the page in page_posts.
-- Idempotent.

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_.]{2,29}$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  category text not null default 'other' check (category in ('creator','brand','business','shop','public_figure','media','education','community','other')),
  bio text not null default '' check (char_length(bio) <= 500),
  website text check (website is null or (char_length(website) <= 200 and website ~* '^https?://')),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  cover_url text check (cover_url is null or char_length(cover_url) <= 500),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  follower_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pages_followers_idx on public.pages (follower_count desc, created_at desc);

create table if not exists public.page_roles (
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor')),
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);
create index if not exists page_roles_user_idx on public.page_roles (user_id);

create table if not exists public.page_follows (
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id, user_id)
);
create index if not exists page_follows_user_idx on public.page_follows (user_id);

create table if not exists public.page_posts (
  post_id uuid primary key references public.posts(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists page_posts_page_idx on public.page_posts (page_id, created_at desc);

-- Helpers (security definer so policies do not recurse).
create or replace function public.is_page_member(p_page uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.page_roles r where r.page_id = p_page and r.user_id = auth.uid());
$$;
create or replace function public.is_page_admin(p_page uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.page_roles r where r.page_id = p_page and r.user_id = auth.uid() and r.role in ('owner','admin'));
$$;
revoke execute on function public.is_page_member(uuid) from public, anon;
revoke execute on function public.is_page_admin(uuid) from public, anon;
grant execute on function public.is_page_member(uuid) to authenticated;
grant execute on function public.is_page_admin(uuid) to authenticated;

-- RLS + grants
alter table public.pages enable row level security;
alter table public.page_roles enable row level security;
alter table public.page_follows enable row level security;
alter table public.page_posts enable row level security;
revoke all on public.pages, public.page_roles, public.page_follows, public.page_posts from anon, authenticated;

grant select on public.pages to authenticated;
grant update (name, category, bio, website, avatar_url, cover_url) on public.pages to authenticated;
drop policy if exists pages_select on public.pages;
create policy pages_select on public.pages for select to authenticated using (true);
drop policy if exists pages_update on public.pages;
create policy pages_update on public.pages for update to authenticated
  using (public.is_page_admin(id)) with check (public.is_page_admin(id));

grant select on public.page_roles to authenticated;
drop policy if exists page_roles_select on public.page_roles;
create policy page_roles_select on public.page_roles for select to authenticated
  using (user_id = auth.uid() or public.is_page_member(page_id));

grant select, insert (page_id), delete on public.page_follows to authenticated;
drop policy if exists page_follows_select on public.page_follows;
create policy page_follows_select on public.page_follows for select to authenticated using (user_id = auth.uid() or public.is_page_member(page_id));
drop policy if exists page_follows_insert on public.page_follows;
create policy page_follows_insert on public.page_follows for insert to authenticated with check (user_id = auth.uid());
drop policy if exists page_follows_delete on public.page_follows;
create policy page_follows_delete on public.page_follows for delete to authenticated using (user_id = auth.uid());

grant select on public.page_posts to authenticated;
drop policy if exists page_posts_select on public.page_posts;
create policy page_posts_select on public.page_posts for select to authenticated using (true);

-- follower_count is owned by the server
create or replace function public.page_follow_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.pages set follower_count = follower_count + 1 where id = new.page_id;
  else
    update public.pages set follower_count = greatest(follower_count - 1, 0) where id = old.page_id;
  end if;
  return null;
end $$;
drop trigger if exists page_follows_count on public.page_follows;
create trigger page_follows_count after insert or delete on public.page_follows for each row execute function public.page_follow_count();

-- Create a page (max 5 owned per person).
create or replace function public.create_page(p_slug text, p_name text, p_category text, p_bio text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s text := lower(btrim(coalesce(p_slug, ''))); new_id uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if s !~ '^[a-z0-9][a-z0-9_.]{2,29}$' then raise exception 'Page link: 3-30 letters, numbers, dot or underscore.'; end if;
  if (select count(*) from public.pages where owner_id = me) >= 5 then raise exception 'You can own up to 5 pages.'; end if;
  begin
    insert into public.pages (slug, name, category, bio, owner_id)
    values (s, btrim(p_name), coalesce(nullif(p_category, ''), 'other'), coalesce(p_bio, ''), me)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'That page link is already taken.';
  end;
  insert into public.page_roles (page_id, user_id, role) values (new_id, me, 'owner');
  return new_id;
end $$;

create or replace function public.set_page_role(p_page uuid, p_username text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); target uuid; my_role text; cur_role text;
begin
  if p_role not in ('admin','editor') then raise exception 'Role must be admin or editor.'; end if;
  select role into my_role from public.page_roles where page_id = p_page and user_id = me;
  if my_role is null or my_role = 'editor' then raise exception 'Only page admins can manage the team.'; end if;
  if p_role = 'admin' and my_role <> 'owner' then raise exception 'Only the owner can make someone an admin.'; end if;
  select id into target from public.profiles where lower(username) = lower(btrim(p_username));
  if target is null then raise exception 'No user with that username.'; end if;
  select role into cur_role from public.page_roles where page_id = p_page and user_id = target;
  if cur_role = 'owner' then raise exception 'The owner role cannot be changed.'; end if;
  if cur_role = 'admin' and my_role <> 'owner' then raise exception 'Only the owner can change an admin.'; end if;
  if public.is_blocked_between(me, target) then raise exception 'You cannot add this person.'; end if;
  insert into public.page_roles (page_id, user_id, role) values (p_page, target, p_role)
  on conflict (page_id, user_id) do update set role = excluded.role;
end $$;

create or replace function public.remove_page_role(p_page uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); my_role text; target_role text;
begin
  select role into my_role from public.page_roles where page_id = p_page and user_id = me;
  select role into target_role from public.page_roles where page_id = p_page and user_id = p_user;
  if my_role is null or target_role is null then raise exception 'Not allowed.'; end if;
  if target_role = 'owner' then raise exception 'The owner cannot be removed.'; end if;
  if p_user <> me then
    if my_role = 'editor' then raise exception 'Not allowed.'; end if;
    if target_role = 'admin' and my_role <> 'owner' then raise exception 'Only the owner can remove an admin.'; end if;
  end if;
  delete from public.page_roles where page_id = p_page and user_id = p_user;
end $$;

-- Link a freshly written public post to a page (author must be a member of the page).
create or replace function public.link_page_post(p_post uuid, p_page uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ok boolean;
begin
  if not public.is_page_member(p_page) then raise exception 'You cannot post as this page.'; end if;
  select (author_id = me and visibility = 'public' and community_id is null and created_at > now() - interval '15 minutes')
    into ok from public.posts where id = p_post;
  if ok is not true then raise exception 'This post cannot be posted as the page.'; end if;
  insert into public.page_posts (post_id, page_id) values (p_post, p_page) on conflict do nothing;
end $$;

create or replace function public.delete_page(p_page uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.page_roles where page_id = p_page and user_id = auth.uid() and role = 'owner') then
    raise exception 'Only the owner can delete the page.';
  end if;
  delete from public.posts where id in (select post_id from public.page_posts where page_id = p_page);
  delete from public.pages where id = p_page;
end $$;

revoke execute on function public.create_page(text, text, text, text) from public, anon;
revoke execute on function public.set_page_role(uuid, text, text) from public, anon;
revoke execute on function public.remove_page_role(uuid, uuid) from public, anon;
revoke execute on function public.link_page_post(uuid, uuid) from public, anon;
revoke execute on function public.delete_page(uuid) from public, anon;
grant execute on function public.create_page(text, text, text, text) to authenticated;
grant execute on function public.set_page_role(uuid, text, text) to authenticated;
grant execute on function public.remove_page_role(uuid, uuid) to authenticated;
grant execute on function public.link_page_post(uuid, uuid) to authenticated;
grant execute on function public.delete_page(uuid) to authenticated;

-- Home feed: friends' own posts + posts of pages I follow or work on (page posts are not shown just because the author is my friend).
create or replace function public.home_feed(p_before timestamptz default null, p_limit integer default 15)
returns setof public.posts
language sql stable security invoker set search_path = public as $$
  select p.*
  from public.posts p
  left join public.page_posts pp on pp.post_id = p.id
  where p.community_id is null
    and (
      case when pp.page_id is null then
        (p.author_id = auth.uid()
         or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = p.author_id))
      else
        (exists (select 1 from public.page_follows pf where pf.page_id = pp.page_id and pf.user_id = auth.uid())
         or public.is_page_member(pp.page_id))
      end
    )
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 15), 1), 50);
$$;
revoke execute on function public.home_feed(timestamptz, integer) from public, anon;
grant execute on function public.home_feed(timestamptz, integer) to authenticated;

-- Page insights (owner/admin only): simple counts, no tracking of individuals.
create or replace function public.page_insights(p_page uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_page_admin(p_page) then raise exception 'Not allowed.'; end if;
  return json_build_object(
    'followers', (select follower_count from public.pages where id = p_page),
    'followers_7d', (select count(*) from public.page_follows where page_id = p_page and created_at > now() - interval '7 days'),
    'followers_30d', (select count(*) from public.page_follows where page_id = p_page and created_at > now() - interval '30 days'),
    'posts', (select count(*) from public.page_posts where page_id = p_page),
    'posts_30d', (select count(*) from public.page_posts where page_id = p_page and created_at > now() - interval '30 days'),
    'likes', (select coalesce(sum(p.like_count), 0) from public.page_posts pp join public.posts p on p.id = pp.post_id where pp.page_id = p_page),
    'comments', (select coalesce(sum(p.comment_count), 0) from public.page_posts pp join public.posts p on p.id = pp.post_id where pp.page_id = p_page),
    'top_post', (select json_build_object('id', p.id, 'content', left(p.content, 80), 'likes', p.like_count, 'comments', p.comment_count)
                 from public.page_posts pp join public.posts p on p.id = pp.post_id where pp.page_id = p_page
                 order by (p.like_count + p.comment_count) desc, p.created_at desc limit 1)
  );
end $$;
revoke execute on function public.page_insights(uuid) from public, anon;
grant execute on function public.page_insights(uuid) to authenticated;
