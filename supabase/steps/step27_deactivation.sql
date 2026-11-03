-- iConnecto 0029: temporary account deactivation. The profile is hidden from everyone else until the person signs in and reactivates. Idempotent.
create table if not exists public.deactivated_accounts (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.deactivated_accounts enable row level security;
revoke all on public.deactivated_accounts from anon, authenticated;
grant select on public.deactivated_accounts to authenticated;
drop policy if exists deactivated_accounts_select on public.deactivated_accounts;
create policy deactivated_accounts_select on public.deactivated_accounts for select to authenticated using (user_id = auth.uid());

create or replace function public.deactivate_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.deactivated_accounts (user_id) values (auth.uid()) on conflict do nothing;
end $$;
create or replace function public.reactivate_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.deactivated_accounts where user_id = auth.uid();
end $$;
revoke execute on function public.deactivate_account() from public, anon;
revoke execute on function public.reactivate_account() from public, anon;
grant execute on function public.deactivate_account() to authenticated;
grant execute on function public.reactivate_account() to authenticated;

-- Other people no longer see a deactivated profile (you still see your own).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or not exists (select 1 from public.deactivated_accounts d where d.user_id = profiles.id));
