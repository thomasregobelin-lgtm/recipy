/* ═══════════════════════════════════════════════════════
   Recipy — Service Worker
   Stratégie : Cache-first pour les assets statiques,
               Network-first pour les requêtes réseau.
═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'recipy-v1';

// Fichiers à mettre en cache au premier chargement
const PRECACHE_URLS = [
  './recipy.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700,900&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

/* ── Install : pré-cache les assets essentiels ─────────── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // On utilise addAll avec gestion d'erreur individuelle
      // pour ne pas bloquer si un CDN externe échoue
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Impossible de cacher:', url, err.message);
          })
        )
      );
    }).then(function() {
      // Activation immédiate sans attendre l'ancienne version
      return self.skipWaiting();
    })
  );
});

/* ── Activate : purge les anciens caches ───────────────── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      // Prend le contrôle immédiatement de tous les clients
      return self.clients.claim();
    })
  );
});

/* ── Fetch : Cache-first avec fallback réseau ──────────── */
self.addEventListener('fetch', function(event) {
  const request = event.request;

  // Ignorer les requêtes non-GET (POST, etc.)
  if (request.method !== 'GET') return;

  // Ignorer les requêtes chrome-extension et autres schémas non-http
  if (!request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then(function(cachedResponse) {
      if (cachedResponse) {
        // Trouvé en cache — on sert depuis le cache
        // ET on met à jour en arrière-plan (stale-while-revalidate)
        fetch(request)
          .then(function(networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(request, networkResponse.clone());
              });
            }
          })
          .catch(function() { /* réseau indisponible, pas grave */ });

        return cachedResponse;
      }

      // Pas en cache — on tente le réseau
      return fetch(request)
        .then(function(networkResponse) {
          // On ne cache que les réponses valides
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }

          // Mise en cache de la nouvelle ressource
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(function() {
          // Réseau indisponible et pas en cache
          // Pour les navigations HTML, on sert l'app shell
          if (request.destination === 'document') {
            return caches.match('./recipy.html');
          }
          // Pour les autres ressources, on retourne une réponse vide
          return new Response('', {
            status: 503,
            statusText: 'Service Unavailable — offline'
          });
        });
    })
  );
});

/* ── Message : permet de forcer une mise à jour depuis l'app ─ */
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
