/* Life Track - Service Worker (robusto para redes lentas)
   - Precarga TODAS las librerías pesadas (React, ReactDOM, Babel, Tailwind,
     jsPDF, fuentes) para no re-descargarlas nunca en una red lenta.
   - Las librerías se buscan en CUALQUIER caché existente (nunca se pierden
     al actualizar).
   - El HTML intenta la red con límite de 2.5s; si tarda, sirve el caché al
     instante y actualiza en segundo plano.
   - Sólo limpia cachés viejos DESPUÉS de confirmar que el nuevo ya tiene las
     librerías (así una descarga fallida no te deja sin nada). */
const CACHE = 'lifetrack-shell';
const TIMEOUT_MS = 2500;

const LIBS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap',
];
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png',
].concat(LIBS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(APP_SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    // Limpia cachés viejos SÓLO si el nuevo ya tiene las librerías clave.
    const cache = await caches.open(CACHE);
    const listo = await cache.match(LIBS[1]); // react
    if (listo) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const esNavegacion = req.mode === 'navigate' || req.destination === 'document';

  if (esNavegacion) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const enCache = (await caches.match(req)) || (await cache.match('./index.html')) || (await cache.match('./'));
      const red = fetch(req).then((res) => {
        if (res && res.ok) cache.put('./index.html', res.clone()).catch(() => {});
        return res;
      }).catch(() => null);
      const limite = new Promise((r) => setTimeout(() => r(null), TIMEOUT_MS));
      const rapido = await Promise.race([red, limite]);
      if (rapido) return rapido;
      if (enCache) return enCache;
      return (await red) || cache.match('./index.html');
    })());
    return;
  }

  // Librerías / iconos: se buscan en CUALQUIER caché (nunca se pierden) y se
  // revalidan en segundo plano dentro del caché actual.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const enCache = await caches.match(req);
    const red = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => enCache);
    return enCache || red;
  })());
});
