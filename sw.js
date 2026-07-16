const CACHE = 'ldm-v2'
const PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/api.js',
  '/js/storage.js',
  '/manifest.json'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
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

  // Cache data files (Spanish scripture JSON)
  if (url.pathname.startsWith('/data/by-chapter/')) {
    e.respondWith(cacheFirst(request))
    return
  }

  // App shell
  e.respondWith(
    caches.match(request).then(r => r || fetch(request))
  )
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
