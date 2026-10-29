-- iConnecto 0011: profile cover photo.
-- Adds profiles.cover_url, lets users update it (column-level grant, like avatar_url) and creates the public "covers" bucket
-- with the same "own folder only" write policies as the other image buckets. Idempotent and non-destructive.

alter table public.profiles add column if not exists cover_url text;
grant update (cover_url) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('covers', 'covers', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  b text := 'covers';
begin
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
end $$;
