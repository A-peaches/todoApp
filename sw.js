// 공주 투두 서비스 워커
// - 알림 표시 (안드로이드 크롬 등은 페이지에서 바로 띄울 수 없고 서비스 워커를 거쳐야 해요)
// - 알림을 누르면 열려 있는 앱으로 이동하거나 새로 열기
// - push: 나중에 푸시 서버를 붙이면 앱이 닫혀 있어도 여기로 알림이 와요
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./princess-todo.html');
  }));
});

self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || '₊‧Todo‧₊', { body: d.body || '', tag: d.tag }));
});
