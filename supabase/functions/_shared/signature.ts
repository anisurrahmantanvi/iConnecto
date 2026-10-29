// Didit webhook signature (X-Signature-V2): HMAC-SHA256 (hex) over the body re-serialised with recursively sorted keys,
// compact separators and un-escaped Unicode. See https://docs.didit.me/integration/api-full-flow
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k])
    return out
  }
  return value
}

export function canonicalJson(rawBody: string): string {
  return JSON.stringify(sortKeys(JSON.parse(rawBody)))
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** true when the signature and timestamp (max 5 minutes old) are valid. */
export async function verifyDiditWebhook(rawBody: string, signature: string | null, timestamp: string | null, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!signature || !timestamp || !secret) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  const tsMs = ts < 1e12 ? ts * 1000 : ts
  if (Math.abs(nowMs - tsMs) > 5 * 60 * 1000) return false
  let canonical: string
  try { canonical = canonicalJson(rawBody) } catch { return false }
  const expected = await hmacHex(secret, canonical)
  return safeEqual(expected, signature.trim().toLowerCase())
}
