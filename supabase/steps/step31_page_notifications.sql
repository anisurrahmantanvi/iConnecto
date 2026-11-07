-- iConnecto 0033: notifications for Pages (new follower, like or comment on a page post).
-- Separate from the personal notifications table, so personal notifications are not affected. Only page members can read them.
-- Needs 0027 (pages). Idempotent.
create table if not exists public.page_notifications (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('follow','like','comment')),
  post_id uuid references public.posts(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists page_notifications_page_idx on public.page_notifications (page_id, created_at desc);
alter table public.page_notifications enable row level security;
revoke all on public.page_notifications from anon, authenticated;
grant select, update (is_read), delete on public.page_notifications to authenticated;

drop policy if exists page_notifications_select on public.page_notifications;
create policy page_notifications_select on public.page_notifications for select to authenticated using (public.is_page_member(page_id));
drop policy if exists page_notifications_update on public.page_notifications;
create policy page_notifications_update on public.page_notifications for update to authenticated
  using (public.is_page_member(page_id)) with check (public.is_page_member(page_id));
drop policy if exists page_notifications_delete on public.page_notifications;
create policy page_notifications_delete on public.page_notifications for delete to authenticated using (public.is_page_member(page_id));

-- New follower
create or replace function public.page_notify_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.page_notifications (page_id, actor_id, type) values (new.page_id, new.user_id, 'follow');
  return new;
end $$;
drop trigger if exists page_follows_notify on public.page_follows;
create trigger page_follows_notify after insert on public.page_follows for each row execute function public.page_notify_follow();

-- Like on a page post (people who work on the page are not notified about their own activity)
create or replace function public.page_notify_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select page_id into pid from public.page_posts where post_id = new.post_id;
  if pid is not null and not exists (select 1 from public.page_roles r where r.page_id = pid and r.user_id = new.user_id) then
    insert into public.page_notifications (page_id, actor_id, type, post_id) values (pid, new.user_id, 'like', new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists post_likes_page_notify on public.post_likes;
create trigger post_likes_page_notify after insert on public.post_likes for each row execute function public.page_notify_like();

-- Comment on a page post
create or replace function public.page_notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select page_id into pid from public.page_posts where post_id = new.post_id;
  if pid is not null and not exists (select 1 from public.page_roles r where r.page_id = pid and r.user_id = new.author_id) then
    insert into public.page_notifications (page_id, actor_id, type, post_id) values (pid, new.author_id, 'comment', new.post_id);
  end if;
  return new;
end $$;
drop trigger if exists comments_page_notify on public.comments;
create trigger comments_page_notify after insert on public.comments for each row execute function public.page_notify_comment();
