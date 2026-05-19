// ── TinyWins Service Worker ──
// Strategy: Network-First for app files → always gets latest on deploy
// Cache-First for external fonts/icons → fast load

const CACHE_VERSION = 'tinywins-2026051901';
const CACHE_NAME = `tw-${CACHE_VERSION}`;

const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

const EXTERNAL_ASSETS = [
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@700;800&display=swap'
];

// ── INSTALL: Cache everything immediately ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...APP_FILES, ...EXTERNAL_ASSETS]).catch(() => {
        // If external assets fail, just cache local ones
        return cache.addAll(APP_FILES);
      });
    })
  );
  self.skipWaiting(); // Activate immediately, don't wait for old SW to die
});

// ── ACTIVATE: Clean up old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('tw-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
  // Notify all open tabs that a new version is active
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
  });
});

// ── FETCH: Network-First for app files, Cache-First for externals ──
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Skip non-GET and cross-origin API calls (Groq, etc.)
  if (event.request.method !== 'GET') return;
  if (url.includes('api.groq.com') || url.includes('googleapis.com/fitness')) return;

  // App files → Network First (always try to get fresh version)
  if (url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          // Update cache with fresh response
          const cloned = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return networkRes;
        })
        .catch(() => {
          // Offline fallback: serve from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // External assets (fonts, icons) → Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((networkRes) => {
        const cloned = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return networkRes;
      });
    })
  );
});

// ── FORCE REFRESH message from app ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FORCE_REFRESH') {
    caches.keys().then((keys) => Promise.all(keys.map(k => caches.delete(k)))).then(() => {
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'RELOAD' }));
      });
    });
  }
});

// ── Notification tap → open app ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('tinywins') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('https://cloudkalakaar.github.io/tinywins/');
    })
  );
});
