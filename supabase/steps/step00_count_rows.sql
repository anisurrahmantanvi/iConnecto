-- STEP 0 (optional, read-only): how much data is in the old tables?
-- If every number is 0 (or only test data), the reset in step 1 loses nothing you care about.
select 'auth.users (kept by the reset)' as table_name, count(*) as rows from auth.users
union all select 'profiles', count(*) from public.profiles
union all select 'posts', count(*) from public.posts
union all select 'comments', count(*) from public.comments
union all select 'post_likes', count(*) from public.post_likes
union all select 'comment_likes', count(*) from public.comment_likes
union all select 'followers', count(*) from public.followers
union all select 'saved_posts', count(*) from public.saved_posts
union all select 'shares', count(*) from public.shares
union all select 'communities', count(*) from public.communities
union all select 'community_members', count(*) from public.community_members
union all select 'chats', count(*) from public.chats
union all select 'chat_members', count(*) from public.chat_members
union all select 'messages', count(*) from public.messages
union all select 'notifications', count(*) from public.notifications
union all select 'reports', count(*) from public.reports
union all select 'blocks', count(*) from public.blocks
union all select 'call_sessions', count(*) from public.call_sessions;
