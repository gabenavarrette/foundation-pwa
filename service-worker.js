/**
 * FOUNDATION - SCRIPTURE MEMORY ENGINE (serviceworker.js)
 * Progressive Web App Offline Lifecycle Interceptor.
 */

const CACHE_NAME = 'foundation-v1';

// Asset files to cache locally for total offline capabilities
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

// 1. INSTALL EVENT: Core static shell caching
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching Application Shell Assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      // Force immediate activation without waiting for tab reloads
      return self.skipWaiting();
    })
  );
});

// 2. ACTIVATE EVENT: Old cache cleanup routine
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Cleared Deprecated Stale Cache Key:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // Gain control of all open clients/tabs immediately
      return self.clients.claim();
    })
  );
});

// 3. FETCH EVENT: Smarter network/cache routing
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Exclude Google Sheets and ESV external API network payloads from static caching rules
  if (requestUrl.hostname.includes('google.com') || requestUrl.hostname.includes('esv.org')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fallback gracefully to network failure states silently
        return new Response(JSON.stringify({ error: "Offline. Syncing paused." }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Standard App Files (HTML/CSS/JS): Cache-First strategy for instantaneous loads
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch a fresh version in the background to update the cache for next time
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Silent catch if offline */});
        
        return cachedResponse;
      }
      
      return fetch(event.request);
    })
  );
});
