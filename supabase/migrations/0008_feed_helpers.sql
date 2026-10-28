-- iConnecto 0008: server-side helpers that replace long client-built filters.
-- Non-destructive and idempotent. All functions are SECURITY INVOKER, so Row Level Security still decides what is visible.
--
--   home_feed(before, limit)   posts by me + people I follow (community posts excluded), newest first.
--                              The client used to send up to 500 author ids in the URL, which can exceed URL length limits.
--   suggested_profiles(limit)  people I do not follow yet (and have no block with), newest first.
--   chat_peer(chat)            the other participant of a chat, also for chats that have no message yet
--                              (my_chats() only lists chats with at least one message).
--   edited_at                  posts.updated_at / comments.updated_at also move when a counter changes (likes,
--                              replies), so they cannot tell "edited" apart. edited_at is stamped only when the
--                              text itself changes and is not writable by clients (no column grant).

create or replace function public.home_feed(p_before timestamptz default null, p_limit integer default 15)
returns setof public.posts
language sql stable security invoker set search_path = public as $$
  select p.*
  from public.posts p
  where p.community_id is null
    and (
      p.author_id = auth.uid()
      or exists (
        select 1 from public.followers f
        where f.follower_id = auth.uid() and f.following_id = p.author_id
      )
    )
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 15), 1), 50);
$$;

create or replace function public.suggested_profiles(p_limit integer default 8)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security invoker set search_path = public as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_url
  from public.profiles pr
  where pr.id <> auth.uid()
    and not exists (
      select 1 from public.followers f
      where f.follower_id = auth.uid() and f.following_id = pr.id
    )
    and not public.is_blocked_between(auth.uid(), pr.id)
  order by pr.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 30);
$$;

create or replace function public.chat_peer(p_chat uuid)
returns table (other_id uuid, other_username text, other_display_name text, other_avatar_url text)
language sql stable security invoker set search_path = public as $$
  select o.user_id, p.username, p.display_name, p.avatar_url
  from public.chat_members me
  join public.chat_members o on o.chat_id = me.chat_id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  where me.chat_id = p_chat and me.user_id = auth.uid()
  limit 1;
$$;

revoke execute on function public.home_feed(timestamptz, integer) from public, anon;
grant execute on function public.home_feed(timestamptz, integer) to authenticated;
revoke execute on function public.suggested_profiles(integer) from public, anon;
grant execute on function public.suggested_profiles(integer) to authenticated;
revoke execute on function public.chat_peer(uuid) from public, anon;
grant execute on function public.chat_peer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- edited_at
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists edited_at timestamptz;

create or replace function public.mark_edited() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.content is distinct from old.content then
    new.edited_at := now();
  end if;
  return new;
end $$;
revoke all on function public.mark_edited() from public, anon, authenticated;

drop trigger if exists posts_mark_edited on public.posts;
create trigger posts_mark_edited before update on public.posts
for each row execute function public.mark_edited();

drop trigger if exists comments_mark_edited on public.comments;
create trigger comments_mark_edited before update on public.comments
for each row execute function public.mark_edited();
