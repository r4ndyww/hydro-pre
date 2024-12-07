self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('hydro-ai-cache').then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/set/styles.css',
                '/set/script.js',
                '/img/icon.png'
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
