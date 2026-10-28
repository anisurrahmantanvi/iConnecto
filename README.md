# iConnecto

A social network with a Liquid Glass–inspired interface: posts, comments, likes, emoji reactions, follows, saved posts, notifications,
direct messages, communities and 1‑to‑1 voice/video calls. React + TypeScript + Vite on the front end, Supabase (Free plan) for
auth, database, storage and realtime. No Firebase, no paid dependency required.

> **Read this first — what has and has not been tested.**
> The code was written in a workspace where `npm install` was blocked, so the **browser app has never been built or run**.
> What *was* checked is listed in [docs/STATUS.md](docs/STATUS.md): the database layer (170 automated checks on a local PostgreSQL),
> a strict TypeScript check against hand-written stubs, the emoji unit tests, the PWA icons and a route/link audit.
> Everything else (sign-up flow, uploads, realtime chat, calls, layout on a real Android phone…) is **implemented but untested**.
> Follow "First run" below and use the checklist in [docs/STATUS.md](docs/STATUS.md) to test it properly.

## First run (needs Node 20+ and npm access)

```bash
npm install
cp .env.example .env          # then fill in the two Supabase values (see "Environment")
npm run typecheck             # real TypeScript check; fix anything it reports
npm run test                  # emoji unit tests (uses tsx)
npm run build                 # typecheck + production build into dist/
npm run dev                   # http://localhost:5173 (also reachable from a phone on the same Wi-Fi)
npm run preview               # serve the production build to test the PWA / service worker
```

If `npm run typecheck` reports errors, they are real (the earlier check used stubs for `react-router-dom`, `lucide-react` and the Supabase
SDK, so mismatches against the genuine type definitions can only show up now). Please send the output back and they can be fixed quickly.

## Environment

| Variable | Required | What it is |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL (Supabase → Project Settings → API) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | The **publishable / anon** key. **Never** the service-role / secret key — everything with a `VITE_` prefix is shipped to the browser. The app refuses to start if it recognises a secret key. |
| `VITE_EMOJI_BASE_URL` | no | Where emoji SVGs come from. Default: a public Twemoji CDN. See "Emoji". |
| `VITE_ICE_SERVERS` | no | JSON array of STUN/TURN servers for calls. Default: one public STUN server. See [docs/CALLS.md](docs/CALLS.md). |

`.env` is git‑ignored; `.env.example` has empty placeholders. If a required value is missing the app shows a setup screen instead of failing silently.

## Supabase setup

Full, step-by-step instructions are in [supabase/README.md](supabase/README.md). In short:

1. Run `supabase/inspect_schema.sql` (read-only) in the SQL editor and compare with the expected columns.
2. Apply `supabase/migrations/0001 … 0009` in order, one at a time. They are idempotent and never drop data.
3. Delete any older policies on these tables that the migrations did not create (policies add up).
4. On a **development** project, run `supabase/tests/rls_smoke.sql` — it must end with `ALL PASSED`.
5. Authentication → URL Configuration: set the Site URL and add `<site>/auth/callback` to the redirect URLs (both `http://localhost:5173` and production).
   Configure your own SMTP before real users sign up (the built-in sender is for testing and rate-limited).

## What is in the app

| Area | Screens / behaviour |
|---|---|
| Accounts | Sign up, log in/out, e-mail verification and auth callback, password reset, optional onboarding, edit profile (avatar, name, unique username with live availability check, bio), change e-mail, sign out other devices, delete account |
| Feed | Following and Explore tabs, infinite scroll, create/edit/delete posts with up to 4 images, post detail, comments with replies and likes, like, save, share, report |
| Emoji | One consistent emoji set everywhere (see below), picker, one-tap reactions on posts |
| People | Profiles, follow/unfollow (optimistic with rollback), followers/following lists, search and suggestions |
| Messages | One-to-one chats, inbox with unread badges, history paging, realtime delivery, optimistic send with retry |
| Notifications | Follow, like, comment, reply and community-join notifications created by database triggers; unread count, mark read, clear. New messages show as unread badges in the inbox rather than as notifications. |
| Communities | Discover, create, join/leave, members, roles (owner/moderator/member), community feed, basic moderation |
| Calls | Incoming/outgoing screens, audio/video, mute, camera, accept/decline/end, duration, permission and connection errors. **Needs a TURN server for many real-world networks** — see [docs/CALLS.md](docs/CALLS.md) |
| Safety | Block/unblock, report users/posts/comments, privacy and security (what others can see, change password, sign out other devices), account settings. Private approve-to-follow accounts are **not** available yet. |
| Platform | Light/dark/system theme, reduced-motion and reduced-transparency support, glass fallback without `backdrop-filter`, offline banner, installable PWA with app-shell caching, English with a Bengali dictionary |

## Emoji

Emoji are rendered as images (Twemoji SVG) instead of the device font, so they look the same on every Android version and on desktop —
in posts, comments, chat bubbles, reactions and the picker. Emoji-only messages are shown larger. If an image fails to load, the native glyph is shown instead.
Inside the text box the browser itself draws emoji, because a `<textarea>` cannot contain images; they switch to the custom images as soon as they are posted.

By default the images come from a public CDN. To self-host (recommended for production, and for offline use):

```bash
npm run emoji:vendor              # downloads the picker's emoji into public/emoji/ (needs internet)
echo 'VITE_EMOJI_BASE_URL=/emoji/' >> .env
```

Twemoji graphics are licensed CC‑BY 4.0; keep the attribution if you ship them.

## App icon and branding

The logo is in `design/logo-source.png`. `npm run icons` (needs Python 3 with Pillow and numpy) regenerates every icon in `public/` from it:
rounded "any" icons, a maskable Android icon, the Apple touch icon and favicons. The `Logo` component shows it on the splash screen, the sign-in screens and the sidebar.

## Project layout

```
src/
  app/          providers (auth, badges, theme), router, route guards, error boundary
  components/   ui/ (glass primitives), layout/, feed/, profile/, chat/, communities/, calls/, auth/
  pages/        one file per screen (auth/, settings/ subfolders)
  services/     all Supabase access (posts, comments, follows, chat, notifications, communities, calls, storage, …)
  hooks/        shared hooks      lib/   env, supabase client, emoji, image compression, WebRTC engine, i18n, PWA
  styles/       tokens.css, base.css, components.css, screens.css
  types/        shared data types
supabase/       migrations/, tests/rls_smoke.sql, inspect_schema.sql, README.md (schema reference)
public/         manifest, service worker, icons          scripts/   icon + emoji helpers          tests/   emoji unit tests
docs/           STATUS.md (what is verified), CALLS.md (STUN/TURN)
```

## Free-plan notes

Pagination everywhere, narrow `select` lists, debounced search, images compressed in the browser before upload, and realtime only for messages,
notifications and calls. Supabase's free limits (database size, storage, bandwidth, realtime connections, auth e-mails, project pausing after inactivity)
can still be exceeded by a busy app, and they change over time — check your project's usage page. Nothing here is a promise of free hosting.
The front end is static (`dist/`) and can be served from any static host.

## Android

The app is a PWA: open it in Chrome on Android and use "Install app" / "Add to Home screen" (the service worker and manifest only take effect on a
production build served over HTTPS or on localhost). The structure is compatible with wrapping it later in a native shell such as Capacitor; that has not been attempted.

## Install on a phone (PWA)

Chrome only offers "Install app" over **HTTPS** (a LAN address like `http://192.168.x.x:5173` only gives a plain shortcut).

1. Fill `.env` (see above), then `npm run build`. The `VITE_` values are baked in at build time.
2. Host the `dist/` folder on any static HTTPS host. Easiest: drag `dist/` onto <https://app.netlify.com/drop>. `public/_redirects` (Netlify/Cloudflare Pages) and `vercel.json` (Vercel) make deep links such as `/login` survive a refresh.
3. In Supabase → Authentication → URL Configuration, set **Site URL** and add `https://YOUR-SITE/auth/callback` to **Redirect URLs**, or confirmation and reset e-mails will point to the wrong address.
4. Open the HTTPS link in Chrome on Android → ⋮ menu → **Install app** (or "Add to Home screen").

Not tested on a real phone yet. A native `.apk` is not built; wrap the hosted PWA later with Capacitor or PWABuilder if you need one.
