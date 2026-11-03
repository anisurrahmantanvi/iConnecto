-- iConnecto 0028: notification preferences (+ quiet mode) and support requests. Idempotent.
create table if not exists public.notification_prefs (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  push_messages boolean not null default true,
  push_calls boolean not null default true,
  push_likes boolean not null default true,
  push_comments boolean not null default true,
  push_social boolean not null default true,
  quiet_enabled boolean not null default false,
  quiet_start smallint not null default 1380 check (quiet_start between 0 and 1439),  -- minutes from midnight, local time
  quiet_end smallint not null default 420 check (quiet_end between 0 and 1439),
  tz_offset smallint not null default 0 check (tz_offset between -840 and 840),        -- minutes east of UTC
  paused_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
revoke all on public.notification_prefs from anon, authenticated;
grant select, insert, update on public.notification_prefs to authenticated;
drop policy if exists notification_prefs_own on public.notification_prefs;
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('problem','bug','feature','support')),
  message text not null check (char_length(btrim(message)) between 5 and 3000),
  app_info text check (char_length(app_info) <= 500),
  status text not null default 'new' check (status in ('new','seen','done')),
  created_at timestamptz not null default now()
);
create index if not exists support_requests_user_idx on public.support_requests (user_id, created_at desc);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;
grant insert (kind, message, app_info) on public.support_requests to authenticated;
drop policy if exists support_requests_select on public.support_requests;
create policy support_requests_select on public.support_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists support_requests_insert on public.support_requests;
create policy support_requests_insert on public.support_requests for insert to authenticated with check (
  user_id = auth.uid()
  and (select count(*) from public.support_requests s where s.user_id = auth.uid() and s.created_at > now() - interval '1 hour') < 5
);
