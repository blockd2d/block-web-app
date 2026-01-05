/**
 * Service Worker for Block
 * Provides offline caching for HTTP/HTTPS deployments
 */

const CACHE_NAME = 'salesrepmanager-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/cluster-creation.html',
    '/cluster-assignment.html',
    '/sales-reps.html',
    '/sales.html',
    '/add-sale.html',
    '/add-rep.html',
    '/css/styles.css',
    '/js/utils.js',
    '/js/store.js',
    '/js/ui.js',
    '/js/router.js',
    '/js/app.js',
    '/js/map/projection.js',
    '/js/map/basemap.js',
    '/js/map/overlay.js',
    '/js/map/MapView.js',
    '/js/clustering/hull.js',
    '/js/clustering/dbscan.js',
    '/js/pages/home.js',
    '/js/pages/clusterCreation.js',
    '/js/pages/clusterAssignment.js',
    '/js/pages/reps.js',
    '/js/pages/sales.js',
    '/js/pages/addSale.js',
    '/js/pages/addRep.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app assets');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((err) => {
                console.log('Cache failed:', err);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip non-HTTP(S) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version if available
                if (response) {
                    return response;
                }

                // Otherwise fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Clone the response before caching
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // Return offline fallback for HTML pages
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});
