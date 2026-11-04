// Sends phone push notifications through Firebase Cloud Messaging (FCM HTTP v1).
//
// Called by database triggers (see migration 0015) whenever a message, an activity notification or a call is created.
// Deploy with --no-verify-jwt: the caller proves itself with the shared header "x-push-secret" instead.
//
// Secrets (Supabase > Edge Functions > Secrets), never in the app or in git:
//   PUSH_WEBHOOK_SECRET   a long random string, the same one stored in the database (public.app_private, key push_secret)
//   FCM_SERVICE_ACCOUNT   the Firebase service-account JSON (Firebase > Project settings > Service accounts)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase to every function; they never reach the app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

interface Push {
  recipients: string[]
  title: string
  body: string
  url: string
  tag: string
  channel: 'iconnecto' | 'calls_ring_v2'
  ttl: string
  /** Which notification preference decides whether this is sent. 'security' is always sent. */
  category: 'message' | 'call' | 'like' | 'comment' | 'social' | 'security'
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const b64url = (data: ArrayBuffer | string): string => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cached: { token: string; exp: number } | null = null

async function accessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cached && cached.exp - 60 > now) return cached.token
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) throw new Error(`Google token request failed: ${JSON.stringify(json)}`)
  cached = { token: json.access_token as string, exp: now + Number(json.expires_in ?? 3600) }
  return cached.token
}

/** Drops recipients who turned this kind of alert off, paused notifications, or are in quiet hours. Never fails the push. */
async function allowed(recipients: string[], category: Push['category']): Promise<string[]> {
  if (category === 'security') return recipients
  try {
    const { data, error } = await admin.from('notification_prefs').select('*').in('user_id', recipients)
    if (error || !data) return recipients
    const byUser = new Map(data.map((r: Record<string, unknown>) => [r.user_id as string, r]))
    const now = Date.now()
    return recipients.filter((uid) => {
      const p = byUser.get(uid)
      if (!p) return true
      const flag = category === 'message' ? p.push_messages : category === 'call' ? p.push_calls : category === 'like' ? p.push_likes : category === 'comment' ? p.push_comments : p.push_social
      if (flag === false) return false
      if (p.paused_until && new Date(p.paused_until as string).getTime() > now) return false
      if (p.quiet_enabled) {
        const local = (Math.floor(now / 60000) + Number(p.tz_offset ?? 0) + 1440 * 2) % 1440
        const a = Number(p.quiet_start), b = Number(p.quiet_end)
        const inQuiet = a === b ? false : a < b ? local >= a && local < b : local >= a || local < b
        if (inQuiet) return false
      }
      return true
    })
  } catch { return recipients }
}

const nameOf = (p: { display_name: string | null; username: string } | null | undefined) => p?.display_name || p?.username || 'Someone'

async function build(kind: string, id: string): Promise<Push | null> {
  if (kind === 'message') {
    const { data: m } = await admin.from('messages').select('*').eq('id', id).maybeSingle()
    if (!m || m.kind === 'call') return null
    const [{ data: members }, { data: sender }] = await Promise.all([
      admin.from('chat_members').select('user_id').eq('chat_id', m.chat_id).neq('user_id', m.sender_id),
      admin.from('profiles').select('display_name, username').eq('id', m.sender_id).maybeSingle(),
    ])
    return {
      recipients: (members ?? []).map((x) => x.user_id as string),
      title: nameOf(sender),
      body: String(m.content ?? '').slice(0, 140),
      url: `/messages/${m.chat_id}`,
      tag: `chat-${m.chat_id}`,
      channel: 'iconnecto',
      ttl: '86400s',
      category: 'message',
    }
  }
  if (kind === 'notification') {
    const { data: n } = await admin.from('notifications').select('id, recipient_id, actor_id, type, post_id').eq('id', id).maybeSingle()
    if (!n) return null
    const { data: actor } = n.actor_id ? await admin.from('profiles').select('display_name, username').eq('id', n.actor_id).maybeSingle() : { data: null }
    const text: Record<string, string> = {
      follow: 'started following you',
      follow_request: 'wants to follow you',
      friend_request: 'sent you a friend request',
      friend_accepted: 'accepted your friend request',
      security_alert: 'A new device signed in to your account',
      like: 'liked your post',
      comment: 'commented on your post',
      reply: 'replied to your comment',
      community_join: 'joined your community',
    }
    const url = n.type === 'security_alert' ? '/settings/devices' : n.type === 'friend_request' ? '/friend-requests' : n.type === 'follow_request' ? '/friend-requests' : n.type === 'follow' && actor ? `/u/${actor.username}` : n.post_id ? `/p/${n.post_id}` : '/notifications'
    return {
      recipients: [n.recipient_id as string],
      title: 'iConnecto',
      body: n.type === 'security_alert' ? text.security_alert : `${nameOf(actor)} ${text[n.type as string] ?? 'sent you a notification'}`,
      url,
      tag: `note-${n.id}`,
      channel: 'iconnecto',
      ttl: '86400s',
      category: n.type === 'security_alert' ? 'security' : n.type === 'like' ? 'like' : n.type === 'comment' || n.type === 'reply' ? 'comment' : 'social',
    }
  }
  if (kind === 'call') {
    const { data: c } = await admin.from('call_sessions').select('id, caller_id, callee_id, call_type, status').eq('id', id).maybeSingle()
    if (!c || c.status !== 'ringing') return null
    const { data: caller } = await admin.from('profiles').select('display_name, username').eq('id', c.caller_id).maybeSingle()
    return {
      recipients: [c.callee_id as string],
      title: `${nameOf(caller)} is calling`,
      body: c.call_type === 'video' ? 'Incoming video call' : 'Incoming voice call',
      url: `/call/${c.id}`,
      tag: `call-${c.id}`,
      channel: 'calls_ring_v2',
      ttl: '30s',
      category: 'call',
    }
  }
  return null
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const expected = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? ''
  const got = req.headers.get('x-push-secret') ?? ''
  if (!expected || !safeEqual(got, expected)) return new Response('Unauthorized', { status: 401 })

  let payload: { kind?: string; id?: string }
  try { payload = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!payload.kind || !payload.id) return new Response('Bad request', { status: 400 })

  const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!saRaw) return new Response('FCM_SERVICE_ACCOUNT is not set', { status: 500 })
  const sa = JSON.parse(saRaw)

  const push = await build(payload.kind, payload.id)
  if (push) push.recipients = await allowed(push.recipients, push.category)
  if (!push || !push.recipients.length) return new Response('nothing to send', { status: 200 })

  const { data: rows } = await admin.from('push_tokens').select('token').in('user_id', push.recipients)
  const tokens = (rows ?? []).map((r) => r.token as string)
  if (!tokens.length) return new Response('no devices', { status: 200 })

  const bearer = await accessToken(sa)
  let sent = 0
  for (const token of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: push.channel === 'calls_ring_v2'
          ? {
              // Calls are data-only so the app's own service can ring (looping) and show the full-screen call screen.
              token,
              data: { kind: 'call', title: push.title, body: push.body, url: push.url },
              android: { priority: 'HIGH', ttl: push.ttl },
            }
          : {
              token,
              notification: { title: push.title, body: push.body },
              data: { url: push.url },
              android: { priority: 'HIGH', ttl: push.ttl, notification: { channel_id: push.channel, tag: push.tag } },
            },
      }),
    })
    if (res.ok) {
      sent++
    } else {
      const err = await res.text()
      console.error('FCM error', res.status, err)
      // The app was uninstalled or the token is stale: forget it.
      if (res.status === 404 || err.includes('UNREGISTERED')) await admin.from('push_tokens').delete().eq('token', token)
    }
  }
  return new Response(JSON.stringify({ sent, devices: tokens.length }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (e) {
    // Say what went wrong (never any secret) so it shows in the database's net._http_response table.
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    console.error('send-push failed', msg)
    return new Response(`send-push failed: ${msg}`.slice(0, 400), { status: 500 })
  }
})
