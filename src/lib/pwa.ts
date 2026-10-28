import { BASE } from './base'

/**
 * Registers the app-shell service worker (public/sw.js) in production builds only.
 * The worker never touches Supabase requests; see the header of public/sw.js.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE }).catch(() => {
      /* offline shell is a nice-to-have; the app works without it */
    })
  })
}
