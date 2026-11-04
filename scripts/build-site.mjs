// Writes plain HTML pages (no JavaScript needed, HTTP 200) next to the app so app stores and search engines can read them:
//   /about/  /privacy/  /terms/  /delete-account/   (and /privacy-policy/ for the link used inside the app)
// Usage: node scripts/build-site.mjs [distDir]   Settings come from site.config.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] || 'dist'
const cfg = JSON.parse(readFileSync('site.config.json', 'utf8'))
const base = (process.env.VITE_BASE || '/').replace(/\/?$/, '/')
const email = cfg.contactEmail?.trim()
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const contact = email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : 'the contact form in the app (Settings → Contact Support)'

const css = `
:root{--bg:#f4f6ff;--fg:#14172b;--muted:#586079;--card:#fff;--line:#e2e6f5;--accent:#0a84ff}
@media(prefers-color-scheme:dark){:root{--bg:#0e1020;--fg:#eef0ff;--muted:#a3a9c6;--card:#171a30;--line:#2a2e4d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header,main,footer{max-width:720px;margin:0 auto;padding:16px 20px}
header{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px}
header img{width:36px;height:36px;border-radius:9px}
main{background:var(--card);border:1px solid var(--line);border-radius:18px;margin-top:8px;padding:24px}
h1{margin:.2em 0 .1em;font-size:1.8rem}h2{margin-top:1.6em;font-size:1.15rem}
a{color:var(--accent)}ul{padding-left:1.2em}.muted{color:var(--muted)}
nav a{margin-right:14px}footer{color:var(--muted);font-size:.9rem}
.btn{display:inline-block;background:var(--accent);color:#fff;border-radius:999px;padding:10px 20px;text-decoration:none;font-weight:600}
`

function page(slug, title, body, description) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${cfg.appName}</title><meta name="description" content="${esc(description)}">
<link rel="icon" href="${base}favicon-32.png"><style>${css}</style></head>
<body><header><img src="${base}icons/icon-192.png" alt=""><span>${cfg.appName}</span></header>
<nav style="max-width:720px;margin:0 auto;padding:0 20px"><a href="${base}about/">About</a><a href="${base}privacy/">Privacy Policy</a><a href="${base}terms/">Terms</a><a href="${base}delete-account/">Delete account</a></nav>
<main>${body}</main>
<footer>© ${cfg.appName} · Last updated ${cfg.updated} · Contact: ${contact}</footer></body></html>`
  for (const s of Array.isArray(slug) ? slug : [slug]) {
    const dir = join(dist, s)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), html)
  }
}

page('about', 'About', `
<h1>${cfg.appName}</h1>
<p class="muted">Connect with friends, share moments, chat and call, in one app.</p>
<h2>What you can do</h2>
<ul>
<li>Share posts and photos with friends, and follow Pages from creators and businesses.</li>
<li>Send private messages and make voice and video calls.</li>
<li>Join communities, react and comment on posts.</li>
<li>Control who sees your profile and content, block and report accounts, and protect your account with two-step verification.</li>
</ul>
<p><a class="btn" href="${base}">Open ${cfg.appName}</a></p>
<h2>Policies and help</h2>
<ul>
<li><a href="${base}privacy/">Privacy Policy</a></li>
<li><a href="${base}terms/">Terms of Service</a></li>
<li><a href="${base}delete-account/">How to delete your account and data</a></li>
</ul>
<h2>Contact</h2><p>Questions or problems? Reach us at ${contact}.</p>`,
  'iConnecto is a social app for sharing posts, chatting and calling.')

const privacy = `
<h1>Privacy Policy</h1><p class="muted">${cfg.appName} · Last updated ${cfg.updated}</p>
<p>${cfg.appName} is a social app for sharing posts, chatting and calling. This page explains what information the app uses, why, who else handles it, and how you can control or delete it.</p>
<h2>What we collect</h2><ul>
<li><strong>Account:</strong> your email address and password (the password is stored only as a secure hash by our sign-in provider).</li>
<li><strong>Profile:</strong> username, display name, bio, profile and cover photos, and optional About details you add (work, education, location, relationship status).</li>
<li><strong>Content you create:</strong> posts, photos, music you attach, comments, reactions, saved posts, communities and Pages you join or manage, and messages you send.</li>
<li><strong>Connections and safety:</strong> your friends and followers, accounts you block, and reports you file.</li>
<li><strong>Activity status:</strong> when you were last active, so friends can see "Online". You can turn this off in Settings.</li>
<li><strong>Security:</strong> the devices you sign in from (a device name and last-seen time) so we can show your active sessions and send sign-in alerts. If you turn on two-step verification, the sign-in provider stores the verification factor.</li>
<li><strong>Support requests:</strong> messages you send from Settings → Support, with basic device information to help us fix problems.</li>
<li><strong>Calls:</strong> the call's status and technical set-up messages so the call can connect. Voice and video go directly between phones where possible. We do not record calls.</li>
<li><strong>Notifications:</strong> a push token that identifies your phone, and your notification preferences.</li>
</ul>
<h2>What we do not do</h2><ul>
<li>We do not show ads and we do not sell your information.</li>
<li>We do not use third-party analytics or advertising trackers in the app.</li>
<li>We do not read your contacts or location.</li></ul>
<h2>Permissions</h2><p>The Android app may ask for the camera and microphone (calls, photos, video), photos you choose to upload, and permission to show notifications. You can change each one in your phone's settings.</p>
<h2>Who handles your information</h2><ul>
<li><strong>Supabase</strong> stores the database, sign-in, uploaded files and real-time messages.</li>
<li><strong>Google Firebase Cloud Messaging</strong> delivers push notifications. A notification's text, such as the beginning of a message, passes through Google to reach your phone.</li>
<li><strong>Google (STUN)</strong> helps two phones find each other for a call, which shares network addresses needed to connect.</li>
<li><strong>GitHub Pages</strong> hosts the app's web pages.</li></ul>
<h2>Who can see what</h2><p>Posts can be Public, Friends only or Only me, and you choose this when you post. Your profile, posts and activity are shown according to your privacy settings. People you block cannot see your posts or message you.</p>
<h2>Your choices and your data</h2><ul>
<li>Download a copy of your information: Settings → Your Information.</li>
<li>Deactivate your account (hides your profile until you come back): Settings → Account Deactivation.</li>
<li>Delete your account and data: see <a href="${base}delete-account/">How to delete your account</a>.</li>
<li>Edit or delete individual posts and comments at any time.</li></ul>
<h2>Children</h2><p>${cfg.appName} is not meant for children under 13, and we do not knowingly collect their information. If you believe a child has an account, contact us and we will remove it.</p>
<h2>Changes</h2><p>If this policy changes, the date at the top will change. Significant changes will be announced in the app.</p>
<h2>Contact</h2><p>Questions about privacy: ${contact}.</p>`
page(['privacy', 'privacy-policy'], 'Privacy Policy', privacy, 'How iConnecto uses, shares and protects your information.')

page('terms', 'Terms of Service', `
<h1>Terms of Service</h1><p class="muted">${cfg.appName} · Last updated ${cfg.updated}</p>
<p>By creating an account or using ${cfg.appName} you agree to these terms. If you do not agree, please do not use the app.</p>
<h2>Your account</h2><ul><li>Give a real email address and keep your password and verification codes private.</li><li>You are responsible for what happens under your account.</li><li>One person, one account. Do not pretend to be someone else.</li></ul>
<h2>Your content</h2><ul><li>You own what you post. You allow ${cfg.appName} to store and show it to the people you choose so the app can work.</li><li>Only post things you have the right to share, including photos and music.</li><li>You can delete your posts or your whole account at any time.</li></ul>
<h2>Not allowed</h2><ul><li>Harassment, threats, hate, or sexual content involving minors.</li><li>Spam, scams, fake accounts, or trying to break into other accounts.</li><li>Malware, or anything that harms the app or other people.</li><li>Sharing other people's private information without permission.</li></ul>
<h2>Safety and enforcement</h2><p>You can block and report people and content. We may remove content, or limit or close accounts that break these terms.</p>
<h2>Service</h2><p>We work to keep ${cfg.appName} available but cannot promise it will always be error-free or uninterrupted. Features may change.</p>
<h2>Changes</h2><p>We may update these terms. Important changes will be shown in the app. Using the app after a change means you accept it.</p>
<h2>Contact</h2><p>${contact}.</p>`, 'The rules for using iConnecto.')

page('delete-account', 'Delete your account', `
<h1>Delete your account and data</h1><p class="muted">${cfg.appName}</p>
<h2>Delete it yourself in the app</h2>
<ol><li>Open ${cfg.appName} and sign in.</li><li>Go to <strong>Settings → Account Center</strong>.</li><li>Tap <strong>Delete account</strong>, type your username to confirm, and tap Delete.</li></ol>
<p>This is immediate and cannot be undone.</p>
<h2>What is deleted</h2><ul>
<li>Your profile, photos, posts, comments, reactions and saved posts.</li>
<li>Your messages and call history, your friends list, and your support requests.</li>
<li>Files you uploaded (photos and audio).</li>
<li>Your sign-in account.</li></ul>
<p>Copies of messages you sent that other people have already received on their phones are not on our servers after deletion.</p>
<h2>Can't sign in?</h2>
<p>Email ${contact} from the address registered on your account with the subject "Delete my account", and include your username. We will confirm that the request comes from you and delete the account.</p>
<h2>Just want a break?</h2><p>Use <strong>Settings → Account Deactivation</strong> to hide your profile without deleting anything. You can reactivate by signing in.</p>
<p><a href="${base}privacy/">Privacy Policy</a></p>`, 'How to delete your iConnecto account and data.')

if (!email) console.warn('::warning title=No contact email::site.config.json has no contactEmail. App stores require a public contact address.')
console.log('Site pages written to', dist)
