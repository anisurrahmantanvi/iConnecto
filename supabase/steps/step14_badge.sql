-- Step 14: add the badge column, then give the blue check to the owner account.
alter table public.profiles add column if not exists badge text;
alter table public.profiles drop constraint if exists profiles_badge_check;
alter table public.profiles add constraint profiles_badge_check check (badge is null or badge in ('verified', 'professional'));

update public.profiles set badge = 'verified' where username = 'anisurrahmantanvi';

select username, badge from public.profiles where badge is not null;
