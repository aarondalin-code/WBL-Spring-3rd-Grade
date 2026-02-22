/* playoffs.js — True bracket alignment (WBL)
   SAME STRUCTURE AS BEFORE
   + Week 7 TBD gating
   + Tie-break seeding logic
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

  /* =========================================================
     WEEK 7 GATING (TBD UNTIL AFTER WEEK 6)
  ========================================================== */

  const OPENING_DAY = new Date(2026, 3, 11); // April 11, 2026
  OPENING_DAY.setHours(0,0,0,0);

  function week7StartDate(){
    const d = new Date(OPENING_DAY);
    d.setDate(d.getDate() + 6 * 7);
    d.setHours(0,0,0,0);
    return d;
  }

  function isPreWeek7(){
    const now = new Date();
    now.setHours(0,0,0,0);
    return now.getTime() < week7StartDate().getTime();
  }

  /* =========================================================
     FETCH / CSV
  ========================================================== */

  async function fetchCsv(url) {
    if (!url) throw new Error("Missing CSV URL in data.js");
    const bust = (url.includes("?") ? "&" : "?") + "t=" + Date.now();
    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
    return await res.text();
  }

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

    const headers = (rows.shift() || []).map(h =>
      safe(h).replace(/\s+/g,"").replace(/^\uFEFF/,"")
    );

    return rows
      .filter(r => r.some(x => safe(x) !== ""))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => obj[h] = safe(r[idx]));
        return obj;
      });
  }

  /* =========================================================
     TIE-BREAK SEEDING LOGIC
  ========================================================== */

  const RD_CAP = 5;

  function capped(diff){
    return Math.max(-RD_CAP, Math.min(RD_CAP, diff));
  }

  function computeSeedsFromGames(teamNames, gameRows){

    const standings = new Map();

    for (const name of teamNames) {
      standings.set(name, {
        team: name,
        W:0, L:0, T:0,
        RF:0, RA:0,
        RD:0,
        WP:0
      });
    }

    const finals = gameRows.filter(g => isFinal(g.Status));

    for (const g of finals) {
      const a = safe(g.TeamA);
      const b = safe(g.TeamB);
      const sa = toNum(g.ScoreA);
      const sb = toNum(g.ScoreB);
      if (!a || !b || sa===null || sb===null) continue;

      if (!standings.has(a)) standings.set(a,{team:a,W:0,L:0,T:0,RF:0,RA:0,RD:0,WP:0});
      if (!standings.has(b)) standings.set(b,{team:b,W:0,L:0,T:0,RF:0,RA:0,RD:0,WP:0});

      const A = standings.get(a);
      const B = standings.get(b);

      A.RF += sa; A.RA += sb;
      B.RF += sb; B.RA += sa;

      if (sa > sb){ A.W++; B.L++; }
      else if (sb > sa){ B.W++; A.L++; }
      else { A.T++; B.T++; }
    }

    for (const v of standings.values()){
      v.RD = v.RF - v.RA;
      const gp = v.W + v.L + v.T;
      v.WP = gp ? (v.W + 0.5*v.T)/gp : 0;
    }

    const ordered = Array.from(standings.values())
      .sort((a,b)=>{
        if (b.WP !== a.WP) return b.WP - a.WP;
        if (b.RD !== a.RD) return b.RD - a.RD;
        if (b.RF !== a.RF) return b.RF - a.RF;
        return a.team.localeCompare(b.team);
      });

    const bySeed = new Map();
    ordered.forEach((row, idx) => bySeed.set(idx+1, row.team));

    return { ordered, bySeed };
  }

  /* =========================================================
     ORIGINAL BRACKET LOGIC (UNCHANGED)
  ========================================================== */

  // EVERYTHING BELOW HERE remains structurally identical
  // except we insert the Week 7 gating at slot rendering time

  function teamLinkHTML(teamName, teamNameToRow){
    const name = safe(teamName) || "TBD";
    if (name === "TBD") return `<span class="brTeamName muted">TBD</span>`;
    const row = teamNameToRow.get(norm(name));
    const slug = row?.TeamSlug || name.toLowerCase().replace(/\s+/g,"-");
    const color = row?.TeamColor || "";
    const style = color ? `style="color:${color};"` : "";
    return `<a class="brTeamName" ${style} href="./team.html?team=${encodeURIComponent(slug)}">${name}</a>`;
  }

  function logoHTML(teamName, teamNameToRow){
    if (!teamName || teamName === "TBD") return `<span class="brLogoBlank"></span>`;
    const row = teamNameToRow.get(norm(teamName));
    const logo = row?.TeamLogo || (window.DEFAULT_TEAM_LOGO || "./logo.png");
    return `<img class="brLogo" src="${logo}" alt="${teamName} logo"
             onerror="this.onerror=null; this.src='${window.DEFAULT_TEAM_LOGO || "./logo.png"}';">`;
  }

  function byeBoxHTML(seedNum, teamName, teamNameToRow){
    const name = teamName || "TBD";
    return `
      <div class="brGame brBye">
        <div class="brMeta">
          <div class="brMetaTop">S${seedNum} • Bye</div>
          <div class="brMetaBottom muted">First-round bye</div>
        </div>
        <div class="brTeams">
          <div class="brTeamRow">
            ${logoHTML(name, teamNameToRow)}
            <div class="brTeamMain">${teamLinkHTML(name, teamNameToRow)}</div>
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

    const sA = final && toNum(game.ScoreA)!==null ? `<span class="brTeamScore">${game.ScoreA}</span>` : "";
    const sB = final && toNum(game.ScoreB)!==null ? `<span class="brTeamScore">${game.ScoreB}</span>` : "";

    return `
      <div class="brGame ${final ? "brFinal" : ""}">
        <div class="brMeta">
          <div class="brMetaTop">${final ? "Final" : status}</div>
        </div>
        <div class="brTeams">
          <div class="brTeamRow">
            ${logoHTML(A, teamNameToRow)}
            <div class="brTeamMain">${teamLinkHTML(A, teamNameToRow)}</div>
            ${sA}
          </div>
          <div class="brTeamRow">
            ${logoHTML(B, teamNameToRow)}
            <div class="brTeamMain">${teamLinkHTML(B, teamNameToRow)}</div>
            ${sB}
          </div>
        </div>
      </div>
    `;
  }

  /* =========================================================
     INIT (GATED SEED DISPLAY)
  ========================================================== */

  async function init(){
    updatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;

    const teamsCsv = await fetchCsv(window.SHEET?.TEAMS_CSV_URL);
    const teamRows = parseCsv(teamsCsv);
    const teamNames = teamRows.map(r => safe(r.TeamName)).filter(Boolean);

    const teamNameToRow = new Map();
    for (const r of teamRows) {
      const name = safe(r.TeamName);
      if (name) teamNameToRow.set(norm(name), r);
    }

    const gamesCsv = await fetchCsv(window.SHEET?.GAMES_CSV_URL);
    const gameRows = parseCsv(gamesCsv);

    const { ordered, bySeed } = computeSeedsFromGames(teamNames, gameRows);

    const preWeek7 = isPreWeek7();

    seedNoteEl.textContent = preWeek7
      ? "Bracket seeds will populate after Week 6."
      : ordered.slice(0,10).map((r,i)=>`S${i+1}: ${r.team}`).join(" • ");

    // If preWeek7, override seeds with TBD
    if (preWeek7) {
      for (let i=1;i<=10;i++) bySeed.set(i,"TBD");
    }

    // PLAYOFFS CSV
    const playoffsCsv = await fetchCsv(window.SHEET?.PLAYOFFS_CSV_URL);
    const playoffRows = parseCsv(playoffsCsv);

    const playoffsById = new Map();
    for (const r of playoffRows) {
      const id = toNum(r.GameID) ?? toNum(r.GameId) ?? toNum(r.Game);
      if (!Number.isFinite(id)) continue;
      playoffsById.set(id, r);
    }

    // Render bracket EXACTLY like before
    champEl.innerHTML =
      byeBoxHTML(1, bySeed.get(1), teamNameToRow) +
      gameBoxHTML(playoffsById.get(147) || {}, teamNameToRow) +
      byeBoxHTML(2, bySeed.get(2), teamNameToRow) +
      gameBoxHTML(playoffsById.get(146) || {}, teamNameToRow) +
      gameBoxHTML(playoffsById.get(148) || {}, teamNameToRow) +
      gameBoxHTML(playoffsById.get(149) || {}, teamNameToRow) +
      gameBoxHTML(playoffsById.get(150) || {}, teamNameToRow);

    consEl.innerHTML =
      gameBoxHTML(playoffsById.get(151) || {}, teamNameToRow) +
      gameBoxHTML(playoffsById.get(152) || {}, teamNameToRow) +
      gameBoxHTML(playoffsById.get(153) || {}, teamNameToRow) +
      gameBoxHTML(playoffsById.get(154) || {}, teamNameToRow) +
      gameBoxHTML(playoffsById.get(155) || {}, teamNameToRow);

    msgEl.textContent = "Brackets auto-fill from standings and playoff results (Status=Final + scores).";
  }

  init().catch(err=>{
    console.error(err);
    msgEl.textContent = "Playoffs error: " + err.message;
  });

})();
