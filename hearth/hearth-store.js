// Local stand-in for the Canva data SDK. Same surface (init / create / update),
// but records live in this browser's localStorage. When demo.js has seeded
// window.__hearthSeed, records stay in memory so demos never touch real data.
(function () {
  const KEY = "hearth.records.v1";
  const seed = window.__hearthSeed && window.__hearthSeed.records;
  let memory = seed ? seed.map(record => ({ ...record })) : null;
  let handler = null;

  function load() {
    if (memory) return memory;
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (error) {
      return [];
    }
  }

  function persist(records) {
    if (memory) {
      memory = records;
      return true;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(records));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Fire after the caller's own bookkeeping, so the refreshed list (with ids) wins.
  function notify() {
    const data = load().map(record => ({ ...record }));
    setTimeout(() => handler && handler.onDataChanged(data), 0);
  }

  function newId() {
    return "rec_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  window.dataSdk = {
    async init(nextHandler) {
      handler = nextHandler;
      notify();
      return { isOk: true };
    },
    async create(record) {
      const records = load().slice();
      records.push({ ...record, __backendId: newId() });
      const ok = persist(records);
      if (ok) notify();
      return { isOk: ok };
    },
    async update(record) {
      const records = load().slice();
      const index = records.findIndex(item => record.__backendId
        ? item.__backendId === record.__backendId
        : item.date === record.date);
      if (index < 0) return { isOk: false };
      records[index] = { ...records[index], ...record, __backendId: records[index].__backendId };
      const ok = persist(records);
      if (ok) notify();
      return { isOk: ok };
    }
  };
})();
