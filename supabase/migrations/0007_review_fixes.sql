-- iConnecto 0007: fixes and additions found while code-reviewing 0001-0006.
-- Non-destructive and idempotent. Earlier migrations are left untouched so databases that already ran them stay valid.
--
--   1. Private communities: the owner could not read back the row returned by INSERT ... RETURNING
--      (the owner-membership row is created by an AFTER trigger, so the SELECT policy rejected it).
--   2. make_username(): usernames were silently cut to 16 characters although the app and the
--      profiles_username_format constraint allow 20.
--   3. Media URL validation: posts, avatars and community images may only point at files the writer
--      uploaded to this project's own storage buckets (blocks hot-linked / tracking-pixel URLs).
--   4. delete_my_account(): lets a signed-in user delete their own account and all their data.

-- ---------------------------------------------------------------------------
-- 1. communities_select: include the owner
-- ---------------------------------------------------------------------------
drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities for select to authenticated
  using (not is_private or owner_id = auth.uid() or public.is_community_member(id));

-- ---------------------------------------------------------------------------
-- 2. make_username: honour the full 20 characters, keep room for a numeric suffix
-- ---------------------------------------------------------------------------
create or replace function public.make_username(p_seed text, p_uid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n integer := 0;
begin
  base := lower(regexp_replace(coalesce(p_seed, ''), '[^A-Za-z0-9_]', '', 'g'));
  if length(base) < 3 then
    base := 'user' || substr(replace(p_uid::text, '-', ''), 1, 6);
  end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = candidate) loop
    n := n + 1;
    candidate := left(base, 20 - length(n::text)) || n::text;
  end loop;
  return candidate;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Media URL validation (only when the column actually changes, so legacy rows stay editable)
-- ---------------------------------------------------------------------------
create or replace function public.validate_media_urls() returns trigger
language plpgsql set search_path = public as $$
declare
  u text;
begin
  if tg_table_name = 'posts' then
    if tg_op = 'INSERT' or new.media_urls is distinct from old.media_urls then
      foreach u in array coalesce(new.media_urls, '{}'::text[]) loop
        if u not like ('%/storage/v1/object/public/post-media/' || new.author_id::text || '/%') then
          raise exception 'invalid media url' using errcode = '23514';
        end if;
      end loop;
    end if;

  elsif tg_table_name = 'profiles' then
    if new.avatar_url is not null and (tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url) then
      if new.avatar_url not like ('%/storage/v1/object/public/avatars/' || new.id::text || '/%') then
        raise exception 'invalid avatar url' using errcode = '23514';
      end if;
    end if;

  elsif tg_table_name = 'communities' then
    -- auth.uid() is null for dashboard / service-role edits, which are trusted.
    if auth.uid() is not null and new.avatar_url is not null
       and (tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url) then
      if new.avatar_url not like ('%/storage/v1/object/public/community-images/' || auth.uid()::text || '/%') then
        raise exception 'invalid community image url' using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.validate_media_urls() from public, anon, authenticated;

drop trigger if exists posts_media_check on public.posts;
create trigger posts_media_check before insert or update on public.posts
for each row execute function public.validate_media_urls();

drop trigger if exists profiles_avatar_check on public.profiles;
create trigger profiles_avatar_check before insert or update on public.profiles
for each row execute function public.validate_media_urls();

drop trigger if exists communities_avatar_check on public.communities;
create trigger communities_avatar_check before insert or update on public.communities
for each row execute function public.validate_media_urls();

-- ---------------------------------------------------------------------------
-- 4. Self-service account deletion
--    Everything the user owns cascades from auth.users -> profiles. Files in Storage are NOT removed by SQL
--    (Supabase stores the objects outside the database); the app removes known files before calling this.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
