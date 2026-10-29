-- iConnecto 0010: profile trust badges + identity-verification (eKYC) bookkeeping.
--
-- Badge 1 "verified"     : earned automatically when the eKYC provider (Didit) approves the person. Written ONLY by the
--                          kyc-webhook Edge Function (service role), never by the browser.
-- Badge 2 "professional" : professionals / public figures. Granted by an admin, and only to accounts that already have badge 1.
--
-- Privacy: this schema stores NO identity document, NID number, selfie or personal details from the provider.
-- It keeps only the provider's session id, a status and timestamps. Those status rows are deleted after 30 days
-- (the badge itself stays on the profile). Idempotent and non-destructive.

-- ---------------------------------------------------------------------------
-- badge columns on profiles
-- Users can already UPDATE only (username, display_name, bio, avatar_url) (see 0001), so these columns are read-only for them.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists verified_at timestamptz;
alter table public.profiles add column if not exists is_professional boolean not null default false;

-- badge 2 requires badge 1
select public._ic_add_constraint('public.profiles', 'profiles_pro_requires_verified',
  $$check (not is_professional or is_verified) not valid$$);

-- ---------------------------------------------------------------------------
-- admins
-- ---------------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
-- no policies: only the service role / SQL editor can read or change admins

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- verification sessions (status only, no personal data)
-- ---------------------------------------------------------------------------
create table if not exists public.kyc_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'didit',
  provider_session_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists kyc_verifications_session_key on public.kyc_verifications (provider, provider_session_id);
create index if not exists kyc_verifications_user_idx on public.kyc_verifications (user_id, created_at desc);
select public._ic_add_constraint('public.kyc_verifications', 'kyc_status_valid',
  $$check (status in ('pending','approved','declined','in_review','abandoned','expired')) not valid$$);

alter table public.kyc_verifications enable row level security;
revoke all on public.kyc_verifications from anon, authenticated;
grant select (id, status, created_at, decided_at) on public.kyc_verifications to authenticated;

drop policy if exists kyc_select_own on public.kyc_verifications;
create policy kyc_select_own on public.kyc_verifications for select to authenticated
  using (user_id = auth.uid());
-- inserts/updates happen only in the Edge Functions with the service role.

-- ---------------------------------------------------------------------------
-- admin: grant / revoke badge 2 by username
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_professional(p_username text, p_on boolean) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into p from public.profiles where lower(username) = lower(trim(p_username));
  if not found then
    raise exception 'No user with that username' using errcode = 'P0002';
  end if;
  if p_on and not p.is_verified then
    raise exception 'This user must have the Verified badge first' using errcode = '22023';
  end if;
  update public.profiles set is_professional = p_on where id = p.id returning * into p;
  return p;
end $$;
revoke execute on function public.admin_set_professional(text, boolean) from public, anon;
grant execute on function public.admin_set_professional(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- called only by the kyc-webhook Edge Function (service role)
-- ---------------------------------------------------------------------------
create or replace function public.kyc_apply_result(p_session_id text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.kyc_verifications;
begin
  if p_status not in ('pending','approved','declined','in_review','abandoned','expired') then
    raise exception 'bad status';
  end if;
  select * into v from public.kyc_verifications
   where provider = 'didit' and provider_session_id = p_session_id for update;
  if not found then
    return; -- unknown session: ignore
  end if;
  -- an approved result is final
  if v.status = 'approved' then
    return;
  end if;
  update public.kyc_verifications
     set status = p_status,
         decided_at = case when p_status in ('pending') then null else now() end
   where id = v.id;
  if p_status = 'approved' then
    update public.profiles set is_verified = true, verified_at = now() where id = v.user_id;
  end if;
end $$;
revoke execute on function public.kyc_apply_result(text, text) from public, anon, authenticated;
grant execute on function public.kyc_apply_result(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 30-day clean-up of verification status rows
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_kyc() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  delete from public.kyc_verifications
   where coalesce(decided_at, created_at) < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_old_kyc() from public, anon, authenticated;
grant execute on function public.purge_old_kyc() to service_role;

-- Schedule it daily if pg_cron is available (Database > Extensions > pg_cron). Skipped quietly otherwise.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('purge_old_kyc') where exists (select 1 from cron.job where jobname = 'purge_old_kyc');
  perform cron.schedule('purge_old_kyc', '17 3 * * *', 'select public.purge_old_kyc()');
exception when others then
  raise notice 'pg_cron not scheduled (%): enable the pg_cron extension, then run this file again.', sqlerrm;
end $$;
