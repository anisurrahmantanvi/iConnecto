/*
 * iConnecto app-shell service worker.
 *
 * What it does
 *   - Navigations: network first, falling back to the cached app shell when offline (the SPA then shows its own
 *     offline banner).
 *   - Hashed build assets (/assets/*): cache first (file names change when content changes).
 *   - Emoji images from the emoji CDN: cache first, so emoji keep rendering offline.
 *
 * What it deliberately does NOT do
 *   - It never caches or intercepts requests to Supabase (REST, auth, storage, realtime). Auth tokens and private
 *     data must never be stored by a worker.
 *   - It does not implement push notifications.
 */
// Works at the site root and under a sub-path such as /iconnecto/ (GitHub Pages).
const BASE = new URL(self.registration.scope).pathname
const SHELL = 'ic-shell-v1'
const ASSETS = 'ic-assets-v1'
const EMOJI = 'ic-emoji-v1'
const KEEP = [SHELL, ASSETS, EMOJI]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([BASE, BASE + 'favicon.ico', BASE + 'icons/icon-192.png', BASE + 'manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          // Opaque (cross-origin, no-cors) image responses have status 0 and are fine to keep.
          if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone())
          return response
        }),
    ),
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(SHELL).then((cache) => cache.put(BASE, copy))
          }
          return response
        })
        .catch(() => caches.match(BASE)),
    )
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(BASE + 'assets/')) {
    event.respondWith(cacheFirst(request, ASSETS))
    return
  }

  if (url.pathname.endsWith('.svg') && /twemoji|emoji/i.test(url.href) && url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(request, EMOJI))
  }
})

// Tapping a system notification brings the app to the front (or opens it).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin + BASE))
      return open ? open.focus() : self.clients.openWindow(BASE)
    }),
  )
})
