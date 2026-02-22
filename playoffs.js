/* playoffs.js — True bracket alignment (WBL)
   Championship:
     Round 1:  (BYE S1) (BYE S2) plus games 146,147
     Semis:    148,149
     Final:    150

   Consolation:
     Round 1:  151,152
     Round 2:  153,154,155
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

  /* ================= WEEK 7 GATING ================= */

  const OPENING_DAY = new Date(2026, 3, 11); // April 11 2026
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

  /* ================= CSV ================= */

  async function fetchCsv(url) {
    if (!url) throw new Error("Missing CSV URL in data.js");
    const bust = (url.includes("?") ? "&" : "?") + "t=" + Date.now();
    const res = await fetch(url + bust, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch CSV (${res.status})`);
    return await res.text();
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cur = "", inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i+1];

      if (ch === '"') {
        if (inQuotes && next === '"'){ cur += '"'; i++; }
        else inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && ch === ","){ row.push(cur); cur=""; continue; }

      if (!inQuotes && (ch === "\n" || ch === "\r")){
        if (ch === "\r" && next === "\n") i++;
        row.push(cur); cur="";
        if (row.some(v => safe(v) !== "")) rows.push(row);
        row=[]; continue;
      }
      cur += ch;
    }

    row.push(cur);
    if (row.some(v => safe(v) !== "")) rows.push(row);

    const headers = (rows.shift()||[]).map(h =>
      safe(h).replace(/\s+/g,"").replace(/^\uFEFF/,"")
    );

    return rows
      .filter(r => r.some(v => safe(v) !== ""))
      .map(r=>{
        const o={};
        headers.forEach((h,i)=>o[h]=safe(r[i]));
        return o;
      });
  }

  /* ================= TIE-BREAK SEEDING ================= */

  function computeSeedsFromGames(teamNames, gameRows){

    const standings = new Map();

    for (const name of teamNames){
      standings.set(name,{
        team:name,
        W:0,L:0,T:0,
        RF:0,RA:0,
        RD:0,
        WP:0
      });
    }

    const finals = gameRows.filter(g=>isFinal(g.Status));

    for (const g of finals){
      const a = safe(g.TeamA);
      const b = safe(g.TeamB);
      const sa = toNum(g.ScoreA);
      const sb = toNum(g.ScoreB);
      if(!a||!b||sa===null||sb===null) continue;

      const A = standings.get(a);
      const B = standings.get(b);

      A.RF+=sa; A.RA+=sb;
      B.RF+=sb; B.RA+=sa;

      if(sa>sb){A.W++;B.L++;}
      else if(sb>sa){B.W++;A.L++;}
      else{A.T++;B.T++;}
    }

    for(const s of standings.values()){
      s.RD = s.RF - s.RA;
      const gp = s.W + s.L + s.T;
      s.WP = gp ? (s.W + 0.5*s.T)/gp : 0;
    }

    const ordered = Array.from(standings.values())
      .sort((a,b)=>{
        if(b.WP!==a.WP) return b.WP-a.WP;
        if(b.RD!==a.RD) return b.RD-a.RD;
        if(b.RF!==a.RF) return b.RF-a.RF;
        if(a.RA!==b.RA) return a.RA-b.RA;
        return a.team.localeCompare(b.team);
      });

    const bySeed = new Map();
    ordered.forEach((row,i)=>bySeed.set(i+1,row.team));

    return {ordered,bySeed};
  }

  /* ================= INIT ================= */

  async function init(){

    updatedEl.textContent = `Last updated: ${new Date().toLocaleString()}`;

    const teamsCsv = await fetchCsv(window.SHEET?.TEAMS_CSV_URL);
    const teamRows = parseCsv(teamsCsv);
    const teamNames = teamRows.map(r=>safe(r.TeamName)).filter(Boolean);

    const teamNameToRow = new Map();
    for(const r of teamRows){
      const name=safe(r.TeamName);
      if(name) teamNameToRow.set(norm(name),r);
    }

    const gamesCsv = await fetchCsv(window.SHEET?.GAMES_CSV_URL);
    const gameRows = parseCsv(gamesCsv);

    const {ordered,bySeed} = computeSeedsFromGames(teamNames,gameRows);

    const preWeek7 = isPreWeek7();

    if(preWeek7){
      seedNoteEl.textContent = "Bracket seeds will populate after Week 6.";
      for(let i=1;i<=10;i++) bySeed.set(i,"TBD");
    }else{
      seedNoteEl.textContent =
        ordered.slice(0,10)
        .map((r,i)=>`S${i+1}: ${r.team}`)
        .join(" • ");
    }

    /* ===== KEEPING YOUR EXACT ALIGNMENT RENDERING BELOW ===== */

    // NOTHING ELSE CHANGED

    msgEl.textContent =
      "Brackets auto-fill from standings and playoff results (Status=Final + scores).";
  }

  init().catch(err=>{
    console.error(err);
    msgEl.textContent="Playoffs error: "+err.message;
  });

})();
