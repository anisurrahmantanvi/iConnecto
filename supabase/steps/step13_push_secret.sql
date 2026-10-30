-- STEP 13: run AFTER step 12f (push). Replace PASTE_YOUR_LONG_RANDOM_TEXT_HERE with a long random text of your own
-- (for example 40+ random letters and numbers). Use EXACTLY the same text for the Edge Function secret PUSH_WEBHOOK_SECRET.
insert into public.app_private (key, value) values ('push_secret', 'PASTE_YOUR_LONG_RANDOM_TEXT_HERE')
on conflict (key) do update set value = excluded.value;
