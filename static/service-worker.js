self.addEventListener('install', event => event.waitUntil(caches.open('vcm-shell-v1').then(cache => cache.addAll(['/','/static/css/app.css']))));
self.addEventListener('fetch', event => event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))));
