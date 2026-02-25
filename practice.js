/* -------------------- Utils (match site style) -------------------- */
function safe(v){ return String(v ?? "").trim(); }
function norm(v){ return safe(v).toLowerCase(); }

async function fetchCsv(url){
  if (!url) throw new Error("Missing DRILLS_CSV_URL in data.js");
  const bust = (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  const res = await fetch(url + bust, { cache:"no-store" });
  if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
  return await res.text();
}

function parseCsv(text){
  const rows = [];
  let row = [], cur = "", inQuotes = false;

  for (let i=0; i<text.length; i++){
    const ch = text[i], next = text[i+1];

    if (ch === '"'){
      if (inQuotes && next === '"'){ cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === ","){ row.push(cur); cur=""; continue; }

    if (!inQuotes && (ch === "\n" || ch === "\r")){
      if (ch === "\r" && next === "\n") i++;
      row.push(cur); cur="";
      if (row.some(v => safe(v) !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  row.push(cur);
  if (row.some(v => safe(v) !== "")) rows.push(row);

  const headers = (rows.shift() || []).map(h => safe(h).replace(/\s+/g,""));
  return rows.map(r => {
    const o = {};
    headers.forEach((h, idx) => o[h] = safe(r[idx]));
    return o;
  }).filter(o => Object.values(o).some(v => safe(v) !== ""));
}

/* -------------------- Thumbnails -------------------- */
function getYouTubeId(url){
  url = safe(url);
  if (!url) return "";
  try{
    const u = new URL(url);
    const host = u.hostname.replace("www.","");

    if (host === "youtu.be") return u.pathname.slice(1);

    if (host.includes("youtube.com")){
      const v = u.searchParams.get("v");
      if (v) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx+1]) return parts[shortsIdx+1];

      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx+1]) return parts[embedIdx+1];
    }
  }catch(e){}
  return "";
}

function resolveThumb(videoUrl, thumbUrl){
  const t = safe(thumbUrl);
  if (t) return t;

  const id = getYouTubeId(videoUrl);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  return "./logo.png"; // fallback
}

/* -------------------- Render -------------------- */
const weekEl = document.getElementById("weekFilter");
const typeEl = document.getElementById("typeFilter");
const gridEl = document.getElementById("drillsGrid");
const emptyEl= document.getElementById("drillsEmpty");
const metaEl = document.getElementById("drillsMeta");

let all = [];

function renderWeekOptions(items){
  const weeks = Array.from(new Set(items.map(x => Number(x.week)).filter(n => Number.isFinite(n))))
    .sort((a,b)=>a-b);

  weekEl.innerHTML = "";

  if (!weeks.length){
    weekEl.innerHTML = `<option value="all">All Weeks</option>`;
    weekEl.value = "all";
    return;
  }

  const latest = weeks[weeks.length - 1];

  weekEl.insertAdjacentHTML("beforeend", `<option value="${latest}">Week ${latest} (Latest)</option>`);
  weekEl.insertAdjacentHTML("beforeend", `<option value="all">All Weeks</option>`);

  weeks.slice().reverse().forEach(w=>{
    if (w === latest) return;
    weekEl.insertAdjacentHTML("beforeend", `<option value="${w}">Week ${w}</option>`);
  });

  weekEl.value = String(latest);
}

function cardHtml(d){
  const title = safe(d.title) || "Drill";
  const desc  = safe(d.description);
  const type  = safe(d.type);
  const week  = safe(d.week);
  const url   = safe(d.videoUrl);
  const thumb = resolveThumb(url, d.thumbUrl);

  const pillType = type ? `<span class="drillPill">${type}</span>` : "";
  const pillWeek = week ? `<span class="drillPill drillPillMuted">Week ${week}</span>` : "";

  return `
    <a class="drillCard" href="${url}" target="_blank" rel="noopener">
      <div class="drillThumb">
        <img src="${thumb}" alt="${title}" loading="lazy" />
      </div>
      <div class="drillBody">
        <div class="drillMetaRow">
          ${pillType}
          ${pillWeek}
        </div>
        <div class="drillTitle">${title}</div>
        ${desc ? `<div class="drillDesc muted small">${desc}</div>` : ""}
      </div>
    </a>
  `;
}

function applyFilters(){
  const w = weekEl.value;
  const t = typeEl.value;

  const filtered = all.filter(d=>{
    const wOk = (w === "all") || String(d.week) === String(w);
    const tOk = (t === "all") || norm(d.type) === t;
    return wOk && tOk;
 
  });

  gridEl.innerHTML = filtered.map(cardHtml).join("");
  emptyEl.style.display = filtered.length ? "none" : "";
  metaEl.textContent = filtered.length ? `${filtered.length} drill(s)` : "";
}

async function initPractice(){
  try{
    const url = window.SHEET?.DRILLS_CSV_URL;
    if (!url){
      gridEl.innerHTML = `<div class="muted small">Missing <code>window.SHEET.DRILLS_CSV_URL</code> in <code>data.js</code>.</div>`;
      return;
    }

    const csv = await fetchCsv(url);
    const rows = parseCsv(csv);

    all = rows.map(r => ({
      week: safe(r.Week),
      type: norm(r.Type),
      title: safe(r.Title),
      description: safe(r.Description),
      videoUrl: safe(r.VideoURL),
      thumbUrl: safe(r.ThumbURL),
      active: norm(r.Active)
    }))
    .filter(x => x.videoUrl)
    .filter(x => !x.active || ["true","yes","1"].includes(x.active));

    // Sort newest week first, then type
    all.sort((a,b)=>{
      const aw = Number(a.week) || 0;
      const bw = Number(b.week) || 0;
      if (bw !== aw) return bw - aw;
      return String(a.type).localeCompare(String(b.type));
    });

    renderWeekOptions(all);
    applyFilters();

    weekEl.addEventListener("change", applyFilters);
    typeEl.addEventListener("change", applyFilters);

  }catch(e){
    console.error(e);
    gridEl.innerHTML = `<div class="muted small">Unable to load drills right now. (Check the published CSV URL.)</div>`;
  }
}

initPractice();
