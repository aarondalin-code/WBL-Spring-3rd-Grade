// WBL 3rd Grade 2026 — Google Sheets CSV feeds
window.SHEET = {
  TEAMS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=0&single=true&output=csv",
  GAMES_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=1880527815&single=true&output=csv",
  ROSTER_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=966740078&single=true&output=csv",
  GALLERY_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=1945229510&single=true&output=csv",
  PLAYOFFS_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=126919836&single=true&output=csv",
  PLAYERS_OF_WEEK_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=557591852&single=true&output=csv",

  // Poll config tab (published CSV)
  // Poll tab required headers:
  // WeekKey | Active | Question | Option1 | Option2 | Option3 ...
  POLL_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=1716021344&single=true&output=csv",

  // Real-time voting API (Apps Script Web App) — optional
  POLL_API_URL: "https://script.google.com/macros/s/AKfycbwWK18dcqAKaMNgVdFi6kgPYjXpXKEgSVDLwaTUhkFjAM4KWpE9OSeC4Jlpe8rVrKUl/exec",

  // Key League Dates & News tab (published CSV) — YOU MUST ADD THIS URL
  // Required headers:
  // Date | Title | Details | Link (optional) | Priority (optional)
  KEY_DATES_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2NIyT2nQ0ymcFxNTG9qv-YsoQMSs01UPMYdYGVqcprvj5r5y6eA-Fcot73iVVjzM1QU6mUuvk82Kf/pub?gid=869225004&single=true&output=csv"
};

// Default logo used across the site (header + fallback when team logos are missing)
window.DEFAULT_TEAM_LOGO = "./logo.png";

// Default player photo (used when a roster PhotoURL is blank/broken)
window.DEFAULT_PLAYER_PHOTO = "./player-placeholder.png";

// Optional assets/links
window.PARK_MAP_IMG = "./park-map.jpg";
window.UPLOADS_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeJFsS_cdkuAXXtcJsszJ3OP3Xgv01gSacziNK-Bxfl0nHVQQ/viewform?usp=publish-editor";
