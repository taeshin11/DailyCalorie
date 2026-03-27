var CACHE_NAME = "tdee-v3";
var ASSETS = [
    "./",
    "./index.html",
    "./app.js",
    "./manifest.json",
    "https://cdn.tailwindcss.com",
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"
];

self.addEventListener("install", function(e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_NAME; })
                    .map(function(k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener("fetch", function(e) {
    e.respondWith(
        caches.match(e.request).then(function(cached) {
            return cached || fetch(e.request).then(function(response) {
                if (response.status === 200) {
                    var clone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(e.request, clone);
                    });
                }
                return response;
            });
        }).catch(function() {
            return caches.match("./index.html");
        })
    );
});
