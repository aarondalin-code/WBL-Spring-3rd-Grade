/* playoffs.js — True bracket alignment (WBL)
   Championship:
     Round 1:  (BYE S1) (BYE S2) plus games 146,147
     Semis:    148,149
     Final:    150

   Consolation:
     Round 1:  151,152
     Round 2:  153,154,155
     (No final column)
*/

(function () {
  const updatedEl = document.getElementById("playoffsUpdated");
  const seedNoteEl = document.getElementById("seedNote");
  const msgEl = document.getElementById("playoffsMsg");

  const champEl = document.getElementById("championshipBracket");
  const consEl  = document.getElementById("consolationBracket");

  function safe(v){ return String(v ?? "").trim(); }
  function norm(v){ return safe(v).toLowerCase(); }
  function toNum(x){
    const n = Number(safe(x));
    return Number.isFinite(n) ? n : null;
  }
  function isFinal(status){
    const s = norm(status);
    return s === "final" || s.startsWith("final");
  }

  async function fetchCsv(url) {
    if (!url) throw new Error("Missing CSV URL in data.js");
    const bust = (url.includes("?") ? "&" : "?") + "t=" + Date.now();
    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
    return await res.text();
  }

  // Robust CSV parser (quoted commas safe) + BOM strip on headers
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && ch === ",") { row.push(cur); cur = ""; continue; }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur); cur = "";
        if (row.some(v => safe(v) !== "")) rows.push(row);
        row = [];
        continue;
      }

      cur += ch;
    }
    row.push(cur);
    if (row.some(v => safe(v) !== "")) rows.push(row);

    const headers = (rows.shift() || []).map((h) => {
      let key = safe(h).replace(/\s+/g, "");
      key = key.replace(/^\uFEFF/, "");
      return key;
    });

    return rows
      .filter(r => r.some(x => safe(x) !== ""))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => obj[h] = safe(r[idx]));
        return obj;
      });
  }

  // --------- NEW: Completed-week gating (6 completed dates) ----------
  function parseDateLoose(s){
    s = safe(s);
    if (!s) return null;

    const d1 = new Date(s);
    if (!isNaN(d1.getTime())) return d1;

    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m){
      const mm = Number(m[1]) - 1;
      const dd = Number(m[2]);
      const yy = Number(m[3]);
      const d2 = new Date(yy, mm, dd);
      return isNaN(d2.getTime()) ? null : d2;
    }
    return null;
  }

  function completedLeagueDates(gameRows){
    // A "completed league date" = all games for that Date are Final
    const byDate = new Map();
    for (const g of gameRows){
      const d = safe(g.Date);
      if (!d) continue;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(g);
    }

    const complete = [];
    for (const [date, games] of byDate.entries()){
      if (!games.length) continue;
      const allFinal = games.every(x => isFinal(x.Status));
      if (allFinal) complete.push(date);
    }

    // Sort by actual date so "first 6 weeks" is meaningful
    complete.sort((a,b)=>{
      const da = parseDateLoose(a);
      const db = parseDateLoose(b);
      const ta = da ? da.getTime() : Number.POSITIVE_INFINITY;
      const tb = db ? db.getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });

    return complete;
  }

  // ---------- Standings -> Seeds ----------
  function buildStandings(teamNames){
    const map = new Map();
    for (const name of teamNames) {
      if (!name) continue;
      map.set(name, { team: name, W: 0, L: 0, T: 0, RF: 0, RA: 0, RD: 0, WP: 0 });
    }
    return map;
  }

  // Tie-breaker policy implemented here:
  // 1) Win% (W + 0.5T) / GP
  // 2) Head-to-head (only if exactly 2 teams tied AND they played AND not tied)
  // 3) Run Differential (overall)
  // 4) Runs For
  // 5) Runs Allowed (lower better)
  // 6) Team name
  function computeSeedsFromGames(teamNames, gameRows){
    const standings = buildStandings(teamNames);

    const h2h = new Map();
    function pairKey(a,b){
      const A = safe(a), B = safe(b);
      return (A < B) ? `${A}|${B}` : `${B}|${A}`;
    }
    function getPair(a,b){
      const k = pairKey(a,b);
      if (!h2h.has(k)) h2h.set(k, { A:"", B:"", aWins:0, bWins:0, ties:0 });
      const rec = h2h.get(k);
      const A = safe(a), B = safe(b);
      if (!rec.A || !rec.B){
        rec.A = (A < B) ? A : B;
        rec.B = (A < B) ? B : A;
      }
      return rec;
    }

    const finals = gameRows.filter(g => isFinal(g.Status));
    for (const g of finals) {
      const aName = safe(g.TeamA);
      const bName = safe(g.TeamB);
      const scoreA = toNum(g.ScoreA);
      const scoreB = toNum(g.ScoreB);
      if (!aName || !bName || scoreA === null || scoreB === null) continue;

      if (!standings.has(aName)) standings.set(aName, { team: aName, W:0, L:0, T:0, RF:0, RA:0, RD:0, WP:0 });
      if (!standings.has(bName)) standings.set(bName, { team: bName, W:0, L:0, T:0, RF:0, RA:0, RD:0, WP:0 });

      const A = standings.get(aName);
      const B = standings.get(bName);

      A.RF += scoreA; A.RA += scoreB;
      B.RF += scoreB; B.RA += scoreA;

      if (scoreA > scoreB) { A.W++; B.L++; }
      else if (scoreB > scoreA) { B.W++; A.L++; }
      else { A.T++; B.T++; }

      const rec = getPair(aName, bName);
      if (scoreA === scoreB){
        rec.ties++;
      } else {
        const winner = (scoreA > scoreB) ? aName : bName;
        if (winner === rec.A) rec.aWins++;
        else rec.bWins++;
      }
    }

    for (const v of standings.values()){
      v.RD = v.RF - v.RA;
      const gp = v.W + v.L + v.T;
      v.WP = gp ? (v.W + 0.5*v.T)/gp : 0;
    }

    const rows = Array.from(standings.values());

    rows.sort((a,b)=>{
      if (b.WP !== a.WP) return b.WP - a.WP;
      return a.team.localeCompare(b.team);
    });

    const resolved = [];
    let i = 0;
    while (i < rows.length){
      let j = i + 1;
      while (j < rows.length && rows[j].WP === rows[i].WP) j++;

      const group = rows.slice(i,j);
      if (group.length === 2){
        const A = group[0], B = group[1];
        const k = pairKey(A.team, B.team);
        const rec = h2h.get(k);
        if (rec){
          const recAwins = rec.aWins;
          const recBwins = rec.bWins;
          if (recAwins !== recBwins){
            const winner = (recAwins > recBwins) ? rec.A : rec.B;
            if (winner === A.team) resolved.push(A,B);
            else resolved.push(B,A);
            i = j;
            continue;
          }
        }
      }

      group.sort((a,b)=>{
        if (b.WP !== a.WP) return b.WP - a.WP;
        if (b.RD !== a.RD) return b.RD - a.RD;
        if (b.RF !== a.RF) return b.RF - a.RF;
        if (a.RA !== b.RA) return a.RA - b.RA;
        return a.team.localeCompare(b.team);
      });

      resolved.push(...group);
      i = j;
    }

    const bySeed = new Map();
    resolved.forEach((row, idx) => bySeed.set(idx + 1, row.team));
    return { ordered: resolved, bySeed };
  }

  // ---------- Team lookup ----------
  function slugifyTeamName(name) {
    return safe(name)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function teamMeta(teamName, teamNameToRow){
    const key = norm(teamName);
    const row = teamNameToRow.get(key);
    if (!row) {
      return {
        name: teamName,
        slug: slugifyTeamName(teamName),
        logo: window.DEFAULT_TEAM_LOGO || "./logo.png",
        color: ""
      };
    }
    return {
      name: safe(row.TeamName) || teamName,
      slug: safe(row.TeamSlug) || slugifyTeamName(teamName),
      logo: safe(row.TeamLogo) || (window.DEFAULT_TEAM_LOGO || "./logo.png"),
      color: safe(row.TeamColor)
    };
  }

  function teamLinkHTML(teamName, teamNameToRow){
    const name = safe(teamName) || "TBD";
    if (name === "TBD") return `<span class="brTeamName muted">TBD</span>`;

    const meta = teamMeta(name, teamNameToRow);
    const style = meta.color ? `style="color:${meta.color};"` : "";
    return `<a class="brTeamName" ${style} href="./team.html?team=${encodeURIComponent(meta.slug)}">${meta.name}</a>`;
  }

  // ---------- Resolve playoff references ----------
  function winnerLoser(game){
    if (!isFinal(game.Status)) return null;
    const a = toNum(game.ScoreA);
    const b = toNum(game.ScoreB);
    if (a === null || b === null) return null;

    const A = safe(game.TeamAResolved);
    const B = safe(game.TeamBResolved);
    if (!A || !B) return null;

    if (a === b) return { T: true, A, B };
    return a > b ? { W: A, L: B } : { W: B, L: A };
  }

  function resolveRef(ref, seedsByNum, playoffsById, teamNameToRow){
    const raw = safe(ref);
    if (!raw) return null;

    if (teamNameToRow.has(norm(raw))) return raw;

    const up = raw.toUpperCase();

    if (/^S\d+$/.test(up)) {
      const n = Number(up.slice(1));
      return seedsByNum.get(n) || null;
    }

    if (/^[WL]\d+$/.test(up)) {
      const type = up[0];
      const gid = Number(up.slice(1));
      const g = playoffsById.get(gid);
      if (!g) return null;

      const wl = winnerLoser(g);
      if (!wl || wl.T) return null;

      return (type === "W") ? wl.W : wl.L;
    }

    return null;
  }

  // ---------- Box HTML ----------
  function scoreSpan(val){
    const n = toNum(val);
    if (n === null) return "";
    return `<span class="brTeamScore">${n}</span>`;
  }

  function logoHTML(teamName, teamNameToRow){
    if (!teamName || teamName === "TBD") return `<span class="brLogoBlank"></span>`;
    const meta = teamMeta(teamName, teamNameToRow);
    return `<img class="brLogo" src="${meta.logo}" alt="${meta.name} logo"
             onerror="this.onerror=null; this.src='${window.DEFAULT_TEAM_LOGO || "./logo.png"}';">`;
  }

  function byeBoxHTML(seedNum, teamName, teamNameToRow){
    const label = `S${seedNum}`;
    const name = teamName || "TBD";
    return `
      <div class="brGame brBye">
        <div class="brMeta">
          <div class="brMetaTop">${label} • Bye</div>
          <div class="brMetaBottom muted">First-round bye</div>
        </div>

        <div class="brTeams">
          <div class="brTeamRow">
            ${logoHTML(name === "TBD" ? "" : name, teamNameToRow)}
            <div class="brTeamMain">
              ${teamLinkHTML(name === "TBD" ? "TBD" : name, teamNameToRow)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function gameBoxHTML(game, teamNameToRow){
    const status = safe(game.Status) || "Scheduled";
    const final = isFinal(status);

    const A = safe(game.TeamAResolved) || "TBD";
    const B = safe(game.TeamBResolved) || "TBD";

    const sA = final ? scoreSpan(game.ScoreA) : "";
    const sB = final ? scoreSpan(game.ScoreB) : "";

    const date = safe(game.Date);
    const time = safe(game.Time);
    const field = safe(game.Field);
    const metaParts = [];
    if (date) metaParts.push(date);
    if (time) metaParts.push(time);
    if (field) metaParts.push(field);
    const meta = metaParts.join(" • ");

    return `
      <div class="brGame ${final ? "brFinal" : ""}">
        <div class="brMeta">
          <div class="brMetaTop">${final ? "Final" : status}</div>
          <div class="brMetaBottom">${meta}</div>
        </div>

        <div class="brTeams">
          <div class="brTeamRow">
            ${logoHTML(A === "TBD" ? "" : A, teamNameToRow)}
            <div class="brTeamMain">${teamLinkHTML(A, teamNameToRow)}</div>
            ${sA}
          </div>
          <div class="brTeamRow">
            ${logoHTML(B === "TBD" ? "" : B, teamNameToRow)}
            <div class="brTeamMain">${teamLinkHTML(B, teamNameToRow)}</div>
            ${sB}
          </div>
        </div>
      </div>
    `;
  }

  // ---------- TRUE ALIGNMENT GRID ----------
  function renderAlignedBracket(container, config){
    container.innerHTML = `
      <div class="brAlignGrid brCols${config.cols.length}">
        ${config.cols.map((c, idx) => `
          <div class="brAlignCol" data-col="${idx}">
            <div class="brAlignColTitle">${c.title}</div>
            <div class="brAlignSlots" style="grid-template-rows: repeat(${c.slots}, 1fr);">
              ${Array.from({length: c.slots}).map((_, r) =>
                `<div class="brSlot" data-col="${idx}" data-row="${r}"></div>`
              ).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function setSlot(container, colIndex, rowIndex, html){
    const slot = container.querySelector(`.brSlot[data-col="${colIndex}"][data-row="${rowIndex}"]`);
    if (slot) slot.innerHTML = html;
  }

  async function init(){
    msgEl.textContent = "";
    updatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;

    // Teams
    const teamsCsv = await fetchCsv(window.SHEET?.TEAMS_CSV_URL);
    const teamRows = parseCsv(teamsCsv);
    const teamNames = teamRows.map(r => safe(r.TeamName)).filter(Boolean);

    const teamNameToRow = new Map();
    for (const r of teamRows) {
      const name = safe(r.TeamName);
      if (name) teamNameToRow.set(norm(name), r);
    }

    // Regular season -> seeds
    const gamesCsv = await fetchCsv(window.SHEET?.GAMES_CSV_URL);
    const gameRows = parseCsv(gamesCsv);
    const { ordered, bySeed } = computeSeedsFromGames(teamNames, gameRows);

    // NEW gating: 6 completed league dates (instead of calendar date)
    const completeDates = completedLeagueDates(gameRows);
    const preWeek7 = completeDates.length < 6;

    if (preWeek7){
      seedNoteEl.textContent = "Bracket is shown in TBD mode until 6 league weeks are complete.";
      for (let s=1; s<=10; s++) bySeed.set(s, "TBD");
    } else {
      const preview = ordered.slice(0, 10).map((r, i) => `S${i+1}: ${r.team}`).join(" • ");
      seedNoteEl.textContent = preview ? `Current seeding: ${preview}` : "";
    }

    // Playoffs games
    const playoffsCsv = await fetchCsv(window.SHEET?.PLAYOFFS_CSV_URL);
    const playoffRows = parseCsv(playoffsCsv);

    const playoffsById = new Map();
    for (const r of playoffRows) {
      const id = toNum(r.GameID) ?? toNum(r.GameId) ?? toNum(r.Game);
      if (!Number.isFinite(id)) continue;

      r.GameID = String(id);
      r.TeamA = safe(r.TeamA);
      r.TeamB = safe(r.TeamB);
      r.ScoreA = safe(r.ScoreA);
      r.ScoreB = safe(r.ScoreB);
      r.Status = safe(r.Status);
      r.Date = safe(r.Date);
      r.Time = safe(r.Time);
      r.Field = safe(r.Field);

      playoffsById.set(id, r);
    }

    // Resolve TeamA/TeamB for playoff rows (multi-pass for W/L refs)
    const allIds = Array.from(playoffsById.keys()).sort((a,b)=>a-b);
    for (let pass = 0; pass < 4; pass++) {
      for (const id of allIds) {
        const g = playoffsById.get(id);
        g.TeamAResolved = resolveRef(g.TeamA, bySeed, playoffsById, teamNameToRow) || "";
        g.TeamBResolved = resolveRef(g.TeamB, bySeed, playoffsById, teamNameToRow) || "";
      }
    }

    // --------------------
    // Championship aligned config
    // --------------------
    champEl.className = "bracketAligned brChampAligned";
    renderAlignedBracket(champEl, {
      cols: [
        { title: "Round 1", slots: 4 },
        { title: "Semifinals", slots: 2 },
        { title: "Championship", slots: 1 },
      ]
    });

    setSlot(champEl, 0, 0, byeBoxHTML(1, bySeed.get(1) || null, teamNameToRow));
    setSlot(champEl, 0, 1, gameBoxHTML(playoffsById.get(147) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));

    setSlot(champEl, 0, 2, byeBoxHTML(2, bySeed.get(2) || null, teamNameToRow));
    setSlot(champEl, 0, 3, gameBoxHTML(playoffsById.get(146) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));

    // Semis
    setSlot(champEl, 1, 0, gameBoxHTML(playoffsById.get(148) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));
    setSlot(champEl, 1, 1, gameBoxHTML(playoffsById.get(149) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));

    // Final
    setSlot(champEl, 2, 0, gameBoxHTML(playoffsById.get(150) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));

    // --------------------
    // Consolation aligned config (NO Final column)
    // --------------------
    consEl.className = "bracketAligned brConsAligned";
    renderAlignedBracket(consEl, {
      cols: [
        { title: "Round 1", slots: 2 },
        { title: "Round 2", slots: 3 },
      ]
    });

    // Round 1
    setSlot(consEl, 0, 0, gameBoxHTML(playoffsById.get(151) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));
    setSlot(consEl, 0, 1, gameBoxHTML(playoffsById.get(152) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));

    // Round 2 (3 games)
    setSlot(consEl, 1, 0, gameBoxHTML(playoffsById.get(153) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));
    setSlot(consEl, 1, 1, gameBoxHTML(playoffsById.get(154) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));
    setSlot(consEl, 1, 2, gameBoxHTML(playoffsById.get(155) || {TeamAResolved:"TBD",TeamBResolved:"TBD"}, teamNameToRow));

    msgEl.textContent = "Brackets auto-fill from standings and playoff results (Status=Final + scores).";
  }

  init().catch(err => {
    console.error(err);
    msgEl.textContent = "Playoffs error: " + err.message;
  });

})();
