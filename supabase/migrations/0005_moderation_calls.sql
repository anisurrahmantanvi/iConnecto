-- iConnecto 0005: reports, block side effects, call sessions and WebRTC signaling

-- ---------------------------------------------------------------------------
-- reports (write-only for users; review through the Supabase dashboard / service role)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
alter table public.reports add column if not exists details text;
alter table public.reports add column if not exists status text not null default 'open';
select public._ic_add_constraint('public.reports', 'reports_target_type_check',
  $$check (target_type in ('user','post','comment','community')) not valid$$);
select public._ic_add_constraint('public.reports', 'reports_reason_check',
  $$check (reason in ('spam','harassment','hate','violence','nudity','self_harm','impersonation','other')) not valid$$);
select public._ic_add_constraint('public.reports', 'reports_details_length',
  $$check (details is null or char_length(details) <= 1000) not valid$$);
create unique index if not exists reports_once_per_target on public.reports (reporter_id, target_type, target_id);

alter table public.reports enable row level security;
revoke insert, update, delete on public.reports from anon, authenticated;
grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid());
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Blocking removes follow relationships in both directions
-- ---------------------------------------------------------------------------
create or replace function public.blocks_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.followers
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return null;
end $$;
drop trigger if exists blocks_after_insert_trg on public.blocks;
create trigger blocks_after_insert_trg after insert on public.blocks
for each row execute function public.blocks_after_insert();

-- ---------------------------------------------------------------------------
-- call_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  call_type text not null default 'audio',
  status text not null default 'ringing',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
alter table public.call_sessions add column if not exists call_type text not null default 'audio';
alter table public.call_sessions add column if not exists status text not null default 'ringing';
alter table public.call_sessions add column if not exists started_at timestamptz;
alter table public.call_sessions add column if not exists ended_at timestamptz;
select public._ic_add_constraint('public.call_sessions', 'call_sessions_type_check',
  $$check (call_type in ('audio','video')) not valid$$);
select public._ic_add_constraint('public.call_sessions', 'call_sessions_status_check',
  $$check (status in ('ringing','accepted','declined','cancelled','missed','ended','failed')) not valid$$);
select public._ic_add_constraint('public.call_sessions', 'call_sessions_not_self',
  $$check (caller_id <> callee_id) not valid$$);
create index if not exists call_sessions_callee_idx on public.call_sessions (callee_id, created_at desc);
create index if not exists call_sessions_caller_idx on public.call_sessions (caller_id, created_at desc);

-- Enforces who may move a call to which status; stamps started_at / ended_at on the server.
create or replace function public.call_sessions_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if public.is_blocked_between(new.caller_id, new.callee_id) then
      raise exception 'calling is not available';
    end if;
    new.status := 'ringing';
    return new;
  end if;

  if new.status = old.status then
    return old;
  end if;
  if old.status in ('declined','cancelled','missed','ended','failed') then
    raise exception 'call already finished';
  end if;

  if new.status in ('accepted','declined') then
    if v_me is distinct from old.callee_id or old.status <> 'ringing' then
      raise exception 'only the callee can answer a ringing call';
    end if;
  elsif new.status in ('cancelled','missed') then
    if v_me is distinct from old.caller_id or old.status <> 'ringing' then
      raise exception 'only the caller can cancel a ringing call';
    end if;
  elsif new.status = 'ended' then
    if old.status <> 'accepted' then raise exception 'call was not connected'; end if;
  elsif new.status <> 'failed' then
    raise exception 'invalid status';
  end if;

  new.caller_id := old.caller_id;
  new.callee_id := old.callee_id;
  new.call_type := old.call_type;
  new.created_at := old.created_at;
  if new.status = 'accepted' then new.started_at := now(); end if;
  if new.status in ('declined','cancelled','missed','ended','failed') then new.ended_at := now(); end if;
  return new;
end $$;
drop trigger if exists call_sessions_validate_trg on public.call_sessions;
create trigger call_sessions_validate_trg before insert or update on public.call_sessions
for each row execute function public.call_sessions_validate();

alter table public.call_sessions enable row level security;
revoke insert, update, delete on public.call_sessions from anon, authenticated;
grant select on public.call_sessions to authenticated;
grant insert (callee_id, call_type) on public.call_sessions to authenticated;
grant update (status) on public.call_sessions to authenticated;

drop policy if exists call_sessions_select_participant on public.call_sessions;
create policy call_sessions_select_participant on public.call_sessions for select to authenticated
  using (auth.uid() in (caller_id, callee_id));
drop policy if exists call_sessions_insert_caller on public.call_sessions;
create policy call_sessions_insert_caller on public.call_sessions for insert to authenticated
  with check (caller_id = auth.uid());
drop policy if exists call_sessions_update_participant on public.call_sessions;
create policy call_sessions_update_participant on public.call_sessions for update to authenticated
  using (auth.uid() in (caller_id, callee_id)) with check (auth.uid() in (caller_id, callee_id));

-- ---------------------------------------------------------------------------
-- call_signals: authenticated SDP/ICE exchange over Realtime (postgres_changes + RLS)
-- ---------------------------------------------------------------------------
create table if not exists public.call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.call_sessions(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
select public._ic_add_constraint('public.call_signals', 'call_signals_kind_check',
  $$check (kind in ('offer','answer','ice','hangup'))$$);
select public._ic_add_constraint('public.call_signals', 'call_signals_payload_size',
  $$check (pg_column_size(payload) < 16000)$$);
create index if not exists call_signals_call_idx on public.call_signals (call_id, id);

alter table public.call_signals enable row level security;
revoke insert, update, delete on public.call_signals from anon, authenticated;
grant select on public.call_signals to authenticated;
grant insert (call_id, kind, payload) on public.call_signals to authenticated;

drop policy if exists call_signals_select_participant on public.call_signals;
create policy call_signals_select_participant on public.call_signals for select to authenticated
  using (exists (
    select 1 from public.call_sessions s
    where s.id = call_id and auth.uid() in (s.caller_id, s.callee_id)
  ));
drop policy if exists call_signals_insert_participant on public.call_signals;
create policy call_signals_insert_participant on public.call_signals for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.call_sessions s
      where s.id = call_id and auth.uid() in (s.caller_id, s.callee_id)
        and s.status in ('ringing','accepted')
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.call_sessions;
    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.call_signals;
    exception when duplicate_object then null; end;
  end if;
end $$;
