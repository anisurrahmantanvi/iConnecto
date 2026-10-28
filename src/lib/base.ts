/** The path the app is served from: `/` normally, `/iconnecto/` on a GitHub Pages project site. */
export const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'

/** Router basename: no trailing slash, and undefined at the root. */
export const ROUTER_BASENAME: string | undefined = BASE.replace(/\/+$/, '') || undefined

/** Absolute URL of an in-app route, e.g. appUrl('/auth/callback'). */
export function appUrl(path: string): string {
  return `${window.location.origin}${BASE.replace(/\/+$/, '')}${path.startsWith('/') ? path : '/' + path}`
}

/** URL of a file from /public, e.g. publicUrl('icons/icon-96.png'). */
export function publicUrl(path: string): string {
  return `${BASE}${path.replace(/^\/+/, '')}`
}
