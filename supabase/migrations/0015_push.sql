-- iConnecto 0015: phone push notifications (messages, activity, calls).
--
-- push_tokens   one row per phone (the Firebase token); users can only add / remove their own through two functions.
-- app_private   small server-only settings table (RLS on, no policy, no grants): holds the shared secret the database sends to
--               the send-push Edge Function. The browser can never read it.
-- triggers      after a message / notification / call is created, ask the Edge Function (through pg_net) to push it.
--               A failure here never blocks the insert.
-- Idempotent and non-destructive. After running this, set the secret once (see step13 file).

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create table if not exists public.app_private (
  key text primary key,
  value text not null
);
alter table public.app_private enable row level security;
revoke all on public.app_private from anon, authenticated;

create or replace function public.register_push_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then raise exception 'invalid token'; end if;
  insert into public.push_tokens (token, user_id) values (p_token, auth.uid())
  on conflict (token) do update set user_id = auth.uid(), updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke all on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_push_token(text) to authenticated;

create or replace function public.push_notify() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  s text;
begin
  select value into s from public.app_private where key = 'push_secret';
  if s is null or s = '' then return new; end if;
  perform net.http_post(
    url := 'https://hcfehacsfirzwjqqcabb.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
    body := jsonb_build_object('kind', tg_argv[0], 'id', new.id)
  );
  return new;
exception when others then
  return new; -- a push problem must never stop a message, a like or a call
end;
$$;
revoke all on function public.push_notify() from public, anon, authenticated;

drop trigger if exists push_on_message on public.messages;
create trigger push_on_message after insert on public.messages
  for each row execute function public.push_notify('message');
drop trigger if exists push_on_notification on public.notifications;
create trigger push_on_notification after insert on public.notifications
  for each row execute function public.push_notify('notification');
drop trigger if exists push_on_call on public.call_sessions;
create trigger push_on_call after insert on public.call_sessions
  for each row execute function public.push_notify('call');
