-- PART a of 2 of 0002_interactions.sql (run part a first, then part b)
-- iConnecto 0002: likes, comments, comment likes, saves, shares, emoji reactions, follows
-- Counters are maintained by SECURITY DEFINER triggers. Clients cannot write counters or other users' rows.

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);

create or replace function public.post_likes_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists post_likes_sync_trg on public.post_likes;
create trigger post_likes_sync_trg after insert or delete on public.post_likes
for each row execute function public.post_likes_sync();

-- ---------------------------------------------------------------------------
-- comments (one level of replies)
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null,
  like_count integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists like_count integer not null default 0;
alter table public.comments add column if not exists reply_count integer not null default 0;
alter table public.comments add column if not exists updated_at timestamptz not null default now();
select public._ic_add_constraint('public.comments', 'comments_content_length',
  $$check (char_length(btrim(content)) between 1 and 2000) not valid$$);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at);
create index if not exists comments_parent_created_idx on public.comments (parent_id, created_at);

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch before update on public.comments
for each row execute function public.touch_updated_at();

-- Replies must stay on the same post and only one level deep.
create or replace function public.comments_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  par public.comments;
begin
  if new.parent_id is not null then
    select * into par from public.comments where id = new.parent_id;
    if not found then raise exception 'parent comment not found'; end if;
    if par.post_id <> new.post_id then raise exception 'reply must be on the same post'; end if;
    if par.parent_id is not null then raise exception 'replies can only be one level deep'; end if;
  end if;
  return new;
end $$;
drop trigger if exists comments_validate_trg on public.comments;
create trigger comments_validate_trg before insert on public.comments
for each row execute function public.comments_validate();

create or replace function public.comments_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    if new.parent_id is not null then
      update public.comments set reply_count = reply_count + 1 where id = new.parent_id;
    end if;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    if old.parent_id is not null then
      update public.comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists comments_sync_trg on public.comments;
create trigger comments_sync_trg after insert or delete on public.comments
for each row execute function public.comments_sync();

-- ---------------------------------------------------------------------------
-- comment_likes
-- ---------------------------------------------------------------------------
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);

create or replace function public.comment_likes_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;
drop trigger if exists comment_likes_sync_trg on public.comment_likes;
create trigger comment_likes_sync_trg after insert or delete on public.comment_likes
for each row execute function public.comment_likes_sync();

-- ---------------------------------------------------------------------------
-- saved_posts, shares
-- ---------------------------------------------------------------------------
create table if not exists public.saved_posts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists saved_posts_user_idx on public.saved_posts (user_id, created_at desc);

create table if not exists public.shares (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create or replace function public.shares_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set share_count = share_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set share_count = greatest(share_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists shares_sync_trg on public.shares;
create trigger shares_sync_trg after insert or delete on public.shares
for each row execute function public.shares_sync();

-- ---------------------------------------------------------------------------
-- post_reactions (emoji reactions)
-- ---------------------------------------------------------------------------
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
select public._ic_add_constraint('public.post_reactions', 'post_reactions_emoji_check',
  $$check (char_length(emoji) between 1 and 16 and emoji !~ '[A-Za-z0-9\s]')$$);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

-- Counts per emoji for a batch of posts (security invoker: RLS decides what is visible).
create or replace function public.post_reaction_summary(p_post_ids uuid[])
returns table (post_id uuid, emoji text, reaction_count bigint, reacted boolean)
language sql stable security invoker set search_path = public as $$
  select r.post_id, r.emoji, count(*)::bigint, bool_or(r.user_id = auth.uid())
  from public.post_reactions r
  where r.post_id = any (p_post_ids)
  group by r.post_id, r.emoji
  order by r.post_id, count(*) desc, r.emoji;
$$;
