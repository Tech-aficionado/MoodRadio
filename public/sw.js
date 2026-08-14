// MoodRadio service worker.
//
// This file is served verbatim from public/, so it is NEVER compiled. It must
// be plain JavaScript that a classic (non-module) worker can evaluate:
// no type annotations, no type assertions, and no import/export statements.
// ServiceWorkerRegistration registers it with register('/sw.js') and no
// { type: 'module' }, so an ESM export here is a fatal parse error.

const CACHE_NAME = 'moodradio-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = ['/', '/offline'];

// Install: cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for navigations, stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Navigation requests: network-first, fallback to the offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigations
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_URL).then(
            // respondWith() rejects on undefined, which surfaces as a
            // confusing network error rather than an offline page, so give
            // it a real Response when the offline shell was never cached.
            (cached) =>
              cached ||
              new Response(
                '<!doctype html><title>Offline</title><h1>Offline</h1>',
                {
                  status: 503,
                  headers: { 'Content-Type': 'text/html; charset=utf-8' },
                }
              )
          )
        )
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images): stale-while-revalidate
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
  }
});
