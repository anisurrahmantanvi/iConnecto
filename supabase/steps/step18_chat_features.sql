-- iConnecto 0020: chat features.
--  * call log      a line in the chat when a call ends ("Voice call · 2:35", "Missed video call", ...), written by the server.
--  * edit / unsend only the sender, only within 2 minutes (edit_message / unsend_message).
--  * forward       messages.forwarded marks a forwarded message.
--  * reactions     one emoji per person per message (react_message).
-- Idempotent and non-destructive. Does not depend on 0018 or 0019.
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists forwarded boolean not null default false;
alter table public.messages add column if not exists call_id uuid;
create unique index if not exists messages_call_id_uidx on public.messages (call_id) where call_id is not null;
grant insert (forwarded) on public.messages to authenticated;

-- Edit within 2 minutes.
create or replace function public.edit_message(p_id uuid, p_content text) returns void
language plpgsql security definer set search_path = public as $$
declare v_chat uuid; v_at timestamptz; v_text text := btrim(coalesce(p_content, ''));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if char_length(v_text) not between 1 and 4000 then raise exception 'Messages can be 1 to 4000 characters'; end if;
  update public.messages set content = v_text, edited_at = now()
   where id = p_id and sender_id = auth.uid() and kind = 'text' and created_at > now() - interval '2 minutes'
   returning chat_id, created_at into v_chat, v_at;
  if v_chat is null then raise exception 'You can only edit your own message within 2 minutes'; end if;
  update public.chats set last_message_preview = left(v_text, 140) where id = v_chat and last_message_at = v_at;
end $$;

-- Unsend (delete for everyone) within 2 minutes.
create or replace function public.unsend_message(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_chat uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.messages
   where id = p_id and sender_id = auth.uid() and kind = 'text' and created_at > now() - interval '2 minutes'
   returning chat_id into v_chat;
  if v_chat is null then raise exception 'You can only unsend your own message within 2 minutes'; end if;
  update public.chats c set
    last_message_at = (select max(created_at) from public.messages where chat_id = v_chat),
    last_message_preview = (select left(content, 140) from public.messages where chat_id = v_chat order by created_at desc limit 1)
   where c.id = v_chat;
end $$;
-- Direct deletes are closed: unsend goes through the function above.
drop policy if exists messages_delete_own on public.messages;
revoke delete on public.messages from authenticated;

-- Reactions.
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;
drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id)));

create or replace function public.react_message(p_message uuid, p_emoji text) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_chat uuid;
begin
  if v_me is null then raise exception 'Not signed in'; end if;
  select chat_id into v_chat from public.messages where id = p_message;
  if v_chat is null or not public.is_chat_member(v_chat) then raise exception 'Message not found'; end if;
  if p_emoji is null or btrim(p_emoji) = '' then
    delete from public.message_reactions where message_id = p_message and user_id = v_me;
    return;
  end if;
  if exists (select 1 from public.chat_members cm where cm.chat_id = v_chat and cm.user_id <> v_me and public.is_blocked_between(v_me, cm.user_id)) then
    raise exception 'Not available';
  end if;
  insert into public.message_reactions (message_id, user_id, emoji) values (p_message, v_me, left(btrim(p_emoji), 16))
  on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
end $$;

-- Call log line in the chat when a call finishes.
create or replace function public.call_sessions_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_chat uuid; v_label text; v_text text; v_secs int;
begin
  if new.status = old.status or new.status not in ('ended','declined','cancelled','missed') then return null; end if;
  select c.id into v_chat from public.chats c
   where not c.is_group
     and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = new.caller_id)
     and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = new.callee_id)
   limit 1;
  if v_chat is null then
    insert into public.chats default values returning id into v_chat;
    insert into public.chat_members (chat_id, user_id) values (v_chat, new.caller_id), (v_chat, new.callee_id);
  end if;
  v_label := case when new.call_type = 'video' then 'video call' else 'voice call' end;
  if new.status = 'ended' then
    v_secs := greatest(0, floor(extract(epoch from (coalesce(new.ended_at, now()) - coalesce(new.started_at, new.ended_at, now()))))::int);
    v_text := initcap(v_label) || ' · ' ||
      case when v_secs >= 3600 then (v_secs / 3600)::text || ':' || lpad(((v_secs % 3600) / 60)::text, 2, '0') || ':' || lpad((v_secs % 60)::text, 2, '0')
           else (v_secs / 60)::text || ':' || lpad((v_secs % 60)::text, 2, '0') end;
  elsif new.status = 'declined' then v_text := initcap(v_label) || ' declined';
  elsif new.status = 'cancelled' then v_text := 'Cancelled ' || v_label;
  else v_text := 'Missed ' || v_label;
  end if;
  insert into public.messages (chat_id, sender_id, content, kind, call_id)
  values (v_chat, new.caller_id, v_text, 'call', new.id)
  on conflict do nothing;
  return null;
end $$;
drop trigger if exists call_sessions_log_trg on public.call_sessions;
create trigger call_sessions_log_trg after update on public.call_sessions
for each row execute function public.call_sessions_log();

revoke execute on function public.edit_message(uuid, text) from public, anon;
grant execute on function public.edit_message(uuid, text) to authenticated;
revoke execute on function public.unsend_message(uuid) from public, anon;
grant execute on function public.unsend_message(uuid) to authenticated;
revoke execute on function public.react_message(uuid, text) from public, anon;
grant execute on function public.react_message(uuid, text) to authenticated;

-- Live updates for reactions (ignored if already added).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
