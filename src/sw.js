// Service Worker for TjenaMors.se — PWA install + offline shell.
// Caches minimal static assets; live stream and API are always network-only.

const CACHE = 'tjena-mors-v2';

// Minimal shell to show when offline (static assets only — no JS/CSS)
const SHELL = [
  '/',
  '/site.webmanifest',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Cache what we can — individual failures don't block install
      for (const url of SHELL) {
        try {
          await cache.add(url);
        } catch (_) {
          // File may not exist at this point; SW installs regardless
        }
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean old caches
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((k) => k !== CACHE)
        .map((k) => caches.delete(k))
      );
    })()
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go to network for live stream and API
  if (url.hostname === 'radio.tjenamors.se') return;

  // JS and CSS: network-first (always use latest deploy)
  // Navigation requests: network first, fall back to cache
  if (event.request.mode === 'navigate' || url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(event.request);
          if (network.ok) {
            const cache = await caches.open(CACHE);
            cache.put(event.request, network.clone());
          }
          return network;
        } catch (_) {
          return caches.match(event.request);
        }
      })()
    );
    return;
  }

  // Other static assets: cache first, fall back to network
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const network = await fetch(event.request);
        if (network.ok) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, network.clone());
        }
        return network;
      } catch (_) {
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
