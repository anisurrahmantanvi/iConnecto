-- iConnecto 0022: Friends (friend requests) replace Follow for people.
-- Run this INSTEAD of 0017 (private account), 0018 (message requests) and 0019 (who can message): it contains all of them,
-- updated to use friends. It is safe to run after them too. 0020 and 0021 are separate and can be run in any order.
--   * friendships / friend_requests   a friend request is accepted or declined; accepting makes both people friends.
--   * send_friend_request             if the other person already asked you, it simply makes you friends.
--   * profiles.is_private             private account = only friends see your posts.
--   * profiles.who_can_message        everyone | followers (= friends) | nobody.
--   * home_feed / suggested_profiles / posts_select / my_message_requests / can_message now use friends.
--   * The old `followers` table is kept for Pages (creators, brands) later; all existing follows are deleted at the END
--     of this file (last statement) and nobody can follow a person directly any more.

alter table public.profiles add column if not exists is_private boolean not null default false;
grant update (is_private) on public.profiles to authenticated;
alter table public.profiles add column if not exists who_can_message text not null default 'everyone';
alter table public.profiles drop constraint if exists profiles_who_can_message_check;
alter table public.profiles add constraint profiles_who_can_message_check check (who_can_message in ('everyone','followers','nobody'));
grant update (who_can_message) on public.profiles to authenticated;

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  constraint friendships_not_self check (user_id <> friend_id)
);
create index if not exists friendships_friend_idx on public.friendships (friend_id);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select to authenticated using (true);

create table if not exists public.friend_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint friend_requests_not_self check (requester_id <> target_id)
);
create index if not exists friend_requests_target_idx on public.friend_requests (target_id, created_at desc);
alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon, authenticated;
grant select on public.friend_requests to authenticated;
drop policy if exists friend_requests_select on public.friend_requests;
create policy friend_requests_select on public.friend_requests for select to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());

-- notification types
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow','like','comment','reply','community_join','follow_request','friend_request','friend_accepted')) not valid;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_id = a and friend_id = b);
$$;

create or replace function public.send_friend_request(p_target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_target is null or p_target = me then raise exception 'Invalid user'; end if;
  if not exists (select 1 from public.profiles where id = p_target) then raise exception 'User not found'; end if;
  if public.is_blocked_between(me, p_target) then raise exception 'You cannot send a request to this account'; end if;
  if public.are_friends(me, p_target) then return 'friends'; end if;
  -- They already asked you: accept.
  if exists (select 1 from public.friend_requests where requester_id = p_target and target_id = me) then
    delete from public.friend_requests where requester_id = p_target and target_id = me;
    insert into public.friendships (user_id, friend_id) values (me, p_target), (p_target, me) on conflict do nothing;
    perform public.notify(p_target, me, 'friend_accepted');
    return 'friends';
  end if;
  insert into public.friend_requests (requester_id, target_id) values (me, p_target) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    delete from public.notifications where recipient_id = p_target and actor_id = me and type = 'friend_request';
    perform public.notify(p_target, me, 'friend_request');
  end if;
  return 'requested';
end $$;

create or replace function public.cancel_friend_request(p_target uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friend_requests where requester_id = auth.uid() and target_id = p_target;
$$;

create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); found boolean;
begin
  if me is null then raise exception 'Not signed in'; end if;
  delete from public.friend_requests where requester_id = p_requester and target_id = me returning true into found;
  if coalesce(found, false) and p_accept and not public.is_blocked_between(me, p_requester) then
    insert into public.friendships (user_id, friend_id) values (me, p_requester), (p_requester, me) on conflict do nothing;
    perform public.notify(p_requester, me, 'friend_accepted');
  end if;
end $$;

create or replace function public.unfriend(p_other uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships
   where (user_id = auth.uid() and friend_id = p_other) or (user_id = p_other and friend_id = auth.uid());
$$;

-- Blocking ends a friendship and any waiting request.
create or replace function public.friends_cleanup_on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where (user_id = new.blocker_id and friend_id = new.blocked_id) or (user_id = new.blocked_id and friend_id = new.blocker_id);
  delete from public.friend_requests
   where (requester_id = new.blocker_id and target_id = new.blocked_id) or (requester_id = new.blocked_id and target_id = new.blocker_id);
  return null;
end $$;
drop trigger if exists friends_cleanup_on_block_trg on public.blocks;
create trigger friends_cleanup_on_block_trg after insert on public.blocks
for each row execute function public.friends_cleanup_on_block();

-- Private account: only friends see the posts. (Replaces the old approve-to-follow trigger.)
drop trigger if exists profiles_private_off_trg on public.profiles;
create or replace function public.can_see_author_content(p_author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_author = auth.uid()
    or not coalesce((select is_private from public.profiles where id = p_author), false)
    or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = p_author);
$$;
revoke execute on function public.can_see_author_content(uuid) from public, anon;
grant execute on function public.can_see_author_content(uuid) to authenticated;

-- Post visibility 'followers' now means "friends".
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (
    not public.is_blocked_between(auth.uid(), author_id)
    and (community_id is null or public.can_view_community(community_id))
    and public.can_see_author_content(author_id)
    and (
      visibility = 'public'
      or author_id = auth.uid()
      or (
        visibility = 'followers'
        and exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = posts.author_id)
      )
    )
  );

create or replace function public.home_feed(p_before timestamptz default null, p_limit integer default 15)
returns setof public.posts
language sql stable security invoker set search_path = public as $$
  select p.*
  from public.posts p
  where p.community_id is null
    and (
      p.author_id = auth.uid()
      or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = p.author_id)
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
    and not exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = pr.id)
    and not exists (select 1 from public.friend_requests r where r.requester_id = auth.uid() and r.target_id = pr.id)
    and not public.is_blocked_between(auth.uid(), pr.id)
  order by pr.created_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 30);
$$;

-- Message requests: a chat where they wrote to you, you never replied and you are not friends.
create or replace function public.my_message_requests() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cm.chat_id
  from public.chat_members cm
  join public.chat_members o on o.chat_id = cm.chat_id and o.user_id <> cm.user_id
  where cm.user_id = auth.uid()
    and exists (select 1 from public.messages m where m.chat_id = cm.chat_id and m.sender_id = o.user_id)
    and not exists (select 1 from public.messages m where m.chat_id = cm.chat_id and m.sender_id = cm.user_id)
    and not exists (select 1 from public.friendships f where f.user_id = cm.user_id and f.friend_id = o.user_id);
$$;
revoke execute on function public.my_message_requests() from public, anon;
grant execute on function public.my_message_requests() to authenticated;

-- Who can message you.
create or replace function public.can_message(p_sender uuid, p_recipient uuid, p_chat uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select
    case coalesce((select who_can_message from public.profiles where id = p_recipient), 'everyone')
      when 'everyone' then true
      when 'followers' then exists (select 1 from public.friendships f where f.user_id = p_sender and f.friend_id = p_recipient)
      else false
    end
    or (p_chat is not null and exists (select 1 from public.messages m where m.chat_id = p_chat and m.sender_id = p_recipient));
$$;
revoke execute on function public.can_message(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_message(uuid, uuid, uuid) to authenticated;

drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
    and not exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.user_id <> auth.uid()
        and (public.is_blocked_between(auth.uid(), cm.user_id) or not public.can_message(auth.uid(), cm.user_id, messages.chat_id))
    )
  );

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
revoke execute on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
revoke execute on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
revoke execute on function public.unfriend(uuid) from public, anon;
grant execute on function public.unfriend(uuid) to authenticated;

-- People can no longer follow a person directly (the table stays for Pages).
drop policy if exists followers_insert_own on public.followers;

-- LAST STATEMENT, destructive and not undoable: delete every existing follow, as you asked.
delete from public.followers;
update public.profiles set followers_count = 0, following_count = 0;
