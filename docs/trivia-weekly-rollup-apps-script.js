/**
 * Rebuild TriviaWeekly sheet from TriviaResponses for the CURRENT week.
 *
 * Week window: Sunday 12:00 AM -> Saturday 11:59:59 PM (America/New_York)
 */

const TRIVIA_WEEKLY_CONFIG = {
  timezone: 'America/New_York',
  sheetNames: {
    responses: 'TriviaResponses',
    weekly: 'TriviaWeekly'
  },
  headers: {
    playerName: 'PlayerName',
    teamName: 'TeamName',
    submittedAt: 'SubmittedAt',
    isCorrect: 'IsCorrect',
    correct: 'Correct'
  },
  weeklyOutputHeaders: [
    'Rank',
    'PlayerName',
    'Team',
    'Correct',
    'Attempted',
    'Accuracy',
    'WeekStart',
    'WeekEnd',
    'UpdatedAt'
  ]
};

function rebuildTriviaWeeklyFromResponses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const responsesSheet = ss.getSheetByName(TRIVIA_WEEKLY_CONFIG.sheetNames.responses);
  if (!responsesSheet) {
    throw new Error(`Missing sheet: ${TRIVIA_WEEKLY_CONFIG.sheetNames.responses}`);
  }

  const weeklySheet = ensureSheet_(ss, TRIVIA_WEEKLY_CONFIG.sheetNames.weekly);
  const responses = readRows_(responsesSheet);
  const week = getCurrentWeekSundaySaturday_(new Date(), TRIVIA_WEEKLY_CONFIG.timezone);

  const weekRows = responses.filter(r => {
    const submitted = parseDate_(r[TRIVIA_WEEKLY_CONFIG.headers.submittedAt]);
    if (!submitted) return false;
    return submitted >= week.start && submitted <= week.end;
  });

  const grouped = new Map();

  weekRows.forEach(r => {
    const playerName = String(r[TRIVIA_WEEKLY_CONFIG.headers.playerName] || '').trim();
    const teamName = String(r[TRIVIA_WEEKLY_CONFIG.headers.teamName] || '').trim();
    if (!playerName) return;

    const key = normalizeKey_(playerName);
    if (!grouped.has(key)) {
      grouped.set(key, {
        PlayerName: playerName,
        Team: teamName,
        Correct: 0,
        Attempted: 0
      });
    }

    const row = grouped.get(key);
    if (teamName) row.Team = teamName;

    row.Attempted += 1;
    if (isCorrectRow_(r)) {
      row.Correct += 1;
    }
  });

  const results = Array.from(grouped.values()).map(r => {
    const acc = r.Attempted > 0 ? (r.Correct / r.Attempted) * 100 : 0;
    return {
      ...r,
      Accuracy: `${Math.round(acc)}%`
    };
  }).sort((a, b) => {
    const accA = Number(a.Accuracy.replace('%', ''));
    const accB = Number(b.Accuracy.replace('%', ''));
    if (accB !== accA) return accB - accA;
    if (b.Correct !== a.Correct) return b.Correct - a.Correct;
    if (a.Attempted !== b.Attempted) return a.Attempted - b.Attempted;
    return a.PlayerName.localeCompare(b.PlayerName);
  });

  const weekStartLabel = formatDate_(week.start, 'yyyy-MM-dd');
  const weekEndLabel = formatDate_(week.end, 'yyyy-MM-dd');
  const updatedAt = formatDate_(new Date(), 'yyyy-MM-dd HH:mm:ss');

  const output = [TRIVIA_WEEKLY_CONFIG.weeklyOutputHeaders];
  results.forEach((r, i) => {
    output.push([
      i + 1,
      r.PlayerName,
      r.Team,
      r.Correct,
      r.Attempted,
      r.Accuracy,
      weekStartLabel,
      weekEndLabel,
      updatedAt
    ]);
  });

  weeklySheet.clearContents();
  weeklySheet.getRange(1, 1, output.length, output[0].length).setValues(output);
}

function isCorrectRow_(r) {
  const rawIsCorrect = String(r[TRIVIA_WEEKLY_CONFIG.headers.isCorrect] || '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(rawIsCorrect)) return true;

  const rawCorrect = String(r[TRIVIA_WEEKLY_CONFIG.headers.correct] || '').trim().toLowerCase();
  return ['true', 'yes', 'y', '1'].includes(rawCorrect);
}

function getCurrentWeekSundaySaturday_(date, timezone) {
  const local = toTzDate_(date, timezone);
  const start = new Date(local);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function toTzDate_(d, timezone) {
  const stamp = Utilities.formatDate(d, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  return new Date(stamp);
}

function parseDate_(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate_(date, pattern) {
  return Utilities.formatDate(date, TRIVIA_WEEKLY_CONFIG.timezone, pattern);
}

function normalizeKey_(value) {
  return String(value || '').trim().toLowerCase();
}

function ensureSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function readRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).map(row => {
    const out = {};
    headers.forEach((h, i) => {
      out[h] = row[i];
    });
    return out;
  });
}
