/* playoffs.js — WBL 3rd Grade 2026
   - Always renders bracket structure
   - Seeds computed from regular season Games marked Final
   - Team refs in Playoffs tab: S3, S6, W146, L147, etc.
   - Championship: 146-150 (with explicit BYEs for S1/S2)
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

  // ---------- Standings -> Seeds ----------
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

    // direct team name
    if (teamNameToRow.has(norm(raw))) return raw;

    const up = raw.toUpperCase();

    // Seed ref S3
    if (/^S\d+$/.test(up)) {
      const n = Number(up.slice(1));
      return seedsByNum.get(n) || null;
    }

    // Winner/Loser ref W146 / L147
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

  // ---------- Box render helpers ----------
  function scoreSpan(val){
    const n = toNum(val);
    if (n === null) return "";
    return `<span class="brTeamScore">${n}</span>`;
  }

  function byeBoxHTML(seedNum, teamName, teamNameToRow){
    const label = `S${seedNum}`;
    const name = teamName || "TBD";

    const logoHtml = teamName
      ? (() => {
          const meta = teamMeta(teamName, teamNameToRow);
          return `<img class="brLogo" src="${meta.logo}" alt="${meta.name} logo"
                    onerror="this.onerror=null; this.src='${window.DEFAULT_TEAM_LOGO || "./logo.png"}';">`;
        })()
      : `<span class="brLogoBlank"></span>`;

    return `
      <div class="brGame brBye">
        <div class="brMeta">
          <div class="brMetaTop">${label} • Bye</div>
          <div class="brMetaBottom muted">First-round bye</div>
        </div>

        <div class="brTeams">
          <div class="brTeamRow">
            ${logoHtml}
            <div class="brTeamMain">
              ${teamLinkHTML(name === "TBD" ? "TBD" : name, teamNameToRow)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function gameBoxHTML(game, teamNameToRow){
    const date = safe(game.Date);
    const time = safe(game.Time);
    const field = safe(game.Field);
    const status = safe(game.Status) || "Scheduled";

    const A = safe(game.TeamAResolved) || "TBD";
    const B = safe(game.TeamBResolved) || "TBD";

    const final = isFinal(status);
    const sA = final ? scoreSpan(game.ScoreA) : "";
    const sB = final ? scoreSpan(game.ScoreB) : "";

    const Ameta = (A !== "TBD") ? teamMeta(A, teamNameToRow) : null;
    const Bmeta = (B !== "TBD") ? teamMeta(B, teamNameToRow) : null;

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
            ${Ameta ? `<img class="brLogo" src="${Ameta.logo}" alt="${Ameta.name} logo"
                      onerror="this.onerror=null; this.src='${window.DEFAULT_TEAM_LOGO || "./logo.png"}';">` : `<span class="brLogoBlank"></span>`}
            <div class="brTeamMain">
              ${teamLinkHTML(A, teamNameToRow)}
            </div>
            ${sA}
          </div>

          <div class="brTeamRow">
            ${Bmeta ? `<img class="brLogo" src="${Bmeta.logo}" alt="${Bmeta.name} logo"
                      onerror="this.onerror=null; this.src='${window.DEFAULT_TEAM_LOGO || "./logo.png"}';">` : `<span class="brLogoBlank"></span>`}
            <div class="brTeamMain">
              ${teamLinkHTML(B, teamNameToRow)}
            </div>
            ${sB}
          </div>
        </div>
      </div>
    `;
  }

  // ---------- Bracket layout ----------
  function renderBracket(container, cols){
    const html = cols.map(col => {
      return `
        <div class="brCol ${col.colClass || ""}">
          <div class="brColTitle">${col.title}</div>
          <div class="brColBody" data-key="${col.key}"></div>
        </div>
      `;
    }).join("");
    container.innerHTML = html;
  }

  function fillBracket(container, cols, playoffsById, teamNameToRow, seedsByNum){
    for (const col of cols) {
      const body = container.querySelector(`.brColBody[data-key="${col.key}"]`);
      if (!body) continue;

      body.innerHTML = col.items.map(item => {
        // BYE items
        if (item.type === "bye") {
          const team = seedsByNum.get(item.seed) || null;
          return byeBoxHTML(item.seed, team, teamNameToRow);
        }

        // GAME items
        const id = item.id;
        const g = playoffsById.get(id);
        if (!g) {
          // placeholder if row missing
          return `
            <div class="brGame brMissing">
              <div class="brMeta">
                <div class="brMetaTop muted">Scheduled</div>
                <div class="brMetaBottom muted">Missing Playoffs row (GameID ${id})</div>
              </div>
              <div class="brTeams">
                <div class="brTeamRow"><span class="brLogoBlank"></span><span class="brTeamName muted">TBD</span></div>
                <div class="brTeamRow"><span class="brLogoBlank"></span><span class="brTeamName muted">TBD</span></div>
              </div>
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

    const preview = ordered.slice(0, 10).map((r, i) => `S${i+1}: ${r.team}`).join(" • ");
    seedNoteEl.textContent = preview ? `Current seeding: ${preview}` : "";

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

    // Championship columns (explicit BYEs for S1/S2)
    const champCols = [
      {
        title: "Round 1",
        key: "c_r1",
        colClass: "brRound1",
        items: [
          { type: "bye", seed: 1 },
          { type: "bye", seed: 2 },
          { type: "game", id: 146 },
          { type: "game", id: 147 },
        ]
      },
      {
        title: "Semifinals",
        key: "c_sf",
        colClass: "brSemis",
        items: [
          { type: "game", id: 148 },
          { type: "game", id: 149 },
        ]
      },
      {
        title: "Championship",
        key: "c_f",
        colClass: "brFinal",
        items: [
          { type: "game", id: 150 },
        ]
      }
    ];

    const consCols = [
      { title: "Round 1", key: "k_r1", colClass:"brRound1", items: [{type:"game", id:151},{type:"game", id:152}] },
      { title: "Round 2", key: "k_r2", colClass:"brSemis",  items: [{type:"game", id:153},{type:"game", id:154},{type:"game", id:155}] },
      { title: "Final",   key: "k_f",  colClass:"brFinal",  items: [] }
    ];

    // Render structure always
    champEl.classList.add("bracketGrid", "brChamp");
    consEl.classList.add("bracketGrid", "brCons");

    renderBracket(champEl, champCols);
    renderBracket(consEl, consCols);

    // Fill with data / placeholders
    fillBracket(champEl, champCols, playoffsById, teamNameToRow, bySeed);
    fillBracket(consEl, consCols, playoffsById, teamNameToRow, bySeed);

    msgEl.textContent = "Brackets auto-fill from standings and playoff results (Status=Final + scores).";
  }

  init().catch(err => {
    console.error(err);
    msgEl.textContent = "Playoffs error: " + err.message;
  });

})();
