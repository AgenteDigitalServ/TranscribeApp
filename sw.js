
const CACHE_NAME = 'voznote-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Estratégia: Tenta rede primeiro para estar sempre atualizado, fallback para cache se offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
