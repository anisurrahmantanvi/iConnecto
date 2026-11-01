-- iConnecto 0021: read receipts, typing status, archived chats.
--  * profiles.read_receipts / typing_status   on by default; the owner can switch them off.
--  * chat_seen(chat)  when the other person last read this chat, but only if BOTH of you have read receipts on.
--  * chat_archives    chats a person has archived (only they see this). archive_chat() adds or removes one.
-- Idempotent and non-destructive.
alter table public.profiles add column if not exists read_receipts boolean not null default true;
alter table public.profiles add column if not exists typing_status boolean not null default true;
grant update (read_receipts, typing_status) on public.profiles to authenticated;

create or replace function public.chat_seen(p_chat uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_other uuid; v_at timestamptz;
begin
  if v_me is null or not public.is_chat_member(p_chat) then return null; end if;
  select user_id, last_read_at into v_other, v_at from public.chat_members where chat_id = p_chat and user_id <> v_me limit 1;
  if v_other is null then return null; end if;
  if coalesce((select read_receipts from public.profiles where id = v_me), true)
     and coalesce((select read_receipts from public.profiles where id = v_other), true) then
    return v_at;
  end if;
  return null;
end $$;

create table if not exists public.chat_archives (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);
alter table public.chat_archives enable row level security;
revoke all on public.chat_archives from anon, authenticated;
grant select on public.chat_archives to authenticated;
drop policy if exists chat_archives_select on public.chat_archives;
create policy chat_archives_select on public.chat_archives for select to authenticated using (user_id = auth.uid());

create or replace function public.archive_chat(p_chat uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_chat_member(p_chat) then raise exception 'Chat not found'; end if;
  if p_on then
    insert into public.chat_archives (user_id, chat_id) values (auth.uid(), p_chat) on conflict do nothing;
  else
    delete from public.chat_archives where user_id = auth.uid() and chat_id = p_chat;
  end if;
end $$;

revoke execute on function public.chat_seen(uuid) from public, anon;
grant execute on function public.chat_seen(uuid) to authenticated;
revoke execute on function public.archive_chat(uuid, boolean) from public, anon;
grant execute on function public.archive_chat(uuid, boolean) to authenticated;
