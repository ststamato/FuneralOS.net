const CACHE = 'mera-mou-v6';
const ASSETS = [
  './index.html',
  './styles.css',
  './storage.js',
  './i18n.js',
  './config.js',
  './sync.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Navigation requests can be redirected by the host (e.g. Cloudflare Pages
// redirecting the bare "/" path). Safari refuses to let a service worker
// answer a navigation with a redirected response, so re-wrap it in a fresh
// Response before handing it back.
async function handleNavigate(request) {
  try {
    const response = await fetch(request);
    if (response.redirected) {
      const body = await response.blob();
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    return response;
  } catch (err) {
    const cached = await caches.match('./index.html');
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigate(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
