# iConnecto database (Supabase)

Everything the app needs on the server lives in `migrations/`. The files are **idempotent and non-destructive**: they create
missing objects and add missing columns, and never drop tables or delete rows.

## Order of work

1. **Inspect first.** Supabase dashboard -> SQL editor -> run `inspect_schema.sql` (read-only). Compare the output with the
   "Expected columns" below. If an existing table uses different column names (for example `body` instead of `content` on `posts`),
   adapt the migration or the app **before** running anything. `create table if not exists` will not reshape an existing table.
2. **Apply the migrations in order**, one file at a time, checking for errors after each:
   `0001_core.sql` -> `0002_interactions.sql` -> `0003_notifications.sql` -> `0004_messaging.sql` -> `0005_moderation_calls.sql`
   -> `0006_storage_hardening.sql` -> `0007_review_fixes.sql` -> `0008_feed_helpers.sql` -> `0009_lock_down_function_execute.sql`.
   Either paste each file into the SQL editor, or from a terminal: `for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done`
   (use the connection string from Project Settings -> Database; it contains a password, so keep it out of the repo).
3. **Review pre-existing policies.** Row Level Security policies are OR-ed together. If your project already had policies on these
   tables (from an older script), they stay active and can *widen* access. In the dashboard open Authentication -> Policies and
   delete any old policy that the migrations did not create.
4. **Run the smoke test on a development/staging project** (not production): paste `tests/rls_smoke.sql` into the SQL editor.
   It impersonates six throw-away users and ends with a single result row, `ALL PASSED` or the list of failures. It runs in a
   transaction that is rolled back, but it does insert into `auth.users` temporarily.
5. **Auth settings** (Authentication -> URL Configuration): set *Site URL* to where the app is served and add
   `<site>/auth/callback` to *Redirect URLs*, for `http://localhost:5173` and for your production address. Keep "Confirm email" on.
   The built-in e-mail sender is rate-limited and meant for testing; configure your own SMTP before real users sign up.

## What was verified, and how

The migrations were applied twice in a row (to check idempotency) on a **local PostgreSQL 16 with a small Supabase-compatible shim**
(roles `anon`/`authenticated`/`service_role`, `auth.uid()`, `auth.users`, the `storage` tables), and `tests/rls_smoke.sql`
reported **170 passed, 0 failed**. The suite was also run against deliberately broken copies (RLS switched off on `messages`, a counter column
made writable) and correctly reported failures. It also caught a mistake made while writing migration 0009, which was fixed.

That is *not* a test against a real Supabase project. The shim does not reproduce the Storage HTTP API, Realtime delivery, the Auth
service, hosted extensions or PostgREST. Run the smoke test on your own project, then try the flows in the browser with two accounts.

## Security model in one paragraph

Every table has RLS enabled and the `anon` role has no access to application tables. Clients get **column-level** `INSERT/UPDATE` grants,
so counters, ownership, role and timestamps cannot be written from the browser. Identity always comes from `auth.uid()` (column defaults and
policies), never from a client-supplied id. Notifications, chats and chat memberships are created only by `SECURITY DEFINER` triggers/functions.
Blocks are enforced in the policies, not only in the UI. Storage writes are limited to the uploader's own `<user-id>/` folder, and post/avatar/community
image URLs must point at this project's own buckets. Reports are write-only for users (review them in the dashboard with the service role, never in the app).
No service-role key is used anywhere in the front end; `src/lib/env.ts` refuses to start if one is pasted into `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Expected columns (generated from the migrated schema)


### `profiles`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no |  |
| `username` | text | yes |  |
| `display_name` | text | yes |  |
| `bio` | text | yes |  |
| `avatar_url` | text | yes |  |
| `created_at` | timestamp with time zone | no | `now()` |
| `followers_count` | integer | no | `0` |
| `following_count` | integer | no | `0` |
| `posts_count` | integer | no | `0` |
| `updated_at` | timestamp with time zone | no | `now()` |

### `posts`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `author_id` | uuid | no | `auth.uid()` |
| `content` | text | no | `''::text` |
| `media_urls` | ARRAY | no | `'{}'::text[]` |
| `community_id` | uuid | yes |  |
| `like_count` | integer | no | `0` |
| `comment_count` | integer | no | `0` |
| `share_count` | integer | no | `0` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |
| `edited_at` | timestamp with time zone | yes |  |

### `comments`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `post_id` | uuid | no |  |
| `author_id` | uuid | no | `auth.uid()` |
| `parent_id` | uuid | yes |  |
| `content` | text | no |  |
| `like_count` | integer | no | `0` |
| `reply_count` | integer | no | `0` |
| `created_at` | timestamp with time zone | no | `now()` |
| `updated_at` | timestamp with time zone | no | `now()` |
| `edited_at` | timestamp with time zone | yes |  |

### `post_likes`

| column | type | null | default |
|---|---|---|---|
| `post_id` | uuid | no |  |
| `user_id` | uuid | no | `auth.uid()` |
| `created_at` | timestamp with time zone | no | `now()` |

### `comment_likes`

| column | type | null | default |
|---|---|---|---|
| `comment_id` | uuid | no |  |
| `user_id` | uuid | no | `auth.uid()` |
| `created_at` | timestamp with time zone | no | `now()` |

### `followers`

| column | type | null | default |
|---|---|---|---|
| `follower_id` | uuid | no | `auth.uid()` |
| `following_id` | uuid | no |  |
| `created_at` | timestamp with time zone | no | `now()` |

### `saved_posts`

| column | type | null | default |
|---|---|---|---|
| `post_id` | uuid | no |  |
| `user_id` | uuid | no | `auth.uid()` |
| `created_at` | timestamp with time zone | no | `now()` |

### `shares`

| column | type | null | default |
|---|---|---|---|
| `post_id` | uuid | no |  |
| `user_id` | uuid | no | `auth.uid()` |
| `created_at` | timestamp with time zone | no | `now()` |

### `post_reactions`

| column | type | null | default |
|---|---|---|---|
| `post_id` | uuid | no |  |
| `user_id` | uuid | no | `auth.uid()` |
| `emoji` | text | no |  |
| `created_at` | timestamp with time zone | no | `now()` |

### `chats`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `is_group` | boolean | no | `false` |
| `last_message_at` | timestamp with time zone | yes |  |
| `last_message_preview` | text | yes |  |
| `created_at` | timestamp with time zone | no | `now()` |

### `chat_members`

| column | type | null | default |
|---|---|---|---|
| `chat_id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `last_read_at` | timestamp with time zone | no | `now()` |
| `joined_at` | timestamp with time zone | no | `now()` |

### `messages`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `chat_id` | uuid | no |  |
| `sender_id` | uuid | no | `auth.uid()` |
| `content` | text | no |  |
| `created_at` | timestamp with time zone | no | `now()` |

### `notifications`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `recipient_id` | uuid | no |  |
| `actor_id` | uuid | yes |  |
| `type` | text | no |  |
| `post_id` | uuid | yes |  |
| `comment_id` | uuid | yes |  |
| `community_id` | uuid | yes |  |
| `is_read` | boolean | no | `false` |
| `created_at` | timestamp with time zone | no | `now()` |

### `communities`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `name` | text | no |  |
| `slug` | text | no |  |
| `description` | text | yes |  |
| `avatar_url` | text | yes |  |
| `is_private` | boolean | no | `false` |
| `owner_id` | uuid | no | `auth.uid()` |
| `member_count` | integer | no | `0` |
| `created_at` | timestamp with time zone | no | `now()` |

### `community_members`

| column | type | null | default |
|---|---|---|---|
| `community_id` | uuid | no |  |
| `user_id` | uuid | no | `auth.uid()` |
| `role` | text | no | `'member'::text` |
| `joined_at` | timestamp with time zone | no | `now()` |

### `reports`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `reporter_id` | uuid | no | `auth.uid()` |
| `target_type` | text | no |  |
| `target_id` | uuid | no |  |
| `reason` | text | no |  |
| `details` | text | yes |  |
| `status` | text | no | `'open'::text` |
| `created_at` | timestamp with time zone | no | `now()` |

### `blocks`

| column | type | null | default |
|---|---|---|---|
| `blocker_id` | uuid | no | `auth.uid()` |
| `blocked_id` | uuid | no |  |
| `created_at` | timestamp with time zone | no | `now()` |

### `call_sessions`

| column | type | null | default |
|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` |
| `caller_id` | uuid | no | `auth.uid()` |
| `callee_id` | uuid | no |  |
| `call_type` | text | no | `'audio'::text` |
| `status` | text | no | `'ringing'::text` |
| `created_at` | timestamp with time zone | no | `now()` |
| `started_at` | timestamp with time zone | yes |  |
| `ended_at` | timestamp with time zone | yes |  |

### `call_signals`

| column | type | null | default |
|---|---|---|---|
| `id` | bigint | no |  |
| `call_id` | uuid | no |  |
| `sender_id` | uuid | no | `auth.uid()` |
| `kind` | text | no |  |
| `payload` | jsonb | no | `'{}'::jsonb` |
| `created_at` | timestamp with time zone | no | `now()` |

## Functions callable by a signed-in user

Helpers used inside policies are listed too (they are `SECURITY DEFINER` so RLS cannot recurse). Signed-out callers (`anon`) may only call `username_available` (migration 0009).

| function | arguments | security |
|---|---|---|
| `can_view_community` | `p_community uuid` | definer |
| `chat_peer` | `p_chat uuid` | invoker |
| `community_is_public` | `p_community uuid` | definer |
| `delete_my_account` | `` | definer |
| `ensure_my_profile` | `` | definer |
| `get_or_create_dm` | `p_other uuid` | definer |
| `home_feed` | `p_before timestamp with time zone, p_limit integer` | invoker |
| `is_blocked_between` | `a uuid, b uuid` | definer |
| `is_chat_member` | `p_chat uuid` | definer |
| `is_community_member` | `p_community uuid` | definer |
| `is_community_mod` | `p_community uuid` | definer |
| `is_community_owner` | `p_community uuid` | definer |
| `mark_chat_read` | `p_chat uuid` | definer |
| `my_chats` | `` | invoker |
| `post_reaction_summary` | `p_post_ids uuid[]` | invoker |
| `set_member_role` | `p_community uuid, p_user uuid, p_role text` | definer |
| `suggested_profiles` | `p_limit integer` | invoker |
| `username_available` | `p_username text` | definer |

(Trigger functions and internal helpers are not callable by the app and are not listed.)

## Clean start on a project that already has old tables

`supabase/steps/` holds the same migrations as numbered, copy-paste-ready files. If the existing tables use different column names and you
accept losing their rows: run `step00_count_rows.sql` (read-only), then `step01_reset_old_schema.sql` (**deletes the old app tables**; keeps
`auth.users`, Storage and `device_tokens`), then `step02a`, `step02b`, `step03a`, `step03b`, `step04` ... `step10` one at a time (the two largest files are split in halves because the Supabase editor cuts pasted text at about 20,000 characters), then `step11_verify.sql` (read-only report).
