/* Life Track - Service Worker
   - El documento HTML se sirve "red primero": con internet siempre cargas la
     ÚLTIMA versión; sin internet, la versión guardada (offline).
   - Iconos y librerías (versionadas) se sirven "caché primero". */
const CACHE = 'lifetrack-v6';

// Recursos locales del propio origen (rutas relativas -> funcionan en subcarpetas)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
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

  const esNavegacion = req.mode === 'navigate' || req.destination === 'document';

  if (esNavegacion) {
    // RED PRIMERO: siempre intenta traer el HTML más reciente cuando hay conexión.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((c) => c || caches.match('./index.html') || caches.match('./'))
        )
    );
    return;
  }

  // CACHÉ PRIMERO con revalidación en segundo plano (para iconos y librerías).
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
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
