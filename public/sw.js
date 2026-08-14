/// <reference lib="webworker" />

const CACHE_NAME = 'moodradio-v1';
const OFFLINE_URL = '/offline';

const PRECACHE_URLS = [
  '/',
  '/offline',
];

// Install: cache shell
self.addEventListener('install', (event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  (self as any).skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  const e = event as ExtendableEvent;
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  (self as any).clients.claim();
});

// Fetch: network-first for navigations, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const e = event as FetchEvent;
  const { request } = e;

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Navigation requests: network-first, fallback to offline page
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigations
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL) as Promise<Response>)
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
    e.respondWith(
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
    return;
  }
});

export {};
