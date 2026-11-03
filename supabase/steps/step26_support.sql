-- iConnecto 0028: support requests (problem reports, bug reports, feature requests, contact). Idempotent.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('problem','bug','feature','contact')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 3000),
  status text not null default 'open' check (status in ('open','in_review','resolved','closed')),
  reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_requests_user_idx on public.support_requests (user_id, created_at desc);

alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;
grant insert (kind, subject, message) on public.support_requests to authenticated;
drop policy if exists support_requests_select on public.support_requests;
create policy support_requests_select on public.support_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists support_requests_insert on public.support_requests;
create policy support_requests_insert on public.support_requests for insert to authenticated with check (user_id = auth.uid());

-- At most 10 requests per person per day (stops spam).
create or replace function public.support_requests_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.support_requests where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have sent many requests today. Please try again tomorrow.';
  end if;
  return new;
end $$;
drop trigger if exists support_requests_limit_trg on public.support_requests;
create trigger support_requests_limit_trg before insert on public.support_requests for each row execute function public.support_requests_limit();

-- To answer a request, run in the SQL Editor, for example:
--   update public.support_requests set status = 'resolved', reply = 'Fixed in the latest update.', updated_at = now() where id = '...';
