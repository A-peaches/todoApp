// 공주 투두 서비스 워커
// - 알림 표시 (안드로이드 크롬 등은 페이지에서 바로 띄울 수 없고 서비스 워커를 거쳐야 해요)
// - 알림을 누르면 열려 있는 앱으로 이동하거나 새로 열기
// - push: 푸시 서버가 { slot, weather }를 보내면, 폰 안의 이름·할 일로 문구를 완성해서 띄워요
importScripts('notify.js');

// ---- 오프라인: 앱 파일과 라이브러리를 폰에 저장해 두고, 인터넷이 없으면 저장본으로 열기 ----
// 앱 파일은 '인터넷 먼저'(새 버전 바로 반영), 라이브러리·글꼴은 '저장본 먼저'(버전 고정이라 안 바뀜)
const CACHE = 'todo-offline-v12';
const APP_FILES = ['./princess-todo.html', './css/app.css', './js/app.js', './db.js', './notify.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/badge-96.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './icons/splash-192.png', './icons/splash-512.png'];
const LIBS = ['https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js'];
const STATIC_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_FILES.concat(LIBS))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // cache: 'no-cache' → 브라우저의 10분 캐시를 건너뛰고 서버에 바뀌었는지 물어봄 (안 바뀌었으면 304로 가볍게)
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? caches.match('./princess-todo.html') : Response.error())));
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
  // 날씨·푸시 서버 요청은 그대로 인터넷으로 (날씨는 앱이 DB에 따로 저장해 둠)
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./princess-todo.html');
  }));
});

// 앱의 IndexedDB(Dexie가 만든 princessTodo)에서 직접 읽기
function readLocal() {
  return new Promise(resolve => {
    const req = indexedDB.open('princessTodo');
    req.onerror = () => resolve({});
    req.onsuccess = () => {
      const db = req.result, out = {};
      const stores = ['settings', 'todos'].filter(n => db.objectStoreNames.contains(n));
      if (!stores.length) { db.close(); resolve(out); return; }
      const tx = db.transaction(stores, 'readonly');
      if (stores.includes('settings')) {
        tx.objectStore('settings').get('profile').onsuccess = e => { out.profile = e.target.result; };
        tx.objectStore('settings').get('prefs').onsuccess = e => { out.prefs = e.target.result; };
      }
      if (stores.includes('todos')) tx.objectStore('todos').getAll().onsuccess = e => { out.todos = e.target.result; };
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = () => { db.close(); resolve(out); };
    };
  });
}

self.addEventListener('push', e => {
  e.waitUntil((async () => {
    const d = e.data ? e.data.json() : {};
    const local = await readLocal();
    if (local.prefs && local.prefs.notify === false) return;   // 앱에서 알림을 껐으면 표시 안 함
    let body = d.body;
    if (!body && d.slot) {
      const n = new Date(), pad = x => String(x).padStart(2, '0');
      const today = n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
      const left = (local.todos || []).filter(t => t.date === today && !t.done).length;
      body = self.TodoNotify.buildMessage(d.slot, { name: local.profile && local.profile.name, weather: d.weather, left });
    }
    await self.registration.showNotification(d.title || '₊‧Todo‧₊', {
      body: body || '', tag: d.slot ? 'todo-' + d.slot : d.tag, icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png'   // 안드로이드 상단바: 투명 배경 흰 TO/DO (꽉 찬 아이콘은 흰 네모로 보임)
    });
  })());
});
