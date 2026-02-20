/* playoffs.js — WBL 3rd Grade 2026
   - Always renders bracket structure
   - Seeds computed from regular season Games marked Final
   - Team refs in Playoffs tab: S3, S6, W146, L147, etc.
   - Championship: 146-150
   - Consolation: 151-155
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

  // ---------- Standings -> Seeds (same tie logic you used elsewhere) ----------
  function buildStandings(teamNames){
    const map = new Map();
    for (const name of teamNames) {
      if (!name) continue;
      map.set(name, { team: name, W: 0, L: 0, T: 0, RF: 0, RA: 0, RD: 0 });
    }
    return map;
  }

  function sortStandings(a, b) {
    // W desc, L asc, RD desc, RF desc, team name asc
    if (b.W !== a.W) return b.W - a.W;
    if (a.L !== b.L) return a.L - b.L;
    if (b.RD !== a.RD) return b.RD - a.RD;
    if (b.RF !== a.RF) return b.RF - a.RF;
    return a.team.localeCompare(b.team);
  }

  function computeSeedsFromGames(teamNames, gameRows){
    const standings = buildStandings(teamNames);

    const finals = gameRows.filter(g => isFinal(g.Status));
    for (const g of finals) {
      const aName = safe(g.TeamA);
      const bName = safe(g.TeamB);
      const scoreA = toNum(g.ScoreA);
      const scoreB = toNum(g.ScoreB);
      if (!aName || !bName || scoreA === null || scoreB === null) continue;

      if (!standings.has(aName)) standings.set(aName, { team: aName, W:0, L:0, T:0, RF:0, RA:0, RD:0 });
      if (!standings.has(bName)) standings.set(bName, { team: bName, W:0, L:0, T:0, RF:0, RA:0, RD:0 });

      const A = standings.get(aName);
      const B = standings.get(bName);

      A.RF += scoreA; A.RA += scoreB;
      B.RF += scoreB; B.RA += scoreA;

      if (scoreA > scoreB) { A.W++; B.L++; }
      else if (scoreB > scoreA) { B.W++; A.L++; }
      else { A.T++; B.T++; }
    }

    for (const v of standings.values()) v.RD = v.RF - v.RA;

    const ordered = Array.from(standings.values()).sort(sortStandings);
    const bySeed = new Map();
    ordered.forEach((row, idx) => bySeed.set(idx + 1, row.team));
    return { ordered, bySeed };
  }

  // ---------- Team lookup (slug/logo/color) ----------
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

    // direct team name
    if (teamNameToRow.has(norm(raw))) return raw;

    const up = raw.toUpperCase();

    // S3
    if (/^S\d+$/.test(up)) {
      const n = Number(up.slice(1));
      return seedsByNum.get(n) || null;
    }

    // W146 / L147
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

  // ---------- Bracket rendering ----------
  function gameBoxHTML(game, teamNameToRow){
    const id = safe(game.GameID);
    const date = safe(game.Date);
    const time = safe(game.Time);
    const field = safe(game.Field);

    const metaBits = [];
    if (id) metaBits.push(`Game ${id}`);
    const dtBits = [];
    if (date) dtBits.push(date);
    if (time) dtBits.push(time);
    if (field) dtBits.push(field);

    const metaTop = metaBits.join(" • ");
    const metaBottom = dtBits.join(" • ");

    const A = safe(game.TeamAResolved) || "TBD";
    const B = safe(game.TeamBResolved) || "TBD";

    const final = isFinal(game.Status);
    const sA = toNum(game.ScoreA);
    const sB = toNum(game.ScoreB);
    const score = (final && sA !== null && sB !== null) ? `${sA}-${sB}` : (final ? "Final" : "");

    const Ameta = A !== "TBD" ? teamMeta(A, teamNameToRow) : null;
    const Bmeta = B !== "TBD" ? teamMeta(B, teamNameToRow) : null;

    return `
      <div class="brGame ${final ? "brFinal" : ""}">
        <div class="brMeta">
          <div class="brMetaTop">${metaTop || ""}</div>
          <div class="brMetaBottom">${metaBottom || ""}</div>
        </div>

        <div class="brTeams">
          <div class="brTeamRow">
            ${Ameta ? `<img class="brLogo" src="${Ameta.logo}" alt="${Ameta.name} logo" onerror="this.onerror=null; this.src='${window.DEFAULT_TEAM_LOGO || "./logo.png"}';">` : `<span class="brLogoBlank"></span>`}
            ${teamLinkHTML(A, teamNameToRow)}
          </div>

          <div class="brTeamRow">
            ${Bmeta ? `<img class="brLogo" src="${Bmeta.logo}" alt="${Bmeta.name} logo" onerror="this.onerror=null; this.src='${window.DEFAULT_TEAM_LOGO || "./logo.png"}';">` : `<span class="brLogoBlank"></span>`}
            ${teamLinkHTML(B, teamNameToRow)}
          </div>
        </div>

        <div class="brScore">${score}</div>
      </div>
    `;
  }

  function renderBracket(container, titleCols){
    // titleCols: [{title:"Round 1", ids:[146,147]}, ...]
    const html = titleCols.map(col => {
      return `
        <div class="brCol">
          <div class="brColTitle">${col.title}</div>
          <div class="brColBody" data-ids="${col.ids.join(",")}"></div>
        </div>
      `;
    }).join("");
    container.innerHTML = html;
  }

  function fillBracket(container, cols, playoffsById, teamNameToRow){
    for (const col of cols) {
      const body = container.querySelector(`.brColBody[data-ids="${col.ids.join(",")}"]`);
      if (!body) continue;
      body.innerHTML = col.ids.map(id => {
        const g = playoffsById.get(id);
        if (!g) {
          // still render empty placeholder if row missing
          return `
            <div class="brGame brMissing">
              <div class="brMeta">
                <div class="brMetaTop">Game ${id}</div>
                <div class="brMetaBottom muted">Missing row in Playoffs tab</div>
              </div>
              <div class="brTeams">
                <div class="brTeamRow"><span class="brLogoBlank"></span><span class="brTeamName muted">TBD</span></div>
                <div class="brTeamRow"><span class="brLogoBlank"></span><span class="brTeamName muted">TBD</span></div>
              </div>
              <div class="brScore"></div>
            </div>
          `;
        }
        return gameBoxHTML(g, teamNameToRow);
      }).join("");
    }
  }

  async function init(){
    msgEl.textContent = "";
    updatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;

    // --- Teams ---
    const teamsCsv = await fetchCsv(window.SHEET?.TEAMS_CSV_URL);
    const teamRows = parseCsv(teamsCsv);
    const teamNames = teamRows.map(r => safe(r.TeamName)).filter(Boolean);

    const teamNameToRow = new Map();
    for (const r of teamRows) {
      const name = safe(r.TeamName);
      if (name) teamNameToRow.set(norm(name), r);
    }

    // --- Regular season games -> seeds ---
    const gamesCsv = await fetchCsv(window.SHEET?.GAMES_CSV_URL);
    const gameRows = parseCsv(gamesCsv);

    const { ordered, bySeed } = computeSeedsFromGames(teamNames, gameRows);

    const preview = ordered.slice(0, 10).map((r, i) => `S${i+1}: ${r.team}`).join(" • ");
    seedNoteEl.textContent = preview ? `Current seeding: ${preview}` : "";

    // --- Playoff games ---
    const playoffsCsv = await fetchCsv(window.SHEET?.PLAYOFFS_CSV_URL);
    const playoffRows = parseCsv(playoffsCsv);

    const playoffsById = new Map();
    for (const r of playoffRows) {
      // tolerate GameID / GameId / Game
      const id = toNum(r.GameID) ?? toNum(r.GameId) ?? toNum(r.Game);
      if (!Number.isFinite(id)) continue;

      // normalize expected field names
      r.GameID = String(id);
      r.TeamA = safe(r.TeamA);
      r.TeamB = safe(r.TeamB);
      r.ScoreA = safe(r.ScoreA);
      r.ScoreB = safe(r.ScoreB);
      r.Status = safe(r.Status);

      playoffsById.set(id, r);
    }

    // Always render bracket columns even if no data
    const champCols = [
      { title: "Round 1",     ids: [146, 147] },
      { title: "Semifinals",  ids: [148, 149] },
      { title: "Championship",ids: [150] }
    ];

    const consCols = [
      { title: "Round 1", ids: [151, 152] },
      { title: "Round 2", ids: [153, 154, 155] }
    ];

    renderBracket(champEl, champCols);
    renderBracket(consEl, consCols);

    // Resolve TeamA/TeamB for playoff rows
    const allIds = Array.from(playoffsById.keys()).sort((a,b)=>a-b);

    for (let pass = 0; pass < 4; pass++) {
      for (const id of allIds) {
        const g = playoffsById.get(id);
        const aRes = resolveRef(g.TeamA, bySeed, playoffsById, teamNameToRow);
        const bRes = resolveRef(g.TeamB, bySeed, playoffsById, teamNameToRow);
        g.TeamAResolved = aRes || "";
        g.TeamBResolved = bRes || "";
      }
    }

    fillBracket(champEl, champCols, playoffsById, teamNameToRow);
    fillBracket(consEl, consCols, playoffsById, teamNameToRow);

    msgEl.textContent = "Brackets auto-fill from standings and playoff results (Status=Final + scores).";
  }

  init().catch(err => {
    console.error(err);
    msgEl.textContent = "Playoffs error: " + err.message;
  });

})();
