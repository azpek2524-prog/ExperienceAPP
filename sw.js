/* Life Track - Service Worker
   Objetivo: cargar SIEMPRE rápido (como offline) y a la vez mantenerse al día.
   - Documento HTML: intenta la red con un límite de 2.5s; si no responde a
     tiempo, muestra el caché al instante y sigue actualizando en segundo plano.
   - Iconos y librerías (versionadas): caché primero. */
const CACHE = 'lifetrack-v7';
const TIMEOUT_MS = 2500;

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
    // Red con límite de tiempo: si tarda más de 2.5s, servir caché al instante.
    // La descarga de red continúa en segundo plano y refresca el caché para la próxima vez.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = (await cache.match(req)) || (await cache.match('./index.html')) || (await cache.match('./'));
      const red = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => null);
      const limite = new Promise((r) => setTimeout(() => r(null), TIMEOUT_MS));
      const rapido = await Promise.race([red, limite]);
      if (rapido) return rapido;      // la red respondió a tiempo -> versión fresca
      if (cached) return cached;       // red lenta -> caché al instante (la red sigue actualizando)
      return (await red) || cache.match('./index.html'); // sin caché -> espera la red
    })());
    return;
  }

  // Resto: caché primero con revalidación en segundo plano.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const red = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || red;
      })
    )
  );
});
