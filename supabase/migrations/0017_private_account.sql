-- iConnecto 0017: private (approve-to-follow) accounts.
--  * profiles.is_private     the owner can switch it (column-level update grant, like bio).
--  * follow_requests         who asked to follow whom. Written only through the functions below.
--  * request_follow(target)  follows right away for a public account, or sends a request for a private one.
--  * respond_follow_request  the private account's owner accepts or declines.
--  * posts_select            posts of a private account are visible only to the owner and to followers.
-- Switching an account back to public accepts every waiting request. Idempotent and non-destructive.

alter table public.profiles add column if not exists is_private boolean not null default false;
grant update (is_private) on public.profiles to authenticated;

create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint follow_requests_not_self check (requester_id <> target_id)
);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id, created_at desc);
alter table public.follow_requests enable row level security;
revoke all on public.follow_requests from anon, authenticated;
grant select on public.follow_requests to authenticated;
drop policy if exists follow_requests_select on public.follow_requests;
create policy follow_requests_select on public.follow_requests for select to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());

-- People cannot follow a private account directly any more; they must go through request_follow().
drop policy if exists followers_insert_own on public.followers;
create policy followers_insert_own on public.followers for insert to authenticated
  with check (
    follower_id = auth.uid()
    and not public.is_blocked_between(follower_id, following_id)
    and not coalesce((select p.is_private from public.profiles p where p.id = following_id), false)
  );

-- allow the new notification type
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow','like','comment','reply','community_join','follow_request')) not valid;

create or replace function public.request_follow(p_target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); priv boolean; n int;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_target is null or p_target = me then raise exception 'Invalid user'; end if;
  if public.is_blocked_between(me, p_target) then raise exception 'You cannot follow this account'; end if;
  if exists (select 1 from public.followers where follower_id = me and following_id = p_target) then return 'following'; end if;
  select is_private into priv from public.profiles where id = p_target;
  if priv is null then raise exception 'User not found'; end if;
  if not priv then
    insert into public.followers (follower_id, following_id) values (me, p_target) on conflict do nothing;
    return 'following';
  end if;
  insert into public.follow_requests (requester_id, target_id) values (me, p_target) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    delete from public.notifications where recipient_id = p_target and actor_id = me and type = 'follow_request';
    perform public.notify(p_target, me, 'follow_request');
  end if;
  return 'requested';
end $$;

create or replace function public.cancel_follow_request(p_target uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.follow_requests where requester_id = auth.uid() and target_id = p_target;
$$;

create or replace function public.respond_follow_request(p_requester uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); found boolean;
begin
  if me is null then raise exception 'Not signed in'; end if;
  delete from public.follow_requests where requester_id = p_requester and target_id = me returning true into found;
  if coalesce(found, false) and p_accept and not public.is_blocked_between(me, p_requester) then
    insert into public.followers (follower_id, following_id) values (p_requester, me) on conflict do nothing;
  end if;
end $$;

-- Going back to public accepts everyone who was waiting.
create or replace function public.profiles_private_off() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_private and not new.is_private then
    insert into public.followers (follower_id, following_id)
      select requester_id, target_id from public.follow_requests where target_id = new.id
      on conflict do nothing;
    delete from public.follow_requests where target_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_private_off_trg on public.profiles;
create trigger profiles_private_off_trg after update of is_private on public.profiles
for each row execute function public.profiles_private_off();

create or replace function public.can_see_author_content(p_author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_author = auth.uid()
    or not coalesce((select is_private from public.profiles where id = p_author), false)
    or exists (select 1 from public.followers f where f.follower_id = auth.uid() and f.following_id = p_author);
$$;

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
        and exists (
          select 1 from public.followers f
          where f.follower_id = auth.uid() and f.following_id = posts.author_id
        )
      )
    )
  );

revoke execute on function public.request_follow(uuid) from public, anon;
grant execute on function public.request_follow(uuid) to authenticated;
revoke execute on function public.cancel_follow_request(uuid) from public, anon;
grant execute on function public.cancel_follow_request(uuid) to authenticated;
revoke execute on function public.respond_follow_request(uuid, boolean) from public, anon;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
revoke execute on function public.can_see_author_content(uuid) from public, anon;
grant execute on function public.can_see_author_content(uuid) to authenticated;
