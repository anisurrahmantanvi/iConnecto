-- iConnecto 0009: signed-out callers (role "anon") may only call username_available().
--
-- Why: PostgreSQL grants EXECUTE on every new function to PUBLIC, and Supabase's default privileges also grant it to "anon".
-- Several SECURITY DEFINER helpers (is_blocked_between, is_chat_member, is_community_member, ...) were therefore callable
-- through the REST API by someone who is not signed in. They only answer yes/no questions and need a user id to be useful,
-- but there is no reason to expose them.
--
-- Non-destructive and idempotent. It only REMOVES access from PUBLIC/anon; signed-in users keep exactly the EXECUTE rights they had
-- (needed by the RLS policies and the app's rpc() calls) and nothing is newly granted to them.
-- Functions that belong to extensions (pgcrypto, pg_trgm, ...) are not touched.
do $$
declare
  r record;
  auth_had boolean;
  svc_had boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    -- remember who could call it, because revoking from PUBLIC also removes access that was only inherited through PUBLIC
    auth_had := has_function_privilege('authenticated', r.oid, 'execute');
    svc_had  := has_function_privilege('service_role', r.oid, 'execute');

    execute format('revoke execute on function %s from public, anon', r.sig);

    -- give back only what existed before; functions that were already closed to signed-in users (e.g. notify()) stay closed
    if auth_had and not has_function_privilege('authenticated', r.oid, 'execute') then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    if svc_had and not has_function_privilege('service_role', r.oid, 'execute') then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
  end loop;
end $$;

-- the one deliberate exception: sign-up needs to check whether a username is free before the user has an account
grant execute on function public.username_available(text) to anon, authenticated, service_role;

-- functions created by later migrations should start closed too (applies to objects created by the role running this file)
alter default privileges in schema public revoke execute on functions from anon;
