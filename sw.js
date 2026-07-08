/* Life Track - Service Worker
   Precachea el shell de la app y guarda en caché las librerías (React, Tailwind,
   Babel) la primera vez que cargan, para que la app funcione sin internet. */
const CACHE = 'lifetrack-v3';

// Recursos locales del propio origen (rutas relativas -> funcionan en subcarpetas)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Cachea cada recurso por separado: si uno falla, no aborta la instalación.
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Cache-first con revalidación en segundo plano (stale-while-revalidate).
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            // Guarda respuestas válidas (incluidas las opacas de CDN) para uso offline.
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
