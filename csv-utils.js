(function(){
  const PREFIX = 'wblCsvCache:';
  const memoryCache = new Map();
  const inflightRequests = new Map();

  function safe(v){ return String(v ?? '').trim(); }

  function parseCsv(text){
    const source = String(text ?? '').replace(/^\uFEFF/, '');
    if (!source.trim()) return [];

    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && ch === ',') { row.push(cur); cur = ''; continue; }

      if (!inQuotes && (ch === '\n' || ch === '\r')) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(v => safe(v) !== '')) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }

    row.push(cur);
    if (row.some(v => safe(v) !== '')) rows.push(row);

    const headers = (rows.shift() || []).map((h) => safe(h).replace(/\s+/g, ''));

    return rows
      .filter(r => r.some(v => safe(v) !== ''))
      .map((r) => {
        const o = {};
        headers.forEach((h, idx) => o[h] = safe(r[idx]));
        return o;
      });
  }

  async function fetchCsv(url){
    if (!url) throw new Error('Missing CSV URL');
    const res = await fetch(url, { cache: 'default' });
    if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
    return await res.text();
  }

  function getCacheKey(url, key){
    return PREFIX + (key || url);
  }

  function readLocalCache(storageKey){
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.text !== 'string' || !Number.isFinite(parsed.ts)) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeLocalCache(storageKey, payload){
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {}
  }

  async function fetchCsvCached(url, { ttlMs = 0, key } = {}){
    if (!ttlMs) return fetchCsv(url);

    const storageKey = getCacheKey(url, key);
    const now = Date.now();

    const memory = memoryCache.get(storageKey);
    if (memory && (now - memory.ts) < ttlMs) return memory.text;

    const local = readLocalCache(storageKey);
    if (local && (now - local.ts) < ttlMs) {
      memoryCache.set(storageKey, local);
      return local.text;
    }

    if (inflightRequests.has(storageKey)) return inflightRequests.get(storageKey);

    const request = (async () => {
      try {
        const text = await fetchCsv(url);
        const payload = { ts: Date.now(), text };
        memoryCache.set(storageKey, payload);
        writeLocalCache(storageKey, payload);
        return text;
      } catch (err) {
        if (local && typeof local.text === 'string') {
          return local.text;
        }
        throw err;
      } finally {
        inflightRequests.delete(storageKey);
      }
    })();

    inflightRequests.set(storageKey, request);
    return request;
  }

  window.CSVUtils = {
    fetchCsv,
    fetchCsvCached,
    parseCsv,
  };
})();
