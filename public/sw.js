const CACHE_NAME = 'esoko-nexus-offline-v3';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  // Don't interfere with API or realtime socket endpoints or Vite dev endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/__vite') || url.pathname.startsWith('/favicon')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => {
            if (cached) return cached;
            return new Response('<html><body><h1>Offline</h1></body></html>', { status: 503, headers: { 'Content-Type': 'text/html' } });
          })
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      // Prefer the current deployment. A cached hashed chunk can belong to a
      // previous build and cause the app to load as a blank page.
      const network = fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok && response.status !== 206) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });

      // Network first. Only use a cached response when the network is
      // unavailable; never let an old cached error mask a healthy deployment.
      return network
        .then((response) => (response && response.ok ? response : cached || response))
        .catch(() => cached || new Response(undefined, { status: 204 }));
    })
  );
});
