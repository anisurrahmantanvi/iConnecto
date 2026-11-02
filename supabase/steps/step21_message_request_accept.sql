-- Message requests: explicit Accept. Idempotent and non-destructive.
create table if not exists public.chat_request_accepts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);
alter table public.chat_request_accepts enable row level security;
revoke all on public.chat_request_accepts from anon, authenticated;

create or replace function public.accept_message_request(p_chat uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_chat_member(p_chat) then raise exception 'Chat not found'; end if;
  insert into public.chat_request_accepts (user_id, chat_id) values (auth.uid(), p_chat) on conflict do nothing;
end $$;
revoke execute on function public.accept_message_request(uuid) from public, anon;
grant execute on function public.accept_message_request(uuid) to authenticated;

create or replace function public.my_message_requests() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cm.chat_id
  from public.chat_members cm
  join public.chat_members o on o.chat_id = cm.chat_id and o.user_id <> cm.user_id
  where cm.user_id = auth.uid()
    and exists (select 1 from public.messages m where m.chat_id = cm.chat_id and m.sender_id = o.user_id)
    and not exists (select 1 from public.messages m where m.chat_id = cm.chat_id and m.sender_id = cm.user_id)
    and not exists (select 1 from public.friendships f where f.user_id = cm.user_id and f.friend_id = o.user_id)
    and not exists (select 1 from public.chat_request_accepts a where a.user_id = cm.user_id and a.chat_id = cm.chat_id);
$$;
revoke execute on function public.my_message_requests() from public, anon;
grant execute on function public.my_message_requests() to authenticated;
