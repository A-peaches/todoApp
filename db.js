// 공주 투두 로컬 DB
// 사용자 폰(브라우저) 안의 IndexedDB에 저장해요. 서버로는 아무것도 보내지 않아요.
// Dexie.js(IndexedDB 래퍼)를 먼저 불러온 뒤 이 파일을 불러와야 해요.
(function () {
  const db = new Dexie('princessTodo');
  db.version(1).stores({
    todos: 'id, date',   // { id, title, date: 'YYYY-MM-DD', done, doneAt, createdAt }
    hearts: 'date',      // { date: 'YYYY-MM-DD', count }  하루에 한 줄
    cache: 'key'         // { key, value, savedAt }  날씨 같은 임시 데이터
  });

  const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

  window.PrincessDB = {
    async init() {
      // 브라우저가 저장 공간이 부족할 때 이 앱 데이터를 마음대로 지우지 않도록 요청
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
      // 예전 localStorage 버전(샘플 데이터)은 정리
      try { localStorage.removeItem('princessTodo.todos'); localStorage.removeItem('princessTodo.hearts'); } catch (e) {}
    },

    todos: {
      all: () => db.todos.toArray(),
      async add(title, date) {
        const t = { id: newId(), title, date, done: false, doneAt: null, createdAt: new Date().toISOString() };
        await db.todos.add(t);
        return t;
      },
      setDone: (id, done) => db.todos.update(id, { done, doneAt: done ? new Date().toISOString() : null }),
      remove: id => db.todos.delete(id)
    },

    hearts: {
      async get(date) { const h = await db.hearts.get(date); return h ? h.count : 0; },
      add: date => db.transaction('rw', db.hearts, async () => {
        const h = await db.hearts.get(date);
        const count = (h ? h.count : 0) + 1;
        await db.hearts.put({ date, count });
        return count;
      })
    },

    cache: {
      get: key => db.cache.get(key),
      set: (key, value) => db.cache.put({ key, value, savedAt: Date.now() })
    }
  };
})();
