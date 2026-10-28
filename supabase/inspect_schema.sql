-- iConnecto: READ-ONLY schema inspection. Run this in the Supabase SQL editor BEFORE the migrations.
-- It changes nothing. Compare the output with supabase/README.md ("Expected columns").

-- 1) Tables and columns that already exist
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles','posts','comments','post_likes','comment_likes','followers','saved_posts','shares',
    'post_reactions','chats','chat_members','messages','notifications','communities',
    'community_members','reports','blocks','call_sessions','call_signals'
  )
order by table_name, ordinal_position;

-- 2) Constraints
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
order by 1, 2;

-- 3) Triggers
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema in ('public','auth')
order by 1, 2;

-- 4) RLS status and policies
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by 1;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public','storage')
order by tablename, policyname;

-- 5) Views and functions
select table_name as view_name from information_schema.views where table_schema = 'public';
select routine_name from information_schema.routines where routine_schema = 'public' order by 1;

-- 6) Storage buckets
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets;
