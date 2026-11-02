/* Das System – Service Worker. GENERIERT von src/build.py aus src/sw.template.js – nicht direkt bearbeiten. */
const VERSION = '1.1.0';
const CACHE = 'das-system-' + VERSION;
const ASSETS = ['./', './index.html', './manifest.webmanifest', './version.json', './icon.svg', './icon-192.png', './icon-512.png'];
const NET_TIMEOUT = 3000; // ms – danach sofort Cache (wackliges Netz)

self.addEventListener('install', e => {
  // cache:'reload' umgeht den HTTP-Cache (GitHub Pages cached 10 Min.), damit die neue Version wirklich frisch geladen wird
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(u =>
    fetch(new Request(u, {cache: 'reload'})).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return c.put(u, r); })
  ))));
  // KEIN automatisches skipWaiting: die App fragt den Spieler ("Jetzt aktualisieren")
});
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
  if (e.data && e.data.type === 'GET_VERSION' && e.source) e.source.postMessage({type: 'VERSION', version: VERSION});
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('das-system-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms){ return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
// Network-first mit kurzem Timeout, Fallback Cache (für version.json)
function networkFirst(req, key){
  return Promise.race([fetch(req, {cache: 'no-store'}), timeout(NET_TIMEOUT)])
    .then(r => { if (r && r.ok){ const c = r.clone(); caches.open(CACHE).then(ca => ca.put(key, c)); } return r; })
    .catch(() => caches.match(key, {ignoreSearch: true}).then(r => r || new Response('{}', {headers: {'Content-Type': 'application/json'}})));
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const path = url.pathname;
  if (path.endsWith('/version.json')) { e.respondWith(networkFirst(req, './version.json')); return; }
  // App-Shell (index.html / Start-URL): aus dem Cache DIESER Version – sofort, auch offline.
  // Neue Versionen kommen über einen neuen Service Worker (sw.js ändert sich bei jedem Release) + Update-Popup.
  if (req.mode === 'navigate' || path.endsWith('/') || path.endsWith('/index.html')) {
    e.respondWith(caches.match('./index.html').then(r => r ||
      Promise.race([fetch(req), timeout(NET_TIMEOUT)]).catch(() => new Response('<h1>Offline</h1>', {headers: {'Content-Type': 'text/html; charset=utf-8'}}))));
    return;
  }
  // Rest: Cache-first, sonst Netz (und nachcachen)
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(r => r || fetch(req).then(res => {
    if (res.ok){ const c = res.clone(); caches.open(CACHE).then(ca => ca.put(req, c)); } return res;
  })));
});
