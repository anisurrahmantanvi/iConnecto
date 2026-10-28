-- iConnecto: database security & behaviour smoke tests.
--
-- WHAT IT DOES
--   Creates five throw-away users, then impersonates them (role "authenticated" + a fake JWT subject) to check that
--   Row Level Security, column grants, triggers and the helper functions behave as intended. Everything runs inside one
--   transaction that is ROLLED BACK at the end, so no data is kept.
--
-- HOW TO RUN
--   Prerequisite: migrations 0001..0009 are applied.
--   * Supabase dashboard -> SQL editor -> paste this whole file -> Run. The result grid shows "ALL PASSED" or the failures.
--   * Or: psql "$DATABASE_URL" -f supabase/tests/rls_smoke.sql
--   Run it on a development / staging project. It only writes inside a transaction that is rolled back, but it does
--   insert rows into auth.users temporarily, so do not run it against production.
--
-- WHAT IT DOES NOT COVER
--   Realtime delivery, Storage HTTP behaviour (only the policies on storage.objects), Auth e-mail flows, and anything in the browser.

begin;

-- ---------------------------------------------------------------------------
-- tiny test harness (lives only inside this transaction)
-- ---------------------------------------------------------------------------
create table public._t_results (n serial primary key, name text not null, ok boolean not null, detail text);
grant all on public._t_results to authenticated, anon;
grant usage, select on sequence public._t_results_n_seq to authenticated, anon;

create function public._t_uid(p_name text) returns uuid language sql immutable as $$
  select (case p_name
    when 'alice' then '00000000-0000-4000-8000-00000000000a'
    when 'bob'   then '00000000-0000-4000-8000-00000000000b'
    when 'carol' then '00000000-0000-4000-8000-00000000000c'
    when 'dave'  then '00000000-0000-4000-8000-00000000000d'
    when 'erin'  then '00000000-0000-4000-8000-00000000000e'
    when 'frank' then '00000000-0000-4000-8000-00000000000f'
  end)::uuid
$$;

create function public._t_reset() returns void language plpgsql as $$
begin
  execute 'reset role';
end $$;

create function public._t_as(p_name text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', public._t_uid(p_name), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function public._t_as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create function public._t_record(p_name text, p_ok boolean, p_detail text default null) returns void language sql as $$
  insert into public._t_results (name, ok, detail) values (p_name, p_ok, p_detail)
$$;

-- statement must succeed
create function public._t_ok(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  perform public._t_record(p_name, true);
exception when others then
  perform public._t_record(p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- statement must fail with exactly this SQLSTATE (42501 = permission denied / RLS, 23505 = duplicate, 23514 = check, P0001 = raise)
create function public._t_denied(p_name text, p_sql text, p_state text) returns void language plpgsql as $$
begin
  execute p_sql;
  perform public._t_record(p_name, false, 'expected error ' || p_state || ' but the statement succeeded');
exception when others then
  perform public._t_record(p_name, sqlstate = p_state,
    case when sqlstate = p_state then null else 'expected ' || p_state || ', got ' || sqlstate || ': ' || sqlerrm end);
end $$;

-- UPDATE/DELETE must touch exactly N rows (rows hidden by RLS count as 0)
create function public._t_rows(p_name text, p_sql text, p_expected int) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  perform public._t_record(p_name, n = p_expected, case when n = p_expected then null else 'affected ' || n || ' rows, expected ' || p_expected end);
exception when others then
  perform public._t_record(p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- scalar query must equal the expected text
create function public._t_eq(p_name text, p_sql text, p_expected text) returns void language plpgsql as $$
declare r text;
begin
  execute p_sql into r;
  perform public._t_record(p_name, r is not distinct from p_expected,
    case when r is not distinct from p_expected then null else 'got ' || coalesce(r, '<null>') || ', expected ' || coalesce(p_expected, '<null>') end);
exception when others then
  perform public._t_record(p_name, false, sqlstate || ': ' || sqlerrm);
end $$;

-- ---------------------------------------------------------------------------
-- fixtures (as the admin role): the signup trigger must create the profiles
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  (public._t_uid('alice'), 'alice@test.local', '{"username":"alice","display_name":"Alice"}'),
  (public._t_uid('bob'),   'bob@test.local',   '{"username":"bob"}'),
  (public._t_uid('carol'), 'carol@test.local', '{"username":"carol"}'),
  (public._t_uid('dave'),  'dave@test.local',  '{}'),
  (public._t_uid('erin'),  'erin@test.local',  '{"username":"ALICE"}'),
  (public._t_uid('frank'), 'frank@test.local', '{"username":"abcdefghij0123456789"}');

-- ===========================================================================
-- A. Sign-up trigger, profiles
-- ===========================================================================
select public._t_eq('A1 signup trigger creates the profile with the requested username',
  $q$select username from public.profiles where id = public._t_uid('alice')$q$, 'alice');
select public._t_eq('A2 case-insensitive username collision gets a numeric suffix',
  $q$select username from public.profiles where id = public._t_uid('erin')$q$, 'alice1');
select public._t_eq('A3 username falls back to the e-mail local part',
  $q$select username from public.profiles where id = public._t_uid('dave')$q$, 'dave');
select public._t_eq('A4 a 20-character username is kept intact (0007)',
  $q$select username from public.profiles where id = public._t_uid('frank')$q$, 'abcdefghij0123456789');
select public._t_eq('A5 display name defaults from metadata',
  $q$select display_name from public.profiles where id = public._t_uid('alice')$q$, 'Alice');

select public._t_as('dave');
select public._t_eq('A6 username_available is false when taken (case-insensitive)',
  $q$select public.username_available('ALICE')::text$q$, 'false');
select public._t_eq('A7 username_available is true when free',
  $q$select public.username_available('zed_99')::text$q$, 'true');
select public._t_eq('A8 username_available is false for invalid names',
  $q$select public.username_available('a b')::text$q$, 'false');
select public._t_rows('A9 cannot update another user''s profile',
  $q$update public.profiles set bio = 'hacked' where id = public._t_uid('alice')$q$, 0);
select public._t_denied('A10 cannot write follower counters',
  $q$update public.profiles set followers_count = 999 where id = public._t_uid('dave')$q$, '42501');
select public._t_denied('A11 cannot insert a profile directly',
  $q$insert into public.profiles (id, username) values (gen_random_uuid(), 'sneaky')$q$, '42501');
select public._t_rows('A12 can update own bio',
  $q$update public.profiles set bio = 'hi' where id = public._t_uid('dave')$q$, 1);
select public._t_denied('A13 invalid username format rejected',
  $q$update public.profiles set username = 'no spaces' where id = public._t_uid('dave')$q$, '23514');
select public._t_denied('A14 duplicate username rejected',
  $q$update public.profiles set username = 'ALICE' where id = public._t_uid('dave')$q$, '23505');
select public._t_denied('A15 avatar must be an own storage file (0007)',
  $q$update public.profiles set avatar_url = 'https://evil.example/x.png' where id = public._t_uid('dave')$q$, '23514');
select public._t_ok('A16 avatar inside own folder accepted',
  format($q$update public.profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/%s/a.webp' where id = public._t_uid('dave')$q$, public._t_uid('dave')));
select public._t_denied('A17 avatar inside someone else''s folder rejected',
  format($q$update public.profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/%s/a.webp' where id = public._t_uid('dave')$q$, public._t_uid('bob')), '23514');
select public._t_reset();

-- ===========================================================================
-- B. Posts
-- ===========================================================================
select public._t_as('alice');
select public._t_ok('B1 create a post',
  $q$insert into public.posts (content) values ('hello from alice') returning id$q$);
select public._t_denied('B2 cannot spoof author_id',
  format($q$insert into public.posts (content, author_id) values ('spoof', %L)$q$, public._t_uid('bob')), '42501');
select public._t_denied('B3 cannot write counters on insert',
  $q$insert into public.posts (content, like_count) values ('x', 99)$q$, '42501');
select public._t_denied('B4 blank post rejected',
  $q$insert into public.posts (content) values ('   ')$q$, '23514');
select public._t_denied('B5 foreign media URL rejected (0007)',
  $q$insert into public.posts (content, media_urls) values ('pic', array['https://evil.example/t.png'])$q$, '23514');
select public._t_ok('B6 own media URL accepted',
  format($q$insert into public.posts (content, media_urls) values ('pic', array['https://p.supabase.co/storage/v1/object/public/post-media/%s/1.webp'])$q$, public._t_uid('alice')));
select public._t_reset();
select public._t_eq('B7 posts_count is maintained by a trigger',
  $q$select posts_count::text from public.profiles where id = public._t_uid('alice')$q$, '2');
select public._t_as('bob');
select public._t_rows('B8 other users cannot edit a post',
  $q$update public.posts set content = 'defaced' where content = 'hello from alice'$q$, 0);
select public._t_rows('B9 other users cannot delete a post',
  $q$delete from public.posts where content = 'hello from alice'$q$, 0);
select public._t_eq('B10 posts are readable by other signed-in users',
  $q$select count(*)::text from public.posts where content = 'hello from alice'$q$, '1');
select public._t_reset();

-- ===========================================================================
-- C. Likes, emoji reactions, saves
-- ===========================================================================
select public._t_as('bob');
select public._t_ok('C1 like a post',
  $q$insert into public.post_likes (post_id) select id from public.posts where content = 'hello from alice'$q$);
select public._t_denied('C2 duplicate like rejected',
  $q$insert into public.post_likes (post_id) select id from public.posts where content = 'hello from alice'$q$, '23505');
select public._t_denied('C3 cannot like as another user',
  format($q$insert into public.post_likes (post_id, user_id) select id, %L from public.posts where content = 'hello from alice'$q$, public._t_uid('carol')), '42501');
select public._t_reset();
select public._t_eq('C4 like_count is 1',
  $q$select like_count::text from public.posts where content = 'hello from alice'$q$, '1');
select public._t_eq('C5 author got exactly one like notification',
  $q$select count(*)::text from public.notifications where recipient_id = public._t_uid('alice') and type = 'like' and actor_id = public._t_uid('bob')$q$, '1');
select public._t_as('bob');
select public._t_ok('C6 unlike', $q$delete from public.post_likes where user_id = auth.uid()$q$);
select public._t_reset();
select public._t_eq('C7 like_count back to 0',
  $q$select like_count::text from public.posts where content = 'hello from alice'$q$, '0');
select public._t_as('bob');
select public._t_ok('C8 like again',
  $q$insert into public.post_likes (post_id) select id from public.posts where content = 'hello from alice'$q$);
select public._t_reset();
select public._t_eq('C9 like / unlike / like does not duplicate the notification',
  $q$select count(*)::text from public.notifications where recipient_id = public._t_uid('alice') and type = 'like' and actor_id = public._t_uid('bob')$q$, '1');
select public._t_as('bob');
select public._t_ok('C10 emoji reaction',
  $q$insert into public.post_reactions (post_id, emoji) select id, '🔥' from public.posts where content = 'hello from alice'$q$);
select public._t_denied('C11 plain text is not a valid reaction',
  $q$insert into public.post_reactions (post_id, emoji) select id, 'abc' from public.posts where content = 'hello from alice'$q$, '23514');
select public._t_denied('C12 duplicate emoji reaction rejected',
  $q$insert into public.post_reactions (post_id, emoji) select id, '🔥' from public.posts where content = 'hello from alice'$q$, '23505');
select public._t_eq('C13 reaction summary counts the reaction',
  $q$select reaction_count::text from public.post_reaction_summary(array(select id from public.posts where content = 'hello from alice')) where emoji = '🔥'$q$, '1');
select public._t_ok('C14 save a post',
  $q$insert into public.saved_posts (post_id) select id from public.posts where content = 'hello from alice'$q$);
select public._t_as('alice');
select public._t_eq('C15 other users cannot see someone''s saved posts',
  $q$select count(*)::text from public.saved_posts$q$, '0');
select public._t_eq('C16 other users cannot see someone''s like rows',
  $q$select count(*)::text from public.post_likes$q$, '0');
select public._t_reset();

-- ===========================================================================
-- D. Comments and replies
-- ===========================================================================
select public._t_as('bob');
select public._t_ok('D1 comment on a post',
  $q$insert into public.comments (post_id, content) select id, 'nice post' from public.posts where content = 'hello from alice' returning id$q$);
select public._t_denied('D2 empty comment rejected',
  $q$insert into public.comments (post_id, content) select id, '  ' from public.posts where content = 'hello from alice'$q$, '23514');
select public._t_denied('D3 cannot comment as someone else',
  format($q$insert into public.comments (post_id, content, author_id) select id, 'x', %L from public.posts where content = 'hello from alice'$q$, public._t_uid('carol')), '42501');
select public._t_reset();
select public._t_eq('D4 comment_count is 1',
  $q$select comment_count::text from public.posts where content = 'hello from alice'$q$, '1');
select public._t_eq('D5 post author is notified of the comment',
  $q$select count(*)::text from public.notifications where recipient_id = public._t_uid('alice') and type = 'comment'$q$, '1');
select public._t_as('alice');
select public._t_ok('D6 reply to a comment',
  $q$insert into public.comments (post_id, parent_id, content) select post_id, id, 'thanks!' from public.comments where content = 'nice post'$q$);
select public._t_denied('D7 replies deeper than one level are rejected',
  $q$insert into public.comments (post_id, parent_id, content) select post_id, id, 'too deep' from public.comments where content = 'thanks!'$q$, 'P0001');
select public._t_reset();
select public._t_eq('D8 reply_count is maintained',
  $q$select reply_count::text from public.comments where content = 'nice post'$q$, '1');
select public._t_eq('D9 comment author is notified of the reply',
  $q$select count(*)::text from public.notifications where recipient_id = public._t_uid('bob') and type = 'reply'$q$, '1');
select public._t_as('carol');
select public._t_rows('D10 a stranger cannot edit a comment',
  $q$update public.comments set content = 'x' where content = 'nice post'$q$, 0);
select public._t_rows('D11 a stranger cannot delete a comment',
  $q$delete from public.comments where content = 'nice post'$q$, 0);
select public._t_as('bob');
select public._t_rows('D12 a commenter cannot delete the post owner''s reply',
  $q$delete from public.comments where content = 'thanks!'$q$, 0);
select public._t_rows('D13 an author can edit their own comment',
  $q$update public.comments set content = 'nice post!' where content = 'nice post'$q$, 1);
select public._t_ok('D14 comment like',
  $q$insert into public.comment_likes (comment_id) select id from public.comments where content = 'nice post!'$q$);
select public._t_denied('D15 duplicate comment like rejected',
  $q$insert into public.comment_likes (comment_id) select id from public.comments where content = 'nice post!'$q$, '23505');
select public._t_as('alice');
select public._t_rows('D16 the post owner can delete anyone''s comment (replies cascade)',
  $q$delete from public.comments where content = 'nice post!'$q$, 1);
select public._t_reset();
select public._t_eq('D17 counters return to zero after the cascade',
  $q$select comment_count::text from public.posts where content = 'hello from alice'$q$, '0');

-- ===========================================================================
-- E. Follows
-- ===========================================================================
select public._t_as('bob');
select public._t_ok('E1 follow a user',
  $q$insert into public.followers (following_id) values (public._t_uid('alice'))$q$);
select public._t_denied('E2 duplicate follow rejected',
  $q$insert into public.followers (following_id) values (public._t_uid('alice'))$q$, '23505');
select public._t_denied('E3 cannot follow yourself',
  $q$insert into public.followers (following_id) values (auth.uid())$q$, '23514');
select public._t_denied('E4 cannot create a follow row for someone else',
  format($q$insert into public.followers (follower_id, following_id) values (%L, %L)$q$, public._t_uid('carol'), public._t_uid('alice')), '42501');
select public._t_reset();
select public._t_eq('E5 followers_count is maintained',
  $q$select followers_count::text from public.profiles where id = public._t_uid('alice')$q$, '1');
select public._t_eq('E6 following_count is maintained',
  $q$select following_count::text from public.profiles where id = public._t_uid('bob')$q$, '1');
select public._t_eq('E7 follow notification created',
  $q$select count(*)::text from public.notifications where recipient_id = public._t_uid('alice') and type = 'follow'$q$, '1');
select public._t_as('bob');
select public._t_ok('E8 unfollow', $q$delete from public.followers where follower_id = auth.uid()$q$);
select public._t_reset();
select public._t_eq('E9 counts are decremented',
  $q$select followers_count::text from public.profiles where id = public._t_uid('alice')$q$, '0');

-- ===========================================================================
-- F. Direct messages
-- ===========================================================================
select public._t_as('alice');
select public._t_ok('F1 open a DM with bob', $q$select public.get_or_create_dm(public._t_uid('bob'))$q$);
select public._t_reset();
select set_config('t.chat', (select chat_id::text from public.chat_members where user_id = public._t_uid('alice') limit 1), false);
-- all statements share one transaction (one now()), so move bob's read marker back to make "unread" observable
update public.chat_members set last_read_at = now() - interval '1 hour' where user_id = public._t_uid('bob');
select public._t_as('alice');
select public._t_eq('F2 asking again returns the same chat',
  $q$select (public.get_or_create_dm(public._t_uid('bob')) = current_setting('t.chat')::uuid)::text$q$, 'true');
select public._t_denied('F3 cannot DM yourself', $q$select public.get_or_create_dm(auth.uid())$q$, 'P0001');
select public._t_ok('F4 send a message',
  $q$insert into public.messages (chat_id, content) values (current_setting('t.chat')::uuid, 'hi bob') returning id$q$);
select public._t_denied('F5 cannot send as someone else',
  format($q$insert into public.messages (chat_id, content, sender_id) values (current_setting('t.chat')::uuid, 'x', %L)$q$, public._t_uid('bob')), '42501');
select public._t_denied('F6 cannot create chats directly', $q$insert into public.chats default values$q$, '42501');
select public._t_denied('F7 cannot add chat members directly',
  format($q$insert into public.chat_members (chat_id, user_id) values (current_setting('t.chat')::uuid, %L)$q$, public._t_uid('carol')), '42501');
select public._t_as('carol');
select public._t_eq('F8 a stranger cannot see the chat', $q$select count(*)::text from public.chats$q$, '0');
select public._t_eq('F9 a stranger cannot read the messages', $q$select count(*)::text from public.messages$q$, '0');
select public._t_eq('F10 a stranger cannot see the memberships', $q$select count(*)::text from public.chat_members$q$, '0');
select public._t_denied('F11 a stranger cannot send into the chat',
  $q$insert into public.messages (chat_id, content) values (current_setting('t.chat')::uuid, 'intrude')$q$, '42501');
select public._t_eq('F12 a stranger has no conversations',
  $q$select count(*)::text from public.my_chats()$q$, '0');
select public._t_as('bob');
select public._t_eq('F13 the recipient can read the message',
  $q$select count(*)::text from public.messages where content = 'hi bob'$q$, '1');
select public._t_eq('F14 unread_count is 1 for the recipient',
  $q$select unread_count::text from public.my_chats()$q$, '1');
select public._t_ok('F15 mark as read', $q$select public.mark_chat_read(current_setting('t.chat')::uuid)$q$);
select public._t_eq('F16 unread_count cleared',
  $q$select unread_count::text from public.my_chats()$q$, '0');
select public._t_denied('F17 messages cannot be edited', $q$update public.messages set content = 'x'$q$, '42501');
select public._t_rows('F18 the recipient cannot delete the sender''s messages',
  $q$delete from public.messages where content = 'hi bob'$q$, 0);
select public._t_reset();

-- ===========================================================================
-- G. Notifications
-- ===========================================================================
select public._t_as('bob');
select public._t_eq('G1 cannot read another user''s notifications',
  $q$select count(*)::text from public.notifications where recipient_id = public._t_uid('alice')$q$, '0');
select public._t_denied('G2 cannot insert notifications',
  $q$insert into public.notifications (recipient_id, actor_id, type) values (public._t_uid('alice'), auth.uid(), 'follow')$q$, '42501');
select public._t_denied('G3 cannot call notify() directly',
  $q$select public.notify(public._t_uid('alice'), auth.uid(), 'follow')$q$, '42501');
select public._t_rows('G4 cannot mark another user''s notification as read',
  $q$update public.notifications set is_read = true where recipient_id = public._t_uid('alice')$q$, 0);
select public._t_rows('G5 cannot delete another user''s notification',
  $q$delete from public.notifications where recipient_id = public._t_uid('alice')$q$, 0);
select public._t_as('alice');
select public._t_ok('G6 the owner can mark a notification as read',
  $q$update public.notifications set is_read = true where recipient_id = auth.uid() and type = 'like'$q$);
select public._t_denied('G7 the owner cannot change other columns',
  $q$update public.notifications set type = 'follow' where recipient_id = auth.uid()$q$, '42501');
select public._t_reset();

-- ===========================================================================
-- H. Blocking
-- ===========================================================================
select public._t_as('bob');
select public._t_ok('H1 follow alice', $q$insert into public.followers (following_id) values (public._t_uid('alice'))$q$);
select public._t_as('alice');
select public._t_ok('H2 block bob', $q$insert into public.blocks (blocked_id) values (public._t_uid('bob'))$q$);
select public._t_eq('H3 blocking removes the follow relationship',
  $q$select count(*)::text from public.followers where follower_id = public._t_uid('bob') and following_id = public._t_uid('alice')$q$, '0');
select public._t_denied('H4 cannot block yourself', $q$insert into public.blocks (blocked_id) values (auth.uid())$q$, '23514');
select public._t_as('bob');
select public._t_eq('H5 a blocked user cannot see the blocker''s posts',
  $q$select count(*)::text from public.posts where author_id = public._t_uid('alice')$q$, '0');
select public._t_denied('H6 a blocked user cannot follow',
  $q$insert into public.followers (following_id) values (public._t_uid('alice'))$q$, '42501');
select public._t_denied('H7 a blocked user cannot open a DM',
  $q$select public.get_or_create_dm(public._t_uid('alice'))$q$, 'P0001');
select public._t_denied('H8 a blocked user cannot message the existing chat',
  $q$insert into public.messages (chat_id, content) values (current_setting('t.chat')::uuid, 'still here')$q$, '42501');
select public._t_eq('H9 the blocks table is private to the blocker',
  $q$select count(*)::text from public.blocks$q$, '0');
select public._t_reset();
select public._t_ok('H10 notify() ignores blocked pairs',
  $q$select public.notify(public._t_uid('alice'), public._t_uid('bob'), 'like')$q$);
select public._t_eq('H11 no notification was created',
  $q$select count(*)::text from public.notifications where recipient_id = public._t_uid('alice') and type = 'like' and post_id is null$q$, '0');
select public._t_as('alice');
select public._t_ok('H12 unblock', $q$delete from public.blocks where blocker_id = auth.uid()$q$);
select public._t_as('bob');
select public._t_eq('H13 posts are visible again after unblocking',
  $q$select count(*)::text from public.posts where author_id = public._t_uid('alice')$q$, '2');
select public._t_reset();

-- ===========================================================================
-- I. Communities and moderation
-- ===========================================================================
select public._t_as('alice');
select public._t_ok('I1 create a public community',
  $q$insert into public.communities (name, slug) values ('Gardeners', 'gardeners') returning id$q$);
select public._t_ok('I2 create a PRIVATE community and read the row back (0007 fix)',
  $q$insert into public.communities (name, slug, is_private) values ('Secret', 'secret', true) returning id$q$);
select public._t_reset();
select set_config('t.priv', (select id::text from public.communities where slug = 'secret'), false);
select set_config('t.comm', (select id::text from public.communities where slug = 'gardeners'), false);
select public._t_eq('I3 the owner became a member automatically',
  $q$select count(*)::text from public.community_members where role = 'owner' and user_id = public._t_uid('alice')$q$, '2');
select public._t_eq('I4 member_count starts at 1',
  $q$select member_count::text from public.communities where slug = 'gardeners'$q$, '1');
select public._t_as('bob');
select public._t_ok('I5 join a public community',
  $q$insert into public.community_members (community_id) values (current_setting('t.comm')::uuid)$q$);
select public._t_denied('I6 duplicate membership rejected',
  $q$insert into public.community_members (community_id) values (current_setting('t.comm')::uuid)$q$, '23505');
select public._t_eq('I7 a private community is invisible to outsiders',
  $q$select count(*)::text from public.communities where slug = 'secret'$q$, '0');
select public._t_denied('I8 cannot join a private community',
  $q$insert into public.community_members (community_id) values (current_setting('t.priv')::uuid)$q$, '42501');
select public._t_denied('I9 a member cannot change roles',
  format($q$select public.set_member_role(current_setting('t.comm')::uuid, %L, 'moderator')$q$, public._t_uid('bob')), 'P0001');
select public._t_rows('I10 a member cannot edit the community',
  $q$update public.communities set description = 'x' where slug = 'gardeners'$q$, 0);
select public._t_denied('I11 cannot grant yourself the owner role',
  $q$insert into public.community_members (community_id, role) values (current_setting('t.comm')::uuid, 'owner')$q$, '42501');
select public._t_ok('I12 a member can post in the community',
  $q$insert into public.posts (content, community_id) values ('bob in gardeners', current_setting('t.comm')::uuid)$q$);
select public._t_as('dave');
select public._t_denied('I13 a non-member cannot post in the community',
  $q$insert into public.posts (content, community_id) values ('dave intrudes', current_setting('t.comm')::uuid)$q$, '42501');
select public._t_as('carol');
select public._t_ok('I14 another member joins',
  $q$insert into public.community_members (community_id) values (current_setting('t.comm')::uuid)$q$);
select public._t_ok('I15 and posts',
  $q$insert into public.posts (content, community_id) values ('carol in gardeners', current_setting('t.comm')::uuid)$q$);
select public._t_as('alice');
select public._t_ok('I16 the owner promotes a member to moderator',
  format($q$select public.set_member_role(current_setting('t.comm')::uuid, %L, 'moderator')$q$, public._t_uid('bob')));
select public._t_as('bob');
select public._t_rows('I17 a moderator can delete a member''s post',
  $q$delete from public.posts where content = 'carol in gardeners'$q$, 1);
select public._t_rows('I18 a moderator can edit the community description',
  $q$update public.communities set description = 'we grow things' where slug = 'gardeners'$q$, 1);
select public._t_rows('I19 a moderator cannot remove the owner',
  format($q$delete from public.community_members where community_id = current_setting('t.comm')::uuid and user_id = %L$q$, public._t_uid('alice')), 0);
select public._t_as('carol');
select public._t_rows('I20 a member cannot remove a moderator',
  format($q$delete from public.community_members where community_id = current_setting('t.comm')::uuid and user_id = %L$q$, public._t_uid('bob')), 0);
select public._t_rows('I21 a member can leave',
  $q$delete from public.community_members where community_id = current_setting('t.comm')::uuid and user_id = auth.uid()$q$, 1);
select public._t_as('alice');
select public._t_denied('I22 community image must be an own storage file (0007)',
  $q$update public.communities set avatar_url = 'https://evil.example/c.png' where slug = 'gardeners'$q$, '23514');
select public._t_rows('I23 the owner can remove a moderator',
  format($q$delete from public.community_members where community_id = current_setting('t.comm')::uuid and user_id = %L$q$, public._t_uid('bob')), 1);
select public._t_reset();
select public._t_eq('I24 member_count tracks joins and leaves',
  $q$select member_count::text from public.communities where slug = 'gardeners'$q$, '1');

-- ===========================================================================
-- J. Reports
-- ===========================================================================
select public._t_as('bob');
select public._t_ok('J1 report a post',
  $q$insert into public.reports (target_type, target_id, reason) select 'post', id, 'spam' from public.posts where content = 'hello from alice'$q$);
select public._t_denied('J2 reporting the same thing twice is rejected (the app treats this as success)',
  $q$insert into public.reports (target_type, target_id, reason) select 'post', id, 'spam' from public.posts where content = 'hello from alice'$q$, '23505');
select public._t_denied('J3 invalid reason rejected',
  $q$insert into public.reports (target_type, target_id, reason) values ('user', public._t_uid('carol'), 'because')$q$, '23514');
select public._t_denied('J4 cannot spoof reporter_id',
  format($q$insert into public.reports (target_type, target_id, reason, reporter_id) values ('user', %L, 'spam', %L)$q$, public._t_uid('carol'), public._t_uid('alice')), '42501');
select public._t_denied('J5 reports cannot be edited', $q$update public.reports set status = 'closed'$q$, '42501');
select public._t_as('alice');
select public._t_eq('J6 the reported user cannot read reports about them',
  $q$select count(*)::text from public.reports$q$, '0');
select public._t_reset();

-- ===========================================================================
-- K. Calls and signalling
-- ===========================================================================
select public._t_as('alice');
select public._t_ok('K1 start a call',
  $q$insert into public.call_sessions (callee_id, call_type) values (public._t_uid('bob'), 'video') returning id$q$);
select public._t_denied('K2 cannot call yourself',
  $q$insert into public.call_sessions (callee_id) values (auth.uid())$q$, '23514');
select public._t_reset();
select set_config('t.call', (select id::text from public.call_sessions limit 1), false);
select public._t_as('carol');
select public._t_eq('K3 a stranger cannot see the call', $q$select count(*)::text from public.call_sessions$q$, '0');
select public._t_denied('K4 a stranger cannot inject signals',
  $q$insert into public.call_signals (call_id, kind, payload) values (current_setting('t.call')::uuid, 'offer', '{}')$q$, '42501');
select public._t_as('bob');
select public._t_denied('K5 the callee cannot cancel (caller-only)',
  $q$update public.call_sessions set status = 'cancelled'$q$, 'P0001');
select public._t_as('alice');
select public._t_denied('K6 the caller cannot accept their own call',
  $q$update public.call_sessions set status = 'accepted'$q$, 'P0001');
select public._t_ok('K7 the caller can send the offer',
  $q$insert into public.call_signals (call_id, kind, payload) values (current_setting('t.call')::uuid, 'offer', '{"type":"offer","sdp":"x"}')$q$);
select public._t_denied('K8 cannot spoof the signal sender',
  format($q$insert into public.call_signals (call_id, kind, payload, sender_id) values (current_setting('t.call')::uuid, 'ice', '{}', %L)$q$, public._t_uid('bob')), '42501');
select public._t_as('bob');
select public._t_eq('K9 the callee can read the offer', $q$select count(*)::text from public.call_signals$q$, '1');
select public._t_ok('K10 the callee accepts', $q$update public.call_sessions set status = 'accepted'$q$);
select public._t_denied('K11 call fields cannot be rewritten',
  format($q$update public.call_sessions set callee_id = %L$q$, public._t_uid('carol')), '42501');
select public._t_reset();
select public._t_eq('K12 started_at is stamped by the server',
  $q$select (started_at is not null)::text from public.call_sessions$q$, 'true');
select public._t_as('alice');
select public._t_ok('K13 hang up', $q$update public.call_sessions set status = 'ended'$q$);
select public._t_denied('K14 a finished call cannot change again',
  $q$update public.call_sessions set status = 'failed'$q$, 'P0001');
select public._t_denied('K15 no signals can be added after the call ended',
  $q$insert into public.call_signals (call_id, kind, payload) values (current_setting('t.call')::uuid, 'ice', '{}')$q$, '42501');
select public._t_reset();

-- ===========================================================================
-- L. Storage policies (rows in storage.objects are the policy target)
-- ===========================================================================
select public._t_as('alice');
select public._t_ok('L1 upload into your own folder',
  format($q$insert into storage.objects (bucket_id, name) values ('post-media', '%s/a.webp')$q$, public._t_uid('alice')));
select public._t_denied('L2 cannot upload into someone else''s folder',
  format($q$insert into storage.objects (bucket_id, name) values ('post-media', '%s/a.webp')$q$, public._t_uid('bob')), '42501');
select public._t_denied('L3 cannot upload outside a user folder',
  $q$insert into storage.objects (bucket_id, name) values ('avatars', 'loose.webp')$q$, '42501');
select public._t_reset();
insert into storage.objects (bucket_id, name) values ('avatars', public._t_uid('bob')::text || '/b.webp');
select public._t_as('alice');
select public._t_rows('L4 cannot delete someone else''s file',
  format($q$delete from storage.objects where name like '%s/%%'$q$, public._t_uid('bob')), 0);
select public._t_rows('L5 cannot replace someone else''s file',
  format($q$update storage.objects set name = name where name like '%s/%%'$q$, public._t_uid('bob')), 0);
select public._t_rows('L6 can delete your own file',
  format($q$delete from storage.objects where name like '%s/%%'$q$, public._t_uid('alice')), 1);
select public._t_reset();
select public._t_eq('L7 avatar bucket limit is 2 MB',
  $q$select file_size_limit::text from storage.buckets where id = 'avatars'$q$, '2097152');
select public._t_eq('L8 buckets only accept images',
  $q$select (not exists (select 1 from storage.buckets where id in ('avatars','post-media','community-images') and (allowed_mime_types is null or exists (select 1 from unnest(allowed_mime_types) m where m not like 'image/%'))))::text$q$, 'true');

-- ===========================================================================
-- M. Anonymous role and account deletion
-- ===========================================================================
select public._t_as_anon();
select public._t_denied('M1 anonymous visitors cannot read profiles', $q$select count(*) from public.profiles$q$, '42501');
select public._t_denied('M2 anonymous visitors cannot read posts', $q$select count(*) from public.posts$q$, '42501');
select public._t_ok('M3 anonymous visitors can check username availability', $q$select public.username_available('free_name')$q$);
select public._t_denied('M4 anonymous visitors cannot delete accounts', $q$select public.delete_my_account()$q$, '42501');
select public._t_denied('M4b anonymous visitors cannot call the block-check helper', $q$select public.is_blocked_between(public._t_uid('alice'), public._t_uid('carol'))$q$, '42501');
select public._t_eq('M4c username_available is the only application function open to anonymous callers',
  $q$select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.proname not like '\_t\_%'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and has_function_privilege('anon', p.oid, 'execute')$q$, 'username_available');
select public._t_as('bob');
select public._t_ok('M5 delete my account (cascades through every table)', $q$select public.delete_my_account()$q$);
select public._t_reset();
select public._t_eq('M6 the profile is gone', $q$select count(*)::text from public.profiles where id = public._t_uid('bob')$q$, '0');
select public._t_eq('M7 their likes, reactions and saves are gone',
  $q$select (select count(*) from public.post_likes where user_id = public._t_uid('bob')) + (select count(*) from public.post_reactions where user_id = public._t_uid('bob')) + (select count(*) from public.saved_posts where user_id = public._t_uid('bob')) || ''$q$, '0');
select public._t_eq('M8 counters were corrected by the delete triggers',
  $q$select like_count::text from public.posts where content = 'hello from alice'$q$, '0');

-- ---------------------------------------------------------------------------
-- result: one summary row, then every failure
-- ---------------------------------------------------------------------------
select result, name, detail from (
  select 0 as ord, 0 as n,
         case when count(*) filter (where not ok) = 0 then 'ALL PASSED' else 'FAILURES' end as result,
         (count(*) filter (where ok))::text || ' passed, ' || (count(*) filter (where not ok))::text || ' failed' as name,
         null::text as detail
  from public._t_results
  union all
  select 1, n, 'FAIL', name, detail from public._t_results where not ok
) r order by ord, n;

rollback;
