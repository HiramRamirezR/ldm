const CACHE = 'ldm-v4'

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([
      '/',
      '/index.html',
      '/manifest.json',
      '/icon.svg'
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

  if (path.startsWith('/data/by-chapter/')) {
    e.respondWith(cacheFirst(request))
    return
  }

  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then(r => r || fetch(request))
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
