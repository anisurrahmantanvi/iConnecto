-- iConnecto 0016: a profile badge shown as a blue check next to the name.
-- Users cannot set it themselves: the update grant on profiles is column-limited (see 0001, 0011, 0012), so this column
-- is read-only for the app. It is set by the project owner in the SQL editor.
-- 'verified' = blue check. 'professional' is reserved for the later professional/public-figure badge.
alter table public.profiles add column if not exists badge text;
alter table public.profiles drop constraint if exists profiles_badge_check;
alter table public.profiles add constraint profiles_badge_check check (badge is null or badge in ('verified', 'professional'));
