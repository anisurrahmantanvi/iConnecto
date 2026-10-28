// Runs the dev build in headless Chromium against a FAKE Supabase (all requests are intercepted) to reproduce
// screen crashes such as React error #300. Dev mode gives full React error messages with component stacks.
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 5199
const base = `http://localhost:${PORT}`
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A').slice(0, 3500)
const note = (level, title, msg) => console.log(`::${level} title=${title}::${esc(msg)}`)

const uid = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const now = new Date().toISOString()
const profile = { id: uid, username: 'tester', display_name: 'Test User', bio: null, avatar_url: null, followers_count: 0, following_count: 0, posts_count: 0, created_at: now }
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 't@example.com', email_confirmed_at: now, app_metadata: {}, user_metadata: {}, created_at: now }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', exp })}.sig`
const session = { access_token: jwt, refresh_token: 'r', expires_in: 3600, expires_at: exp, token_type: 'bearer', user }
const chats = [
  { chat_id: 'c1', other_id: other, other_username: 'friend', other_display_name: 'Friend One', other_avatar_url: null, last_message_at: now, last_message_preview: 'hello 👋 @tester', unread_count: '2' },
  { chat_id: 'c2', other_id: '33333333-3333-4333-8333-333333333333', other_username: 'nomsg', other_display_name: null, other_avatar_url: null, last_message_at: null, last_message_preview: null, unread_count: '0' },
]
const msg = (i, mine) => ({ id: `m${i}`, chat_id: 'c1', sender_id: mine ? uid : other, content: `message ${i} 😀`, created_at: now, deleted_at: null, read_at: null })

const errors = []
const log = []
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', env: { ...process.env, VITE_SUPABASE_URL: 'https://mock.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder' } })
let browser
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base)).ok) break } catch {} await new Promise((r) => setTimeout(r, 500)) }
  browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript((s) => { localStorage.setItem('sb-mock-auth-token', JSON.stringify(s)) }, session)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 1500)}`) })

  await page.route('**://mock.supabase.co/**', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const json = (body, extra = {}) => route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) })
    log.push(`${req.method()} ${p}`)
    if (p === '/auth/v1/user') return json(user)
    if (p === '/auth/v1/token') return json(session)
    if (p.endsWith('/rpc/my_chats')) return json(chats)
    if (p.endsWith('/rpc/chat_peer')) return json([{ other_id: other, other_username: 'friend', other_display_name: 'Friend One', other_avatar_url: null }])
    if (p.endsWith('/rpc/ensure_my_profile')) return json(profile)
    if (p.endsWith('/rpc/mark_chat_read')) return json(null)
    if (p === '/rest/v1/profiles') return json((req.headers()['accept'] || '').includes('vnd.pgrst.object') ? profile : [profile])
    if (p === '/rest/v1/messages') return json([msg(1, true), msg(2, false)])
    return json([], { 'content-range': '0-0/0' })
  })

  const snap = async (label) => {
    await page.waitForTimeout(2500)
    const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400))
    note('notice', `Screen: ${label}`, `${new URL(page.url()).pathname} :: ${t}`)
    if (/Something went wrong/.test(t)) errors.push(`CRASH SCREEN on ${label}: ${t}`)
  }
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' }); await snap('home')
  await page.goto(base + '/messages', { waitUntil: 'domcontentloaded' }); await snap('inbox')
  await page.goto(base + '/messages/c1', { waitUntil: 'domcontentloaded' }); await snap('chat c1')
  await page.goto(base + '/notifications', { waitUntil: 'domcontentloaded' }); await snap('notifications')
  note('notice', 'Requests seen', [...new Set(log)].join('\n'))
} catch (e) {
  errors.push(`script: ${e.message}`)
} finally {
  if (errors.length) { note('error', 'Problems found', [...new Set(errors)].slice(0, 8).join('\n---\n')); process.exitCode = 1 }
  else note('notice', 'Mock E2E', 'No crashes.')
  await browser?.close(); server.kill()
}
