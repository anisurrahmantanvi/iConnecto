-- iConnecto 0019: "Who can message you" (everyone | followers | nobody).
--  everyone  anyone can start a chat (they land in Message requests if you do not follow them).
--  followers only people who follow you can start a chat.
--  nobody    nobody can start a chat with you.
-- Once you have written in a chat, the other person can reply to you there. Blocking is unchanged. Idempotent.
alter table public.profiles add column if not exists who_can_message text not null default 'everyone';
alter table public.profiles drop constraint if exists profiles_who_can_message_check;
alter table public.profiles add constraint profiles_who_can_message_check check (who_can_message in ('everyone','followers','nobody'));
grant update (who_can_message) on public.profiles to authenticated;

create or replace function public.can_message(p_sender uuid, p_recipient uuid, p_chat uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select
    case coalesce((select who_can_message from public.profiles where id = p_recipient), 'everyone')
      when 'everyone' then true
      when 'followers' then exists (select 1 from public.followers f where f.follower_id = p_sender and f.following_id = p_recipient)
      else false
    end
    or (p_chat is not null and exists (select 1 from public.messages m where m.chat_id = p_chat and m.sender_id = p_recipient));
$$;
revoke execute on function public.can_message(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_message(uuid, uuid, uuid) to authenticated;

drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
    and not exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.user_id <> auth.uid()
        and (public.is_blocked_between(auth.uid(), cm.user_id) or not public.can_message(auth.uid(), cm.user_id, messages.chat_id))
    )
  );
