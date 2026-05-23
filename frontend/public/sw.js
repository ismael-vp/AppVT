const CACHE_NAME = 'phishingscanner-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A minimal fetch event listener so it qualifies as a PWA
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Estás desconectado. Revisa tu conexión a internet para continuar usando PhishingScanner.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    })
  );
});
