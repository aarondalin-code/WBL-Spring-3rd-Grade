(function(){
  const PREFIX = 'wblCsvCache:';

  function safe(v){ return String(v ?? '').trim(); }

  function parseCsv(text){
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

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

    const headers = (rows.shift() || []).map((h) => safe(h).replace(/^\uFEFF/, '').replace(/\s+/g, ''));

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

  async function fetchCsvCached(url, { ttlMs = 0, key } = {}){
    if (!ttlMs) return fetchCsv(url);

    const storageKey = getCacheKey(url, key);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.text === 'string' && Number.isFinite(parsed.ts)) {
          if ((Date.now() - parsed.ts) < ttlMs) return parsed.text;
        }
      }
    } catch (_) {}

    const text = await fetchCsv(url);

    try {
      localStorage.setItem(storageKey, JSON.stringify({ ts: Date.now(), text }));
    } catch (_) {}

    return text;
  }

  window.CSVUtils = {
    fetchCsv,
    fetchCsvCached,
    parseCsv,
  };
})();
