const rtf = typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' })
  : null

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = (then - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'now'
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2629800],
    ['year', 31557600],
  ]
  let unit: Intl.RelativeTimeFormatUnit = 'minute'
  let size = 60
  for (const [u, s] of units) {
    if (abs >= s) {
      unit = u
      size = s
    }
  }
  const value = Math.round(diff / size)
  return rtf ? rtf.format(value, unit) : new Date(iso).toLocaleDateString()
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function compactNumber(n: number): string {
  if (n < 1000) return String(n)
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function initials(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return '?'
  const parts = n.split(/\s+/).slice(0, 2)
  return parts.map((p) => Array.from(p)[0]?.toUpperCase() ?? '').join('') || '?'
}

/**
 * Removes characters that have meaning inside PostgREST filter strings and ILIKE patterns.
 * "_" is kept on purpose: usernames contain it, and as an ILIKE wildcard it still matches itself.
 */
export function sanitizeSearch(q: string): string {
  return q.replace(/[%,()\\*"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50)
}

/** Escapes LIKE wildcards so an exact (case-insensitive) match via ilike cannot match other rows. */
export function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => '\\' + c)
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
