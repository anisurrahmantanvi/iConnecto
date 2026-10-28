-- =====================================================================================
-- STEP 1: RESET. PERMANENTLY DELETES every row in the iConnecto tables listed below,
-- plus the old functions, views and signup trigger they used. THIS CANNOT BE UNDONE.
--
-- KEPT: user accounts (auth.users), Storage buckets and uploaded files, and the
--       table public.device_tokens (iConnecto does not use it; drop it yourself if you want).
-- Run this ONCE, only if you really want a clean start. Then run step02 ... step10 in order.
-- Existing accounts get a fresh profile automatically the next time they log in.
-- =====================================================================================

-- 1) Old signup triggers on auth.users that call functions in schema public
do $$
declare r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal
      and n.nspname = 'public'
  loop
    execute format('drop trigger if exists %I on auth.users', r.tgname);
    raise notice 'dropped trigger % on auth.users', r.tgname;
  end loop;
end $$;

-- 2) The tables (their policies, indexes, triggers and realtime registration go with them)
drop table if exists
  public.call_signals, public.call_sessions,
  public.reports, public.blocks,
  public.message_reactions, public.messages, public.chat_members, public.chats,
  public.notifications,
  public.post_reactions, public.shares, public.saved_posts,
  public.comment_likes, public.comments, public.post_likes, public.posts,
  public.community_members, public.communities,
  public.followers, public.profiles
cascade;

-- 3) Views in schema public (app views only; none are created by Supabase itself)
do $$
declare r record;
begin
  for r in select schemaname, viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists %I.%I cascade', r.schemaname, r.viewname);
    raise notice 'dropped view %', r.viewname;
  end loop;
end $$;

-- 4) Functions in schema public that do not belong to an extension
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.sig);
    raise notice 'dropped function %', r.sig;
  end loop;
end $$;

notify pgrst, 'reload schema';
