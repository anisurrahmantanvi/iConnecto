-- iConnecto 0006: storage buckets + policies, and hardening for the anonymous role

-- ---------------------------------------------------------------------------
-- Buckets (public read via URL; writes restricted to the uploader's own folder "<user-id>/...")
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',          'avatars',          true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('post-media',       'post-media',       true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('community-images', 'community-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  b text;
begin
  foreach b in array array['avatars', 'post-media', 'community-images'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
    execute format($p$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_insert_own', b);

    execute format('drop policy if exists %I on storage.objects', b || '_select_own');
    execute format($p$create policy %I on storage.objects for select to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_select_own', b);

    execute format('drop policy if exists %I on storage.objects', b || '_update_own');
    execute format($p$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_update_own', b, b);

    execute format('drop policy if exists %I on storage.objects', b || '_delete_own');
    execute format($p$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_delete_own', b);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The app requires sign-in: remove any table access for the anonymous role on iConnecto tables.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','posts','comments','post_likes','comment_likes','followers','saved_posts','shares',
    'post_reactions','chats','chat_members','messages','notifications','communities',
    'community_members','reports','blocks','call_sessions','call_signals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon', t);
    end if;
  end loop;
end $$;
