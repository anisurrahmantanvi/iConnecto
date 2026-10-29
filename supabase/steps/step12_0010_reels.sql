-- iConnecto 0010: curated Reels (embedded TikTok videos chosen by an admin).
--
-- Only an admin (a row in app_admins) can add or remove reels. Every signed-in user can read them. Signed-out callers get nothing.
-- No video files are stored: a reel is just the TikTok link plus a little metadata, and the app embeds TikTok's own player.
-- Idempotent: safe to run again.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- No policies and no grants: nobody can read or change this table through the API. Admin status is only exposed through is_admin().
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  video_id text not null unique check (video_id ~ '^[0-9]{5,25}$'),
  tiktok_url text not null check (tiktok_url ~ '^https://(www\.)?tiktok\.com/@[^/]+/video/[0-9]+$' and length(tiktok_url) <= 300),
  title text check (title is null or length(title) <= 300),
  author_name text check (author_name is null or length(author_name) <= 100),
  thumbnail_url text check (thumbnail_url is null or (thumbnail_url ~ '^https://' and length(thumbnail_url) <= 1000)),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists reels_created_idx on public.reels (created_at desc);
alter table public.reels enable row level security;

drop policy if exists reels_select on public.reels;
create policy reels_select on public.reels for select to authenticated using (true);
drop policy if exists reels_insert on public.reels;
create policy reels_insert on public.reels for insert to authenticated with check (public.is_admin());
drop policy if exists reels_delete on public.reels;
create policy reels_delete on public.reels for delete to authenticated using (public.is_admin());

revoke all on public.reels from anon, authenticated;
grant select on public.reels to authenticated;
grant insert (video_id, tiktok_url, title, author_name, thumbnail_url) on public.reels to authenticated;
grant delete on public.reels to authenticated;
