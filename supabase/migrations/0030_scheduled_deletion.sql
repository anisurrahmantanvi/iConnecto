-- iConnecto 0030: account deletion with a 30-day waiting period. Idempotent.
-- Day 0: the person asks (in the app or on the website). The profile is hidden from others and a deletion date is set.
-- Until that date the person can sign in and cancel. After it, the purge-accounts Edge Function removes the files and the
-- sign-in account; foreign keys cascade to the profile and everything it owns.

-- Hidden-profile support (same as 0029; safe to repeat).
create table if not exists public.deactivated_accounts (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.deactivated_accounts enable row level security;
revoke all on public.deactivated_accounts from anon, authenticated;
grant select on public.deactivated_accounts to authenticated;
drop policy if exists deactivated_accounts_select on public.deactivated_accounts;
create policy deactivated_accounts_select on public.deactivated_accounts for select to authenticated using (user_id = auth.uid());
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or not exists (select 1 from public.deactivated_accounts d where d.user_id = profiles.id));

create table if not exists public.account_deletions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default now() + interval '30 days'
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;
grant select on public.account_deletions to authenticated;
drop policy if exists account_deletions_select on public.account_deletions;
create policy account_deletions_select on public.account_deletions for select to authenticated using (user_id = auth.uid());

-- Someone with two-step verification (authenticator app) must have passed it in this session.
create or replace function public.request_account_deletion() returns timestamptz
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); due timestamptz;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from auth.mfa_factors f where f.user_id = me and f.status = 'verified')
     and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Enter your two-step verification code first.';
  end if;
  insert into public.account_deletions (user_id) values (me)
    on conflict (user_id) do nothing;
  insert into public.deactivated_accounts (user_id) values (me) on conflict do nothing;
  select scheduled_for into due from public.account_deletions where user_id = me;
  return due;
end $$;

create or replace function public.cancel_account_deletion() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.account_deletions where user_id = auth.uid();
  delete from public.deactivated_accounts where user_id = auth.uid();
end $$;

create or replace function public.my_account_deletion() returns timestamptz
language sql stable security definer set search_path = public as $$
  select scheduled_for from public.account_deletions where user_id = auth.uid();
$$;

-- Only the purge job (service role) may list who is due.
create or replace function public.due_account_deletions() returns setof uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.account_deletions where scheduled_for <= now() order by scheduled_for limit 50;
$$;

revoke execute on function public.request_account_deletion() from public, anon;
revoke execute on function public.cancel_account_deletion() from public, anon;
revoke execute on function public.my_account_deletion() from public, anon;
revoke execute on function public.due_account_deletions() from public, anon, authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.my_account_deletion() to authenticated;
grant execute on function public.due_account_deletions() to service_role;

-- The old instant delete is no longer reachable from the app; keep it away from clients.
revoke execute on function public.delete_my_account() from authenticated;
