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
  db.version(2).stores({
    diaries: 'date'      // { date: 'YYYY-MM-DD', text, createdAt, updatedAt }  하루에 일기 하나
  });
  db.version(3).stores({
    settings: 'key'      // { key: 'profile', name, birth: 'YYYY-MM-DD' } / { key: 'prefs', theme, character }
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
      // 반복 할 일: 같은 seriesId로 여러 날짜를 한 번에
      async addSeries(title, dates, repeat) {
        const seriesId = newId(), createdAt = new Date().toISOString();
        const list = dates.map(date => ({ id: newId(), title, date, done: false, doneAt: null, createdAt, seriesId, repeat }));
        await db.todos.bulkAdd(list);
        return list;
      },
      update: (id, changes) => db.todos.update(id, changes),
      remove: id => db.todos.delete(id),
      removeMany: ids => db.todos.bulkDelete(ids),
      restore: t => db.todos.put(t),               // 삭제 되돌리기
      restoreMany: list => db.todos.bulkPut(list)
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

    diaries: {
      get: date => db.diaries.get(date),
      dates: () => db.diaries.toCollection().primaryKeys(),
      async save(date, text) {
        const old = await db.diaries.get(date), at = new Date().toISOString();
        await db.diaries.put({ date, text, createdAt: old ? old.createdAt : at, updatedAt: at });
      },
      remove: date => db.diaries.delete(date)
    },

    profile: {
      get: () => db.settings.get('profile'),   // 없으면 undefined → 처음 켠 사용자
      set: (name, birth) => db.settings.put({ key: 'profile', name, birth })
    },

    prefs: {   // 테마·알림: { theme: 'pink' | 'black' | 'blue' | 'yellow' | 'green' | 'white', character: 'bunny' | 'clover', notify }
      async get() { const p = await db.settings.get('prefs'); if (!p) return {}; const { key, ...rest } = p; return rest; },
      set: prefs => db.settings.put({ key: 'prefs', theme: prefs.theme, character: prefs.character, notify: !!prefs.notify })
    },

    background: {   // 사용자가 고른 배경 사진 (줄인 JPEG Blob). 없으면 기본 배경
      async get() { const b = await db.settings.get('background'); return b ? b.blob : null; },
      set: blob => db.settings.put({ key: 'background', blob }),
      clear: () => db.settings.delete('background')
    },

    cache: {
      get: key => db.cache.get(key),
      set: (key, value) => db.cache.put({ key, value, savedAt: Date.now() })
    }
  };
})();
