# Status: what is verified, what is not

Last updated 2026-10-23. "Verified" means it was actually run in the workspace where this was written. The workspace could not reach the npm
registry, so the browser app itself was **never built or run**.

## Verified

| Check | How | Result |
|---|---|---|
| Database migrations `0001`–`0009` apply on an empty database, and a second time (idempotent) | Local PostgreSQL 16 with a small Supabase-compatible shim (roles, `auth.uid()`, `auth.users`, `storage` tables) | No errors |
| Row Level Security, column grants, counters, triggers, blocks, chats, communities, calls, storage policies, account deletion | `supabase/tests/rls_smoke.sql` (six impersonated users, one rolled-back transaction) | **170 passed, 0 failed** |
| The smoke test can actually fail | Ran it against copies with RLS switched off on `messages` and a counter column made writable | Reported the expected failures |
| Signed-out callers can only call `username_available()` | New tests `M4b`, `M4c` (failed before migration 0009, pass after) | Pass |
| TypeScript, `strict` mode, all of `src/` | TypeScript 6.0.3 against **hand-written stubs** for `react`, `react-dom`, `react-router-dom`, `lucide-react` and `@supabase/supabase-js` | 0 errors. Limits: the Supabase client was typed loosely, so table/column names in queries were not type-checked. |
| Emoji splitting (ZWJ sequences, skin tones, flags, keycaps, Bengali text, `©` handling) | `tests/emoji.test.ts` run with Bun | 7 passed. (`npm run test` uses `tsx` instead; not run here.) |
| Every in-app link and `navigate()` target matches a defined route | Script over `src/` | No dead links |
| No hard-coded keys or project URLs; service-role/secret keys are rejected at start-up | Search of `src/`, `public/`, `index.html`, `.env.example` + code reading of `src/lib/env.ts` | Clean |
| App icons (rounded, maskable, Apple touch, favicons) generated from the supplied logo | `scripts/generate_icons.py`, inspected visually | Look correct |
| `scripts/vendor-emoji.mjs` parses the emoji list | Syntax check and parser dry-run (80 picker + 6 quick-reaction emoji). **Downloading was not run** (no network). | Parser OK |

## Implemented but NOT tested

Nothing below has been executed in a browser. Treat each as "written, may contain bugs".

* Production build (`vite build`), the dev server, bundle size, the service worker and PWA installability
* Sign-up, e-mail confirmation, log-in, session restore, password reset, onboarding
* Image upload and in-browser compression, Storage policies over the real HTTP API
* Feed paging/infinite scroll, post create/edit/delete, comments and replies, likes, reactions, saves, share
* Follow/unfollow with optimistic update and rollback, search and suggestions
* Realtime: chat delivery, notification badges, incoming-call detection, reconnection behaviour
* Voice/video calls (microphone/camera permissions, WebRTC connection, TURN)
* Layout and touch behaviour on narrow Android screens, light/dark themes, glass fallback, keyboard navigation, screen readers
* Behaviour on a **real** Supabase project (hosted PostgREST, Realtime and Auth differ from the local shim)

## Not implemented / known limitations

* **Push notifications** (no service-worker push handling; background or closed tabs get nothing)
* **TURN credentials service** — see [CALLS.md](CALLS.md); without a TURN server some calls will not connect
* Private (approve-to-follow) accounts; group chats; message reactions; editing a post's images (text can be edited)
* New messages appear as inbox unread badges, not as entries in the notifications list
* Bengali: the dictionary and language switch exist, but only the navigation, settings and a few core labels are translated; other screens are English
* Reports are stored for you to review in the Supabase dashboard; there is no in-app moderation queue
* Android: PWA only; no native packaging attempted
* Free-plan limits (e-mail sending, database/storage size, bandwidth, realtime connections, inactivity pausing) were not measured

## Manual test plan (do this once the app builds)

Use two accounts in two different browsers (or one normal and one private window), **A** and **B**.

1. **Auth:** A signs up → confirm e-mail → lands in the app. Log out, log in. Refresh while signed in (session restored). Reset password via e-mail.
2. **Profile:** A edits name, bio, avatar (try a 6 MB photo and a `.pdf`: both should be handled gracefully). Try a username that B already uses.
3. **Posts:** A posts text, then text + 2 images; edits and deletes one. On B, confirm A's posts appear (Explore, and Following after B follows A).
4. **Interactions:** B likes, reacts with an emoji, comments, replies, saves. Check counts on both sides and that A received notifications. Double-click like quickly: the count must not drift.
5. **Follow:** B follows/unfollows A; counts update immediately and roll back if you go offline mid-action (DevTools → Offline).
6. **Messages:** A starts a chat with B; B sees an unread badge in real time; reply; reload and check history; block A from B and confirm A cannot send.
7. **Communities:** A creates one, B joins; A promotes B to moderator; B removes a post; B leaves.
8. **Security:** in the browser console of B, try to read A's messages or write `like_count` with the Supabase client; both must fail.
9. **Calls:** A calls B on the same Wi‑Fi (audio, then video), then A on mobile data. Expect failures without TURN.
10. **Devices:** Chrome on a real Android phone: install as app, rotate, use the keyboard in chat, toggle dark mode and "Reduce motion".
11. **Offline:** go offline: the banner appears, nothing crashes, actions fail with a clear message; the installed app shell still opens.

Send any failures (and the output of `npm run typecheck` / `npm run build`) back and they can be fixed.
