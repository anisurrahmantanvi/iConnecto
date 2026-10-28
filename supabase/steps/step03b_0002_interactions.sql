-- PART b of 2 of 0002_interactions.sql (run part a first, then part b)

-- ---------------------------------------------------------------------------
-- followers
-- ---------------------------------------------------------------------------
create table if not exists public.followers (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
alter table public.followers add column if not exists created_at timestamptz not null default now();
select public._ic_add_constraint('public.followers', 'followers_not_self',
  $$check (follower_id <> following_id) not valid$$);
create index if not exists followers_following_idx on public.followers (following_id, created_at desc);
create index if not exists followers_follower_idx on public.followers (follower_id, created_at desc);

create or replace function public.followers_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  return null;
end $$;
drop trigger if exists followers_sync_trg on public.followers;
create trigger followers_sync_trg after insert or delete on public.followers
for each row execute function public.followers_sync();

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.shares enable row level security;
alter table public.post_reactions enable row level security;
alter table public.followers enable row level security;

revoke insert, update, delete on public.post_likes, public.comments, public.comment_likes,
  public.saved_posts, public.shares, public.post_reactions, public.followers from anon, authenticated;

grant select, delete on public.post_likes, public.comment_likes, public.saved_posts, public.shares,
  public.post_reactions, public.followers to authenticated;
grant select, delete on public.comments to authenticated;
grant insert (post_id) on public.post_likes to authenticated;
grant insert (comment_id) on public.comment_likes to authenticated;
grant insert (post_id) on public.saved_posts to authenticated;
grant insert (post_id) on public.shares to authenticated;
grant insert (post_id, emoji) on public.post_reactions to authenticated;
grant insert (following_id) on public.followers to authenticated;
grant insert (post_id, parent_id, content) on public.comments to authenticated;
grant update (content) on public.comments to authenticated;

-- post_likes: users only see and manage their own like rows (counts come from posts.like_count)
drop policy if exists post_likes_select_own on public.post_likes;
create policy post_likes_select_own on public.post_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists post_likes_insert_own on public.post_likes;
create policy post_likes_insert_own on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists post_likes_delete_own on public.post_likes;
create policy post_likes_delete_own on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id)
    and not public.is_blocked_between(auth.uid(), author_id)
  );
drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists comments_delete_own_or_post_owner on public.comments;
create policy comments_delete_own_or_post_owner on public.comments for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- comment_likes
drop policy if exists comment_likes_select_own on public.comment_likes;
create policy comment_likes_select_own on public.comment_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists comment_likes_insert_own on public.comment_likes;
create policy comment_likes_insert_own on public.comment_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.comments c where c.id = comment_id));
drop policy if exists comment_likes_delete_own on public.comment_likes;
create policy comment_likes_delete_own on public.comment_likes for delete to authenticated using (user_id = auth.uid());

-- saved_posts
drop policy if exists saved_posts_select_own on public.saved_posts;
create policy saved_posts_select_own on public.saved_posts for select to authenticated using (user_id = auth.uid());
drop policy if exists saved_posts_insert_own on public.saved_posts;
create policy saved_posts_insert_own on public.saved_posts for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists saved_posts_delete_own on public.saved_posts;
create policy saved_posts_delete_own on public.saved_posts for delete to authenticated using (user_id = auth.uid());

-- shares
drop policy if exists shares_select_own on public.shares;
create policy shares_select_own on public.shares for select to authenticated using (user_id = auth.uid());
drop policy if exists shares_insert_own on public.shares;
create policy shares_insert_own on public.shares for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists shares_delete_own on public.shares;
create policy shares_delete_own on public.shares for delete to authenticated using (user_id = auth.uid());

-- post_reactions: visible wherever the post is visible; users manage only their own
drop policy if exists post_reactions_select on public.post_reactions;
create policy post_reactions_select on public.post_reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists post_reactions_insert_own on public.post_reactions;
create policy post_reactions_insert_own on public.post_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists post_reactions_delete_own on public.post_reactions;
create policy post_reactions_delete_own on public.post_reactions for delete to authenticated using (user_id = auth.uid());

-- followers: lists are visible to signed-in users; users manage only their own follow rows
drop policy if exists followers_select on public.followers;
create policy followers_select on public.followers for select to authenticated using (true);
drop policy if exists followers_insert_own on public.followers;
create policy followers_insert_own on public.followers for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked_between(follower_id, following_id));
drop policy if exists followers_delete_own on public.followers;
create policy followers_delete_own on public.followers for delete to authenticated using (follower_id = auth.uid());

revoke execute on function public.post_reaction_summary(uuid[]) from public, anon;
grant execute on function public.post_reaction_summary(uuid[]) to authenticated;
