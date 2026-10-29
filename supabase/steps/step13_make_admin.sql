-- Run AFTER step12 and after your account exists. Makes this one account the Reels admin.
insert into public.app_admins (user_id)
select id from auth.users where email = 'anisurrahmantanvi@gmail.com'
on conflict do nothing;

-- Shows one row if it worked (admin_count = 1).
select count(*) as admin_count from public.app_admins;
