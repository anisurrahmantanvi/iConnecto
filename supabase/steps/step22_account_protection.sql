-- Advanced account protection: trusted devices + security alerts. Idempotent and non-destructive.
alter table public.profiles add column if not exists security_alerts boolean not null default true;
grant update (security_alerts) on public.profiles to authenticated;

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null,
  label text not null default 'Unknown device',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (user_id, device_key)
);
alter table public.user_devices enable row level security;
revoke all on public.user_devices from anon, authenticated;
grant select on public.user_devices to authenticated;
drop policy if exists user_devices_select on public.user_devices;
create policy user_devices_select on public.user_devices for select to authenticated using (user_id = auth.uid());

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('follow','like','comment','reply','community_join','follow_request','friend_request','friend_accepted','security_alert')) not valid;

-- Called by the app on start. Returns true when this device is new to an account that already had devices.
create or replace function public.register_device(p_key text, p_label text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_had boolean; v_new boolean := false; v_alerts boolean;
begin
  if v_me is null or p_key is null or length(p_key) < 8 then return false; end if;
  select exists (select 1 from public.user_devices where user_id = v_me) into v_had;
  insert into public.user_devices (user_id, device_key, label) values (v_me, left(p_key, 80), left(coalesce(p_label, 'Unknown device'), 80))
    on conflict (user_id, device_key) do update set last_seen = now(), label = excluded.label
    returning (xmax = 0) into v_new;
  if v_new and v_had then
    select coalesce(security_alerts, true) into v_alerts from public.profiles where id = v_me;
    if v_alerts then insert into public.notifications (recipient_id, type) values (v_me, 'security_alert'); end if;
    return true;
  end if;
  return false;
end $$;

-- Forgets every device except the one calling (used with "sign out other devices").
create or replace function public.forget_other_devices(p_key text) returns void
language sql security definer set search_path = public as $$
  delete from public.user_devices where user_id = auth.uid() and device_key <> p_key;
$$;

revoke execute on function public.register_device(text, text) from public, anon;
grant execute on function public.register_device(text, text) to authenticated;
revoke execute on function public.forget_other_devices(text) from public, anon;
grant execute on function public.forget_other_devices(text) to authenticated;
