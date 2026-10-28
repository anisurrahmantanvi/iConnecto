// `import.meta.env` is replaced by Vite at build time. Reading it through a guarded object keeps this module
// importable outside Vite (for example in plain-Node unit tests of the emoji helpers).
const meta: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

// Tolerate common copy-paste slips: wrapping quotes, stray spaces, a missing https://, a trailing slash or /rest/v1.
const clean = (v: string | undefined) => (v ?? '').trim().replace(/^['"`]+|['"`]+$/g, '').trim()
function normalizeUrl(raw: string): string {
  if (!raw) return ''
  let u = raw
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u.replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/i, '')
}
const url = normalizeUrl(clean(meta.VITE_SUPABASE_URL))
const key = clean(meta.VITE_SUPABASE_PUBLISHABLE_KEY)

export const urlIsValid: boolean = (() => {
  try {
    return !!url && !!new URL(url).hostname
  } catch {
    return false
  }
})()

export const env = {
  supabaseUrl: url,
  supabaseKey: key,
  emojiBaseUrl:
    (meta.VITE_EMOJI_BASE_URL ?? '').trim() ||
    'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/',
}

export const missingEnv: string[] = [
  ...(url ? [] : ['VITE_SUPABASE_URL']),
  ...(key ? [] : ['VITE_SUPABASE_PUBLISHABLE_KEY']),
  ...(url && !urlIsValid ? ['VITE_SUPABASE_URL (not a valid URL)'] : []),
]

// A service-role key must never reach the browser. Refuse to boot if one was pasted by mistake.
export function looksLikeServiceRoleKey(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true
  try {
    const part = k.split('.')[1]
    if (!part) return false
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return json?.role === 'service_role'
  } catch {
    return false
  }
}

export const unsafeKey = key ? looksLikeServiceRoleKey(key) : false

export function getIceServers(): RTCIceServer[] {
  const raw = (meta.VITE_ICE_SERVERS ?? '').trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as RTCIceServer[]
    } catch {
      /* fall through to the public STUN default */
    }
  }
  // Public STUN only. It does NOT relay media; users behind strict NATs need a TURN server.
  return [{ urls: 'stun:stun.l.google.com:19302' }]
}
