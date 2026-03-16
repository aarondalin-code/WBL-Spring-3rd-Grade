/**
 * WBL 3rd Grade RSVP Reminder Automation (Google Apps Script)
 *
 * Expected schedule: every Thursday at 9:00 AM America/New_York.
 *
 * Data model in your workbook:
 * - Games: GameID | TeamA | TeamB | Date | Time | Field | Status
 * - RSVP: TeamSlug | PlayerID | GameID | Response | LastReminderSentAt
 * - Contacts: TeamSlug | PlayerID | PlayerName | ParentEmail | ParentName | CoachEmail | RSVP_Link
 */

const CONFIG = {
  timezone: 'America/New_York',
  senderName: 'WBL3rdGrade',
  senderEmail: 'westfieldbaseballrsvp@gmail.com',
  subjectPrefix: 'WBL 3rd Grade RSVP Reminder',

  // Safety guard: this function exits unless today is Thursday.
  onlySendOnThursday: false,

  sheetNames: {
    games: 'Games',
    rsvp: 'RSVPs',
    contacts: 'Contacts',
    reminderLog: 'ReminderLog'
  },

  headers: {
    games: {
      gameId: 'GameID',
      teamA: 'TeamA',
      teamB: 'TeamB',
      date: 'Date',
      time: 'Time',
      field: 'Field',
      status: 'Status'
    },
    rsvp: {
      teamSlug: 'TeamSlug',
      playerId: 'PlayerID',
      gameId: 'GameID',
      response: 'Response',
      lastReminderSentAt: 'LastReminderSentAt'
    },
    contacts: {
      teamSlug: 'TeamSlug',
      playerId: 'PlayerID',
      playerName: 'PlayerName',
      parentEmail: 'ParentEmail',
      parentName: 'ParentName',
      coachEmail: 'CoachEmail',
      rsvpLink: 'RSVP_Link'
    }
  },

  pendingResponses: ['', 'pending', 'no', 'no response', 'unknown'],
  scheduledGameStatuses: ['scheduled'],

  reminderLogHeaders: [
    'Timestamp',
    'TeamSlug',
    'PlayerID',
    'PlayerName',
    'ParentEmail',
    'CoachEmail',
    'GameID',
    'GameDate',
    'Result',
    'Details'
  ]
};

/**
 * Main entry point for a time-driven trigger.
 */
function sendRsvpReminders() {
  if (CONFIG.onlySendOnThursday && !isThursdayNow_()) {
    Logger.log('Skipping reminder run because today is not Thursday.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();

  const games = getRows_(ss, CONFIG.sheetNames.games);
  const contacts = getRows_(ss, CONFIG.sheetNames.contacts);

  const rsvpSheet = ss.getSheetByName(CONFIG.sheetNames.rsvp);
  if (!rsvpSheet) throw new Error(`Missing sheet: ${CONFIG.sheetNames.rsvp}`);
  const rsvpBundle = getRowsWithRowNumbers_(rsvpSheet);

  ensureReminderLogSheet_(ss);

  const nextSaturday = getUpcomingSaturday_(now);
  const gamesByTeam = getScheduledGamesForDateByTeam_(games, nextSaturday);
  const latestRsvpByPlayerGame = buildLatestRsvpIndex_(rsvpBundle.rows);
  const sentReminderKeys = getSentReminderKeys_(ss);

  let sentCount = 0;
  let skippedCount = 0;

  contacts.forEach(contact => {
    const teamSlug = value_(contact, CONFIG.headers.contacts.teamSlug);
    const playerId = value_(contact, CONFIG.headers.contacts.playerId);
    const playerName = value_(contact, CONFIG.headers.contacts.playerName) || 'Player';
    const parentEmail = value_(contact, CONFIG.headers.contacts.parentEmail);
    const parentName = value_(contact, CONFIG.headers.contacts.parentName) || 'Parent';
    const coachEmail = value_(contact, CONFIG.headers.contacts.coachEmail);
    const rsvpLink = value_(contact, CONFIG.headers.contacts.rsvpLink);

    if (!teamSlug || !playerId || !parentEmail) {
      skippedCount += 1;
      return;
    }

    const game = gamesByTeam.get(teamSlug);
    if (!game) {
      skippedCount += 1;
      return;
    }

    const gameId = value_(game, CONFIG.headers.games.gameId);
    const rsvpKey = makeKey_(teamSlug, playerId, gameId);
    const latestRsvp = latestRsvpByPlayerGame.get(rsvpKey);
    const response = normalizeResponse_(latestRsvp ? value_(latestRsvp.data, CONFIG.headers.rsvp.response) : '');

    // Skip if already responded yes or no
    if (response === 'yes' || response === 'no') {
      skippedCount += 1;
      return;
    }

    // Skip if reminder already sent for this player/game
    if (sentReminderKeys.has(rsvpKey)) {
      skippedCount += 1;
      appendReminderLog_(ss, [
        formatDateTime_(now),
        teamSlug,
        playerId,
        playerName,
        parentEmail,
        coachEmail,
        gameId,
        formatDateLabel_(value_(game, CONFIG.headers.games.date)),
        'SKIPPED_DUPLICATE',
        'Reminder already logged for this player/game'
      ]);
      return;
    }

    const mail = buildReminderEmail_({
      parentName,
      playerName,
      teamName: getTeamDisplayNameForSlug_(game, teamSlug),
      opponent: getOpponentForTeam_(game, teamSlug),
      gameDate: value_(game, CONFIG.headers.games.date),
      gameTime: value_(game, CONFIG.headers.games.time),
      gameField: value_(game, CONFIG.headers.games.field),
      coachEmail,
      rsvpLink
    });

    sendEmail_(parentEmail, coachEmail, mail.subject, mail.textBody, mail.htmlBody);

    appendReminderLog_(ss, [
      formatDateTime_(now),
      teamSlug,
      playerId,
      playerName,
      parentEmail,
      coachEmail,
      gameId,
      formatDateLabel_(value_(game, CONFIG.headers.games.date)),
      'SENT',
      'Reminder delivered for missing RSVP'
    ]);

    sentCount += 1;
  });

  Logger.log(`RSVP reminders completed. Sent=${sentCount} Skipped=${skippedCount}`);
}

function sendEmail_(toEmail, coachEmail, subject, textBody, htmlBody) {
  const options = {
    name: CONFIG.senderName,
    htmlBody: htmlBody,
    replyTo: coachEmail || undefined
  };

  // Use Gmail alias if configured on the sending account; fallback to default sender.
  const aliases = GmailApp.getAliases();
  if (aliases.includes(CONFIG.senderEmail)) {
    options.from = CONFIG.senderEmail;
  }

  GmailApp.sendEmail(toEmail, subject, textBody, options);
}

function getScheduledGamesForDateByTeam_(gamesRows, targetDate) {
  const out = new Map();
  const targetKey = normalizeDateKey_(targetDate);

  gamesRows.forEach(row => {
    const status = value_(row, CONFIG.headers.games.status).toLowerCase();
    const gameDate = value_(row, CONFIG.headers.games.date);

    if (!gameDate || normalizeDateKey_(gameDate) !== targetKey) return;
    if (!CONFIG.scheduledGameStatuses.includes(status)) return;

    const teamASlug = value_(row, 'TeamASlug');
    const teamBSlug = value_(row, 'TeamBSlug');

    if (teamASlug) out.set(teamASlug, row);
    if (teamBSlug) out.set(teamBSlug, row);
  });

  return out;
}

function getOpponentForTeam_(gameRow, teamSlug) {
  const teamAName = value_(gameRow, CONFIG.headers.games.teamA);
  const teamBName = value_(gameRow, CONFIG.headers.games.teamB);
  const teamASlug = value_(gameRow, 'TeamASlug');
  const teamBSlug = value_(gameRow, 'TeamBSlug');

  if (teamASlug === teamSlug) return teamBName || '';
  if (teamBSlug === teamSlug) return teamAName || '';

  return '';
}

function buildRsvpRowIndex_(rsvpRows, headerIndex) {
  const out = new Map();

  rsvpRows.forEach(row => {
    const teamSlug = row.data['TeamSlug'];
    const playerId = row.data['PlayerID'];
    const gameId = row.data['GameID'];

    if (!teamSlug || !playerId || !gameId) return;

    out.set(makeKey_(teamSlug, playerId, gameId), row);
  });

  return out;
}

function normalizeStatus_(status) {
  const v = String(status || '').trim().toLowerCase();

  if (['scheduled', 'schedule'].includes(v)) return 'scheduled';
  if (['cancelled', 'canceled', 'rainout', 'postponed'].includes(v)) return 'not_scheduled';

  return v;
}

function getTeamDisplayNameForSlug_(gameRow, teamSlug) {
  const teamAName = value_(gameRow, CONFIG.headers.games.teamA);
  const teamBName = value_(gameRow, CONFIG.headers.games.teamB);
  const teamASlug = value_(gameRow, 'TeamASlug');
  const teamBSlug = value_(gameRow, 'TeamBSlug');

  if (teamASlug === teamSlug) return teamAName || teamSlug;
  if (teamBSlug === teamSlug) return teamBName || teamSlug;

  return teamSlug;
}


function buildReminderEmail_(ctx) {
  const dateLabel = formatDateLabel_(ctx.gameDate);
  const timeLabel = ctx.gameTime
  ? ` at ${Utilities.formatDate(new Date(ctx.gameTime), CONFIG.timezone, 'h:mm a')}`
  : '';

  const fieldLabel = ctx.gameField ? `\nField: ${ctx.gameField}` : '';
  const rsvpLineText = ctx.rsvpLink ? `RSVP now: ${ctx.rsvpLink}` : 'Please RSVP from the team page.';
  const rsvpLineHtml = ctx.rsvpLink
    ? `<a href="${escapeHtml_(ctx.rsvpLink)}" target="_blank" rel="noopener noreferrer">Click here to RSVP</a>`
    : 'Please RSVP from the team page.';

  const replyLine = ctx.coachEmail
    ? `If you reply to this email, your response will go to your coach (${ctx.coachEmail}).`
    : 'If you have questions, please contact your coach.';

  const subject = `${CONFIG.subjectPrefix}: ${ctx.playerName} vs ${ctx.opponent}`;

  const textBody = `Hi ${ctx.parentName},

This is a friendly reminder to RSVP for ${ctx.playerName}'s next WBL 3rd Grade game.

Team: ${ctx.teamName}
Opponent: ${ctx.opponent}
Game: ${dateLabel}${timeLabel}${fieldLabel}

${rsvpLineText}

${replyLine}

Thanks,
WBL 3rd Grade`;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.45;">
      <p>Hi ${escapeHtml_(ctx.parentName)},</p>
      <p>This is a friendly reminder to RSVP for <strong>${escapeHtml_(ctx.playerName)}</strong>'s next WBL 3rd Grade game.</p>
      <p>
        <strong>Team:</strong> ${escapeHtml_(ctx.teamName)}<br />
        <strong>Opponent:</strong> ${escapeHtml_(ctx.opponent)}<br />
        <strong>Game:</strong> ${escapeHtml_(dateLabel)}${escapeHtml_(timeLabel)}
        ${ctx.gameField ? `<br /><strong>Field:</strong> ${escapeHtml_(ctx.gameField)}` : ''}
      </p>
      <p>${rsvpLineHtml}</p>
      <p>${escapeHtml_(replyLine)}</p>
      <p>Thanks,<br />WBL 3rd Grade</p>
    </div>
  `;

  return { subject, textBody, htmlBody };
}

function buildLatestRsvpIndex_(rsvpRows) {
  const out = new Map();

  rsvpRows.forEach(row => {
    const teamSlug = value_(row.data, CONFIG.headers.rsvp.teamSlug);
    const playerId = value_(row.data, CONFIG.headers.rsvp.playerId);
    const gameId = value_(row.data, CONFIG.headers.rsvp.gameId);

    if (!teamSlug || !playerId || !gameId) return;

    const key = makeKey_(teamSlug, playerId, gameId);

    // Keep the latest row by sheet row number
    const existing = out.get(key);
    if (!existing || row.rowNumber > existing.rowNumber) {
      out.set(key, row);
    }
  });

  return out;
}

function normalizeResponse_(response) {
  const v = String(response || '').trim().toLowerCase();

  if (['yes', 'y'].includes(v)) return 'yes';
  if (['no', 'n'].includes(v)) return 'no';

  return '';
}

function getSentReminderKeys_(ss) {
  const logSheet = ss.getSheetByName(CONFIG.sheetNames.reminderLog);
  const out = new Set();

  if (!logSheet || logSheet.getLastRow() < 2) return out;

  const values = logSheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());

  const idx = {};
  headers.forEach((h, i) => {
    idx[h] = i;
  });

  values.slice(1).forEach(row => {
    const result = String(row[idx['Result']] || '').trim();
    if (result !== 'SENT') return;

    const teamSlug = String(row[idx['TeamSlug']] || '').trim();
    const playerId = String(row[idx['PlayerID']] || '').trim();
    const gameId = String(row[idx['GameID']] || '').trim();

    if (!teamSlug || !playerId || !gameId) return;

    out.add(makeKey_(teamSlug, playerId, gameId));
  });

  return out;
}

function ensureReminderLogSheet_(ss) {
  let logSheet = ss.getSheetByName(CONFIG.sheetNames.reminderLog);
  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.sheetNames.reminderLog);
  }

  const hasHeaders = logSheet.getLastRow() > 0;
  if (!hasHeaders) {
    logSheet.getRange(1, 1, 1, CONFIG.reminderLogHeaders.length).setValues([CONFIG.reminderLogHeaders]);
  }
}

function appendReminderLog_(ss, rowValues) {
  const logSheet = ss.getSheetByName(CONFIG.sheetNames.reminderLog);
  if (!logSheet) return;
  logSheet.appendRow(rowValues);
}

function getRows_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Missing sheet: ${sheetName}`);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

function getRowsWithRowNumbers_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { headers: [], headerIndex: {}, rows: [] };
  }

  const headers = values[0].map(h => String(h).trim());
  const headerIndex = {};
  headers.forEach((h, i) => {
    headerIndex[h] = i;
  });

  const rows = values.slice(1).map((rawRow, i) => {
    const data = {};
    headers.forEach((header, col) => {
      data[header] = rawRow[col];
    });

    return {
      rowNumber: i + 2,
      data
    };
  });

  return { headers, headerIndex, rows };
}

function isPendingResponse_(response) {
  return CONFIG.pendingResponses.includes(String(response || '').trim().toLowerCase());
}

function value_(obj, header) {
  return String(obj[header] || '').trim();
}

function makeKey_(teamSlug, playerId, gameId) {
  return [teamSlug, playerId, gameId].join('||');
}

function getUpcomingSaturday_(fromDate) {
  const d = new Date(fromDate);
  const day = Number(Utilities.formatDate(d, CONFIG.timezone, 'u')); // 1=Mon ... 7=Sun
  const daysUntilSaturday = (6 - day + 7) % 7;
  d.setDate(d.getDate() + daysUntilSaturday);
  return d;
}

function isThursdayNow_() {
  const weekday = Utilities.formatDate(new Date(), CONFIG.timezone, 'EEEE');
  return weekday === 'Thursday';
}

function normalizeDateKey_(input) {
  const d = input instanceof Date ? input : new Date(input);
  return Utilities.formatDate(d, CONFIG.timezone, 'yyyy-MM-dd');
}

function formatDateLabel_(input) {
  const d = input instanceof Date ? input : new Date(input);
  return Utilities.formatDate(d, CONFIG.timezone, 'EEEE, MMMM d');
}

function formatDateTime_(input) {
  const d = input instanceof Date ? input : new Date(input);
  return Utilities.formatDate(d, CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');
}

function escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
