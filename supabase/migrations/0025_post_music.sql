-- Music on posts: user-uploaded audio + an owner-managed library. Idempotent and non-destructive.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('post-audio', 'post-audio', true, 8388608, array['audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/webm','audio/x-m4a'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/webm','audio/x-m4a'];

do $$
declare b text := 'post-audio';
begin
  execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
  execute format($p$create policy %I on storage.objects for insert to authenticated
    with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_insert_own', b);
  execute format('drop policy if exists %I on storage.objects', b || '_delete_own');
  execute format($p$create policy %I on storage.objects for delete to authenticated
    using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_delete_own', b);
end $$;

create table if not exists public.post_audio (
  post_id uuid primary key references public.posts(id) on delete cascade,
  audio_url text not null,
  title text not null default 'Original audio',
  artist text,
  source text not null default 'upload' check (source in ('upload','library')),
  created_at timestamptz not null default now()
);
alter table public.post_audio enable row level security;
revoke all on public.post_audio from anon, authenticated;
grant select, insert on public.post_audio to authenticated;
drop policy if exists post_audio_select on public.post_audio;
create policy post_audio_select on public.post_audio for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists post_audio_insert on public.post_audio;
create policy post_audio_insert on public.post_audio for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- Tracks the app owner has the right to offer. Only the owner adds rows (SQL editor); everyone signed in can read active ones.
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  language text,
  license text not null,
  source_url text,
  audio_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.music_tracks enable row level security;
revoke all on public.music_tracks from anon, authenticated;
grant select on public.music_tracks to authenticated;
drop policy if exists music_tracks_select on public.music_tracks;
create policy music_tracks_select on public.music_tracks for select to authenticated using (active);
