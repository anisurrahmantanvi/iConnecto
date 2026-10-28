-- STEP 11 (read-only): run after step 10. Copy the single "report" cell back to check the setup.
-- Expected:
--   tables_without_rls ............ []   (every table has Row Level Security on)
--   policies_open_to_anon_or_public  []   (signed-out visitors have no table access)
--   app_tables_missing ............ []
--   signup_trigger ................ ["on_auth_user_created"]
--   realtime_tables ............... messages, notifications, call_sessions, call_signals
--   storage_buckets ............... avatars, post-media, community-images
select jsonb_pretty(jsonb_build_object(
  'tables_without_rls', (select coalesce(jsonb_agg(c.relname), '[]'::jsonb)
      from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity),
  'policies_open_to_anon_or_public', (select coalesce(jsonb_agg(tablename || '.' || policyname), '[]'::jsonb)
      from pg_policies where schemaname = 'public' and (roles && array['anon', 'public']::name[])),
  'app_tables_missing', (select coalesce(jsonb_agg(t), '[]'::jsonb)
      from unnest(array['profiles','posts','comments','post_likes','comment_likes','followers','saved_posts','shares',
        'post_reactions','chats','chat_members','messages','notifications','communities','community_members',
        'reports','blocks','call_sessions','call_signals']) t where to_regclass('public.' || t) is null),
  'policy_count_public', (select count(*) from pg_policies where schemaname = 'public'),
  'signup_trigger', (select coalesce(jsonb_agg(tgname), '[]'::jsonb)
      from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal),
  'realtime_tables', (select coalesce(jsonb_agg(tablename), '[]'::jsonb)
      from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'),
  'storage_buckets', (select coalesce(jsonb_agg(id), '[]'::jsonb) from storage.buckets),
  'storage_policies', (select coalesce(jsonb_agg(policyname), '[]'::jsonb) from pg_policies where schemaname = 'storage')
)) as report;
