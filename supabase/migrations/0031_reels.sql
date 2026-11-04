-- iConnecto 0031: Reels (short videos). Own tables; does not touch existing ones. Idempotent.
-- Free-plan friendly: videos up to 25 MB and 60 seconds, no server-side processing.

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  video_url text not null check (char_length(video_url) <= 600),
  caption text not null default '' check (char_length(caption) <= 300),
  duration_s smallint check (duration_s is null or duration_s between 1 and 90),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists reels_feed_idx on public.reels (created_at desc);
create index if not exists reels_author_idx on public.reels (author_id, created_at desc);

create table if not exists public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);
create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists reel_comments_idx on public.reel_comments (reel_id, created_at);

alter table public.reels enable row level security;
alter table public.reel_likes enable row level security;
alter table public.reel_comments enable row level security;
revoke all on public.reels, public.reel_likes, public.reel_comments from anon, authenticated;

grant select, delete on public.reels to authenticated;
grant insert (video_url, caption, duration_s) on public.reels to authenticated;
drop policy if exists reels_select on public.reels;
create policy reels_select on public.reels for select to authenticated using (
  author_id = auth.uid()
  or not exists (select 1 from public.blocks b
                 where (b.blocker_id = auth.uid() and b.blocked_id = reels.author_id)
                    or (b.blocker_id = reels.author_id and b.blocked_id = auth.uid())));
drop policy if exists reels_insert on public.reels;
create policy reels_insert on public.reels for insert to authenticated with check (
  author_id = auth.uid() and position('/reel-videos/' || auth.uid()::text || '/' in video_url) > 0);
drop policy if exists reels_delete on public.reels;
create policy reels_delete on public.reels for delete to authenticated using (author_id = auth.uid());

grant select, insert, delete on public.reel_likes to authenticated;
drop policy if exists reel_likes_select on public.reel_likes;
create policy reel_likes_select on public.reel_likes for select to authenticated using (user_id = auth.uid());
drop policy if exists reel_likes_insert on public.reel_likes;
create policy reel_likes_insert on public.reel_likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.reels r where r.id = reel_id));
drop policy if exists reel_likes_delete on public.reel_likes;
create policy reel_likes_delete on public.reel_likes for delete to authenticated using (user_id = auth.uid());

grant select, delete on public.reel_comments to authenticated;
grant insert (reel_id, content) on public.reel_comments to authenticated;
drop policy if exists reel_comments_select on public.reel_comments;
create policy reel_comments_select on public.reel_comments for select to authenticated
  using (exists (select 1 from public.reels r where r.id = reel_id));
drop policy if exists reel_comments_insert on public.reel_comments;
create policy reel_comments_insert on public.reel_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.reels r where r.id = reel_id));
drop policy if exists reel_comments_delete on public.reel_comments;
create policy reel_comments_delete on public.reel_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.reels r where r.id = reel_id and r.author_id = auth.uid()));

-- Counters are owned by the server.
create or replace function public.reel_counts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'reel_likes' then
    if tg_op = 'INSERT' then update public.reels set like_count = like_count + 1 where id = new.reel_id;
    else update public.reels set like_count = greatest(like_count - 1, 0) where id = old.reel_id; end if;
  else
    if tg_op = 'INSERT' then update public.reels set comment_count = comment_count + 1 where id = new.reel_id;
    else update public.reels set comment_count = greatest(comment_count - 1, 0) where id = old.reel_id; end if;
  end if;
  return null;
end $$;
drop trigger if exists reel_likes_count on public.reel_likes;
create trigger reel_likes_count after insert or delete on public.reel_likes for each row execute function public.reel_counts();
drop trigger if exists reel_comments_count on public.reel_comments;
create trigger reel_comments_count after insert or delete on public.reel_comments for each row execute function public.reel_counts();

create or replace function public.reel_view(p_reel uuid) returns void
language sql security definer set search_path = public as $$
  update public.reels set view_count = view_count + 1 where id = p_reel;
$$;
revoke execute on function public.reel_view(uuid) from public, anon;
grant execute on function public.reel_view(uuid) to authenticated;

-- Video files (public bucket, own folder only, up to 25 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('reel-videos', 'reel-videos', true, 26214400, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 26214400, allowed_mime_types = array['video/mp4','video/webm','video/quicktime'];
do $$
declare b text := 'reel-videos';
begin
  execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
  execute format($p$create policy %I on storage.objects for insert to authenticated
    with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_insert_own', b);
  execute format('drop policy if exists %I on storage.objects', b || '_delete_own');
  execute format($p$create policy %I on storage.objects for delete to authenticated
    using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_delete_own', b);
end $$;
