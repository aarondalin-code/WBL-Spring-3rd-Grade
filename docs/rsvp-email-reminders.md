# RSVP Email Reminders (Thursday 9:00 AM ET)

Yes — this is absolutely possible, and this version matches your real sheet structure with TeamSlug as the internal identifier.

## What this implementation now does


## TeamSlug-first update (controlled + low risk)

Yes — with the columns you added, one code update is needed in the reminder script:

- `TeamSlug` is the canonical identifier across the project.
- On the `Games` tab, each row has two teams, so it must carry two TeamSlug references:
  `TeamASlug` + `TeamBSlug` (or `TeamSlugA` + `TeamSlugB`).
- Match games to families by those two per-game TeamSlug references (not by display team names).
- Keep `TeamA` / `TeamB` only for human-readable opponent text in the email.
- UI display should continue to prefer TeamName, with a readable capitalized TeamSlug fallback when TeamName is missing.

This is a safe change because it only affects `docs/rsvp-reminder-apps-script.js` (Apps Script automation) and does **not** change live website rendering code.

---

- Runs from your Gmail automation account: **westfieldbaseballrsvp@gmail.com**.
- Sends reminders only on **Thursday** (guard in code), intended trigger time **9:00 AM ET**.
- Finds each team's upcoming **Saturday** game from the `Games` tab.
- Checks `RSVP` rows for `Response` values that are still pending.
- Includes each family's unique **`RSVP_Link`** in the email.
- Routes parent replies to the team coach using `replyTo: CoachEmail`.
- Prevents duplicate reminders by using **`LastReminderSentAt` on the RSVP tab**.
- Appends all send/skip outcomes into a `ReminderLog` sheet.

---

## Tab/column mapping used by the script

### `Games` tab
- `GameID`
- `TeamA`
- `TeamASlug`
- `TeamSlugA` (also supported as an alternate header)
- `TeamB`
- `TeamBSlug`
- `TeamSlugB` (also supported as an alternate header)
- `Date`
- `Time`
- `Field`
- `Status` (`scheduled` or `final`)

### `RSVP` tab
- `TeamSlug`
- `PlayerID`
- `GameID`
- `Response`
- `LastReminderSentAt` ✅ (this is where duplicate-prevention lives)

### `Contacts` tab
- `TeamSlug`
- `PlayerID`
- `PlayerName`
- `ParentEmail`
- `ParentName`
- `CoachEmail`
- `RSVP_Link`

---

## Direct answer to your question: where should `LastReminderSentAt` go?

Put `LastReminderSentAt` in the **`RSVP` tab**.

Why: reminders are game-specific and player-specific, and the RSVP row is keyed by:
- `TeamSlug`
- `PlayerID`
- `GameID`

That makes `RSVP` the cleanest place to store whether a reminder for that exact player/game was already sent.

---

## Sender identity behavior

- If the script runs while logged into `westfieldbaseballrsvp@gmail.com`, emails naturally send from that account.
- The display name is set to `WBL3rdGrade`.
- If you ever run from a different account, the script attempts to use `from: westfieldbaseballrsvp@gmail.com` **only if** that address is configured as a Gmail alias.

---

## Email content (current)

### Subject
`WBL 3rd Grade RSVP Reminder: {PlayerName} vs {Opponent}`

### Body includes
- Parent greeting
- Team/opponent/date/time/field
- The family’s unique `RSVP_Link`
- Reply-routing note to coach

---

## Trigger setup

1. Open the Google Sheet.
2. Extensions → Apps Script.
3. Paste in `docs/rsvp-reminder-apps-script.js`.
4. Save and run `sendRsvpReminders` once manually to authorize.
5. Add trigger:
   - Event source: **Time-driven**
   - Type: **Week timer**
   - Day: **Thursday**
   - Time: **9am to 10am**
6. Verify with 1–2 test players first.

---

## Notes

- Your published Contacts CSV link is fine for website consumption, but this reminder automation reads directly from the workbook tabs in Apps Script.
- The script auto-creates a `ReminderLog` tab if it does not exist.
