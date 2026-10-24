// 공주 투두 서비스 워커
// - 알림 표시 (안드로이드 크롬 등은 페이지에서 바로 띄울 수 없고 서비스 워커를 거쳐야 해요)
// - 알림을 누르면 열려 있는 앱으로 이동하거나 새로 열기
// - push: 푸시 서버가 { slot, weather }를 보내면, 폰 안의 이름·할 일로 문구를 완성해서 띄워요
importScripts('notify.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
      body: body || '', tag: d.slot ? 'todo-' + d.slot : d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png'
    });
  })());
});
