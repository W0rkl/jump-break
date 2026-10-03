self.__JUMP_VERSION = "0f288c9b857006c3";
self.__JUMP_PRECACHE = ["./","assets/index-CnWY556w.css","assets/index-emZeEc5V.js","favicon.svg","fonts/dela-gothic-one.ttf","fonts/INTER-LICENSE.txt","fonts/inter-variable.woff2","fonts/OFL.txt","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable.png","index.html","manifest.webmanifest","media/candy-intro.mp4","media/candy-poster.jpg","media/duck.png","media/jump-cover.png","media/stack-cover.png"];
const scope = new URL(self.registration.scope);
const prefix = `jump-break:${scope.pathname}:`;
const cacheName = prefix + self.__JUMP_VERSION;
const urls = self.__JUMP_PRECACHE.map((path) => new URL(path, scope).href);
const allowed = new Set(urls);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(urls))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter((name) => name.startsWith(prefix) && name !== cacheName)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    }),
  );
});

async function cachedResponse(request, key) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(key);
  if (!cached) return fetch(request);
  const range = request.headers.get('range');
  if (!range || !key.endsWith('.mp4')) return cached;
  const bytes = await cached.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = Number(match?.[1] || 0);
  let end = Number(match?.[2] || bytes.byteLength - 1);
  if (match && !match[1] && match[2]) {
    start = Math.max(0, bytes.byteLength - Number(match[2]));
    end = bytes.byteLength - 1;
  }
  end = Math.min(end, bytes.byteLength - 1);
  if (
    !match ||
    (!match[1] && !match[2]) ||
    start > end ||
    start >= bytes.byteLength
  ) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${bytes.byteLength}` },
    });
  }
  const headers = new Headers(cached.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${bytes.byteLength}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname))
    return;
  const isShell =
    request.mode === 'navigate' &&
    (url.pathname === scope.pathname ||
      url.pathname === `${scope.pathname}index.html`);
  const key = isShell ? scope.href : url.href;
  if (!allowed.has(key)) return;
  event.respondWith(cachedResponse(request, key));
});
