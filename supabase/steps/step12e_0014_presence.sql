-- STEP 12e: run this in the Supabase SQL editor (safe to run more than once). It adds Online / last-seen status.
-- iConnecto 0014: "Online / Active 5 minutes ago" status.
--
-- profiles.last_seen_at  is refreshed by the app every ~45 s while it is open (touch_presence). Users cannot write it directly
--                        (no column grant), so nobody can fake it.
-- profiles.show_activity lets a person switch their status off. Off = no timestamp is kept and nobody sees their status; in return
--                        they do not see other people's status either (same trade-off other apps make).
-- get_presence(ids)      returns how recent each person was, plus the server clock, so phones with a wrong clock still show the right text.
-- Idempotent and non-destructive.

alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists show_activity boolean not null default true;
grant update (show_activity) on public.profiles to authenticated;

create or replace function public.touch_presence() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set last_seen_at = case when show_activity then now() else null end
   where id = auth.uid();
end;
$$;

create or replace function public.get_presence(p_ids uuid[])
returns table (id uuid, last_seen_at timestamptz, server_now timestamptz)
language sql stable security invoker set search_path = public as $$
  select p.id, p.last_seen_at, now()
  from public.profiles p
  where p.id = any (p_ids[1:60])
    and p.show_activity
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.show_activity);
$$;

revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;
revoke all on function public.get_presence(uuid[]) from public, anon;
grant execute on function public.get_presence(uuid[]) to authenticated;
