// ===== CONFIGURATION =====
const CACHE_NAME = 'meteo-pwa-v1';
// Liste minimale d'assets ; les images sont servies depuis /src/assets en dev/build Vite
const ASSETS = [
  '/',
  '/index.html',
  '/vite.svg',
  '/src/assets/icon-72.png',
  '/src/assets/icon-96.png',
  '/src/assets/icon-128.png',
  '/src/assets/icon-144.png',
  '/src/assets/icon-152.png',
  '/src/assets/icon-192.png',
  '/src/assets/icon-384.png',
  '/src/assets/icon-512.png'
];

// INSTALL
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// FETCH - cache-first for assets, network-only for APIs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  if (isApiRequest(url)) {
    event.respondWith(networkOnly(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

function isApiRequest(url) {
  return url.hostname.includes('open-meteo.com') || url.hostname.includes('geocoding-api');
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Pas de connexion internet' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.headers.get('accept')?.includes('text/html')) {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Contenu non disponible hors-ligne', { status: 503 });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

console.log('[SW] chargé');
