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
const SHELL = 'ic-shell-v1'
const ASSETS = 'ic-assets-v1'
const EMOJI = 'ic-emoji-v1'
const KEEP = [SHELL, ASSETS, EMOJI]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/favicon.ico', '/icons/icon-192.png', '/manifest.webmanifest']))
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
            caches.open(SHELL).then((cache) => cache.put('/', copy))
          }
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS))
    return
  }

  if (url.pathname.endsWith('.svg') && /twemoji|emoji/i.test(url.href) && url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(request, EMOJI))
  }
})
