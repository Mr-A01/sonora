/* SONORA Service Worker v5 */
const CACHE = 'sonora-v5';
const PRECACHE = [
  './',
  './index.html',
  './css/styles.css',
  './css/fixes.css',
  './css/eq.css',
  './css/share.css',
  './js/data.js',
  './js/covers.js',
  './js/eq.js',
  './js/id3.js',
  './js/app.js',
  './js/deeplink.js',
  './js/share.js',
  './js/foryou.js',
  './js/seo.js',
  './js/phase-b.js',
  './js/polish.js',
  './manifest.webmanifest',
  './robots.txt'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const path = url.pathname;
  if (path.endsWith('/audio/manifest.json')) {
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
          return r;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (/\.(mp3|m4a|aac|ogg|oga|opus|flac|wav)$/i.test(path)) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((r) => {
        if (r.ok && (path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.html') || path.endsWith('.webmanifest'))) {
          const clone = r.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone));
        }
        return r;
      });
    })
  );
});
