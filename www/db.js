/* Velum · almacenamiento local (IndexedDB) */
(function (global) {
  'use strict';
  let dbp = null;

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const r = indexedDB.open('velum', 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          for (const s of ['meta', 'art', 'kv']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return dbp;
  }

  async function run(store, mode, fn) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const req = fn(s);
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const DB = {
    get: (store, key) => run(store, 'readonly', s => s.get(key)),
    set: (store, key, val) => run(store, 'readwrite', s => s.put(val, key)),
    del: (store, key) => run(store, 'readwrite', s => s.delete(key)),
    clear: store => run(store, 'readwrite', s => s.clear()),
    setMany: (store, entries) => run(store, 'readwrite', s => { for (const [k, v] of entries) s.put(v, k); }),
    async all(store) {
      const d = await open();
      return new Promise((resolve, reject) => {
        const out = new Map();
        const t = d.transaction(store, 'readonly');
        const req = t.objectStore(store).openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) { out.set(c.key, c.value); c.continue(); }
        };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
      });
    }
  };

  // Guardado diferido para valores que cambian seguido (sesión, estadísticas…)
  const pending = new Map();
  DB.later = (key, val, ms = 800) => {
    if (pending.has(key)) clearTimeout(pending.get(key).t);
    pending.set(key, { val, t: setTimeout(() => { pending.delete(key); DB.set('kv', key, val).catch(() => { }); }, ms) });
  };
  DB.flush = () => {
    for (const [key, p] of pending) { clearTimeout(p.t); DB.set('kv', key, p.val).catch(() => { }); }
    pending.clear();
  };

  global.DB = DB;
})(window);
