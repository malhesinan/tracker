/* ============================================================================
   SERVICE WORKER
   ----------------------------------------------------------------------------
   The whole app is precached on install, so every screen works with no signal.
   Strategy: cache-first for app files (instant launch), with a quiet network
   refresh so a new deploy is picked up on the next launch.
   ========================================================================== */

const VERSION = 'workout-tracker-v1.1.0';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/util.js',
  './js/storage.js',
  './js/store.js',
  './js/stats.js',
  './js/prescription.js',
  './js/images.js',
  './js/data/exercises.js',
  './js/data/seed.js',
  './js/ui/components.js',
  './js/ui/lock.js',
  './js/ui/train.js',
  './js/ui/workout.js',
  './js/ui/program.js',
  './js/ui/history.js',
  './js/ui/more.js',
  './js/ui/resttimer.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigation: serve the shell so a cold offline launch still works.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Same-origin assets: cache first, refresh in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  /* Third-party media (exercise images from the ExerciseDB CDN, or any image
     URL you added yourself). Cache-first so a workout you have opened before
     still shows its images with no signal; cross-origin responses are cached
     whether they come back as CORS or opaque. */
  const isMedia = /\.(gif|png|jpe?g|webp|avif)(\?|$)/i.test(url.pathname + url.search);

  if (isMedia) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached))
    );
    return;
  }

  // Anything else third-party (the image catalogue call): network only.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
