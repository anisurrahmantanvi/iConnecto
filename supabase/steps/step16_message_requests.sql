-- iConnecto 0018: message requests.
-- A chat is a "request" for me when the other person has written to me, I do not follow them, and I have never replied.
-- Replying or following the sender moves it to the normal inbox. Nothing is stored; this only reads. Idempotent.
create or replace function public.my_message_requests() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cm.chat_id
  from public.chat_members cm
  join public.chat_members o on o.chat_id = cm.chat_id and o.user_id <> cm.user_id
  where cm.user_id = auth.uid()
    and exists (select 1 from public.messages m where m.chat_id = cm.chat_id and m.sender_id = o.user_id)
    and not exists (select 1 from public.messages m where m.chat_id = cm.chat_id and m.sender_id = cm.user_id)
    and not exists (select 1 from public.followers f where f.follower_id = cm.user_id and f.following_id = o.user_id);
$$;
revoke execute on function public.my_message_requests() from public, anon;
grant execute on function public.my_message_requests() to authenticated;
