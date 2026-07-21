const CACHE = 'ldm-app-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([
      '/manifest.json',
      '/icon.svg',
      '/js/confetti.min.js'
    ]))
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)
  const path = url.pathname

  // Chapter data: cache-first (works offline for downloaded chapters)
  if (path.startsWith('/data/by-chapter/')) {
    e.respondWith(cacheFirst(request))
    return
  }

  // App shell (HTML, JS, CSS, images): network-first
  // Always fetches fresh from server when online, falls back to cache when offline
  e.respondWith(networkFirst(request))
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(CACHE)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    return new Response('Sin conexión', { status: 503 })
  }
}

async function networkFirst(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(CACHE)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // If offline and nothing cached for this request, try serving index.html
    // so that deep links and SPA navigation work offline
    if (request.mode === 'navigate') {
      const index = await caches.match('/index.html')
      if (index) return index
    }
    return new Response('Sin conexión', { status: 503 })
  }
}
