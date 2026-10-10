'use strict';
// Public shell only. Account data and the training queue stay outside CacheStorage.
const FITFLOW_CACHE_PREFIX = 'fitflow-public-shell-';
const FITFLOW_CACHE = `${FITFLOW_CACHE_PREFIX}2026-10-08.2`;
const FITFLOW_PUBLIC_ASSETS = Object.freeze([
  '/offline.html', '/css/pwa.css', '/js/pwa.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png',
]);
function publicResponse(response, pathname) {
  if (!response.ok || response.redirected || response.type === 'opaque') return false;
  if (/\b(?:private|no-store)\b/i.test(response.headers.get('cache-control') || '')) return false;
  if ((response.headers.get('vary') || '').toLowerCase().split(',').some(token => ['cookie', 'authorization', '*'].includes(token.trim())) || response.headers.has('set-cookie')) return false;
  const type = response.headers.get('content-type') || '';
  const expected = pathname.endsWith('.png') ? /^image\/png/i : pathname.endsWith('.css') ? /^text\/css/i
    : pathname.endsWith('.js') ? /^(?:text|application)\/(?:java|ecma)script/i
      : pathname.endsWith('.webmanifest') ? /^application\/(?:manifest\+json|json)/i : /^text\/html/i;
  return expected.test(type);
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(FITFLOW_CACHE);
    // Fetch the complete public allowlist first; a failed install cannot claim clients.
    const entries = await Promise.all(FITFLOW_PUBLIC_ASSETS.map(async pathname => {
      const request = new Request(new URL(pathname, self.location.origin), { credentials: 'omit', cache: 'reload' });
      const response = await fetch(request);
      if (!publicResponse(response, pathname)) throw new Error(`Recurso público indisponível: ${pathname}`);
      return [pathname, response];
    }));
    for (const [pathname, response] of entries) await cache.put(pathname, response);
  })());
  // Keep an update waiting until open tabs close; no forced reload while typing a set.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(FITFLOW_CACHE_PREFIX) && name !== FITFLOW_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || request.headers.has('authorization') ||
    /^\/(?:api|auth)(?:\/|$)/i.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.status < 500) return response;
      } catch { /* Network unavailable: return only the public offline page. */ }
      const cache = await caches.open(FITFLOW_CACHE);
      return await cache.match('/offline.html') || new Response('FitFlow sem conexão. Reconecte-se e tente novamente.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    })());
  } else if (FITFLOW_PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(FITFLOW_CACHE), cached = await cache.match(url.pathname);
      return cached || fetch(new Request(request, { credentials: 'omit' }));
    })());
  }
});
