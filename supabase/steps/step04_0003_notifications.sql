-- iConnecto 0003: notifications
-- Rows are created ONLY by SECURITY DEFINER triggers. Clients can read, mark read and delete their own rows.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications add column if not exists actor_id uuid references public.profiles(id) on delete cascade;
alter table public.notifications add column if not exists post_id uuid references public.posts(id) on delete cascade;
alter table public.notifications add column if not exists comment_id uuid references public.comments(id) on delete cascade;
alter table public.notifications add column if not exists community_id uuid references public.communities(id) on delete cascade;
alter table public.notifications add column if not exists is_read boolean not null default false;
alter table public.notifications add column if not exists created_at timestamptz not null default now();
select public._ic_add_constraint('public.notifications', 'notifications_type_check',
  $$check (type in ('follow','like','comment','reply','community_join')) not valid$$);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (recipient_id) where not is_read;
-- Prevents like/unlike/like spam from producing repeated notifications.
create unique index if not exists notifications_dedupe_idx on public.notifications (
  recipient_id, actor_id, type,
  coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid)
) where type in ('like', 'follow', 'community_join');

create or replace function public.notify(
  p_recipient uuid, p_actor uuid, p_type text,
  p_post uuid default null, p_comment uuid default null, p_community uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null or p_recipient = p_actor then return; end if;
  if public.is_blocked_between(p_recipient, p_actor) then return; end if;
  insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id, community_id)
  values (p_recipient, p_actor, p_type, p_post, p_comment, p_community)
  on conflict do nothing;
end $$;
revoke all on function public.notify(uuid, uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.trg_notify_post_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select author_id into v_owner from public.posts where id = new.post_id;
  perform public.notify(v_owner, new.user_id, 'like', new.post_id);
  return null;
end $$;
drop trigger if exists notify_post_like on public.post_likes;
create trigger notify_post_like after insert on public.post_likes
for each row execute function public.trg_notify_post_like();

create or replace function public.trg_notify_comment_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.comments;
begin
  select * into c from public.comments where id = new.comment_id;
  perform public.notify(c.author_id, new.user_id, 'like', c.post_id, c.id);
  return null;
end $$;
drop trigger if exists notify_comment_like on public.comment_likes;
create trigger notify_comment_like after insert on public.comment_likes
for each row execute function public.trg_notify_comment_like();

create or replace function public.trg_notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  post_owner uuid;
  parent_owner uuid;
begin
  select author_id into post_owner from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select author_id into parent_owner from public.comments where id = new.parent_id;
    perform public.notify(parent_owner, new.author_id, 'reply', new.post_id, new.id);
    if post_owner is distinct from parent_owner then
      perform public.notify(post_owner, new.author_id, 'comment', new.post_id, new.id);
    end if;
  else
    perform public.notify(post_owner, new.author_id, 'comment', new.post_id, new.id);
  end if;
  return null;
end $$;
drop trigger if exists notify_comment on public.comments;
create trigger notify_comment after insert on public.comments
for each row execute function public.trg_notify_comment();

create or replace function public.trg_notify_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.following_id, new.follower_id, 'follow');
  return null;
end $$;
drop trigger if exists notify_follow on public.followers;
create trigger notify_follow after insert on public.followers
for each row execute function public.trg_notify_follow();

create or replace function public.trg_notify_community_join() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.communities where id = new.community_id;
  perform public.notify(v_owner, new.user_id, 'community_join', null, null, new.community_id);
  return null;
end $$;
drop trigger if exists notify_community_join on public.community_members;
create trigger notify_community_join after insert on public.community_members
for each row execute function public.trg_notify_community_join();

alter table public.notifications enable row level security;
revoke insert, update, delete on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (recipient_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());

-- Realtime (postgres_changes honours the RLS policies above)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
