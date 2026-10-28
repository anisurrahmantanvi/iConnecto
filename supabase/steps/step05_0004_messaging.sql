-- iConnecto 0004: direct messaging (one-to-one)
-- Clients cannot create chats or memberships directly. Use get_or_create_dm(), which validates everything.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now()
);
alter table public.chats add column if not exists is_group boolean not null default false;
alter table public.chats add column if not exists last_message_at timestamptz;
alter table public.chats add column if not exists last_message_preview text;
alter table public.chats add column if not exists created_at timestamptz not null default now();
create index if not exists chats_last_message_idx on public.chats (last_message_at desc nulls last);

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
alter table public.chat_members add column if not exists last_read_at timestamptz not null default now();
alter table public.chat_members add column if not exists joined_at timestamptz not null default now();
create index if not exists chat_members_user_idx on public.chat_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
select public._ic_add_constraint('public.messages', 'messages_content_length',
  $$check (char_length(btrim(content)) between 1 and 4000) not valid$$);
create index if not exists messages_chat_created_idx on public.messages (chat_id, created_at desc);

create or replace function public.is_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members where chat_id = p_chat and user_id = auth.uid());
$$;

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chats
     set last_message_at = new.created_at,
         last_message_preview = left(new.content, 140)
   where id = new.chat_id;
  update public.chat_members set last_read_at = new.created_at
   where chat_id = new.chat_id and user_id = new.sender_id;
  return null;
end $$;
drop trigger if exists messages_after_insert_trg on public.messages;
create trigger messages_after_insert_trg after insert on public.messages
for each row execute function public.messages_after_insert();

create or replace function public.get_or_create_dm(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_chat uuid;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_other is null or p_other = v_me then raise exception 'invalid recipient'; end if;
  if not exists (select 1 from public.profiles where id = p_other) then raise exception 'user not found'; end if;
  if public.is_blocked_between(v_me, p_other) then raise exception 'messaging is not available'; end if;

  perform pg_advisory_xact_lock(hashtext(least(v_me::text, p_other::text) || greatest(v_me::text, p_other::text)));

  select c.id into v_chat
  from public.chats c
  where not c.is_group
    and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = v_me)
    and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = p_other)
  limit 1;

  if v_chat is null then
    insert into public.chats default values returning id into v_chat;
    insert into public.chat_members (chat_id, user_id) values (v_chat, v_me), (v_chat, p_other);
  end if;
  return v_chat;
end $$;

create or replace function public.mark_chat_read(p_chat uuid) returns void
language sql security definer set search_path = public as $$
  update public.chat_members set last_read_at = now()
  where chat_id = p_chat and user_id = auth.uid();
$$;

create or replace function public.my_chats()
returns table (
  chat_id uuid, other_id uuid, other_username text, other_display_name text, other_avatar_url text,
  last_message_at timestamptz, last_message_preview text, unread_count bigint
)
language sql stable security invoker set search_path = public as $$
  select c.id, o.user_id, p.username, p.display_name, p.avatar_url,
         c.last_message_at, c.last_message_preview,
         (select count(*) from public.messages m
           where m.chat_id = c.id and m.sender_id <> auth.uid() and m.created_at > me.last_read_at)
  from public.chat_members me
  join public.chats c on c.id = me.chat_id and not c.is_group
  join public.chat_members o on o.chat_id = c.id and o.user_id <> auth.uid()
  join public.profiles p on p.id = o.user_id
  where me.user_id = auth.uid() and c.last_message_at is not null
  order by c.last_message_at desc;
$$;

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;

revoke insert, update, delete on public.chats, public.chat_members, public.messages from anon, authenticated;
grant select on public.chats, public.chat_members to authenticated;
grant select, delete on public.messages to authenticated;
grant insert (chat_id, content) on public.messages to authenticated;

drop policy if exists chats_select_member on public.chats;
create policy chats_select_member on public.chats for select to authenticated using (public.is_chat_member(id));

drop policy if exists chat_members_select on public.chat_members;
create policy chat_members_select on public.chat_members for select to authenticated using (public.is_chat_member(chat_id));

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages for select to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_member(chat_id)
    and not exists (
      select 1 from public.chat_members cm
      where cm.chat_id = messages.chat_id and cm.user_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), cm.user_id)
    )
  );

drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages for delete to authenticated using (sender_id = auth.uid());

revoke execute on function public.get_or_create_dm(uuid) from public, anon;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;
revoke execute on function public.my_chats() from public, anon;
grant execute on function public.my_chats() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
