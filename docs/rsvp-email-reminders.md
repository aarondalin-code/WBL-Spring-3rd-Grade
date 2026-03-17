# RSVP Email Reminders (Current Live Script Alignment)

This document now mirrors the current working Apps Script you shared.

## Current behavior

- Sender account/display: `westfieldbaseballrsvp@gmail.com` + `WBL3rdGrade` name.
- Uses `TeamSlug` as the key to match Contacts/RSVP rows to the game side (`TeamASlug`/`TeamBSlug`).
- Builds reminder recipient list from `Contacts` + latest RSVP response per (`TeamSlug`,`PlayerID`,`GameID`).
- Skips reminders when latest response is `yes` or `no`.
- Prevents duplicates by reading prior `SENT` rows in `ReminderLog`.
- Includes each family’s `RSVP_Link` in the email body.
- Sends with `replyTo` set to `CoachEmail`.

## Important current setting

- `onlySendOnThursday` is currently set to `false` in the script, so manual runs are not weekday-restricted.
- If you want strict Thursday-only enforcement in code, set it back to `true`.

## Sheet/tab mapping used by the shared script

### `Games`
- `GameID`
- `TeamA`
- `TeamASlug`
- `TeamB`
- `TeamBSlug`
- `Date`
- `Time`
- `Field`
- `Status`

### `RSVPs`
- `TeamSlug`
- `PlayerID`
- `GameID`
- `Response`
- `LastReminderSentAt` (present in schema; duplicate prevention currently comes from `ReminderLog`)

### `Contacts`
- `TeamSlug`
- `PlayerID`
- `PlayerName`
- `ParentEmail`
- `ParentName`
- `CoachEmail`
- `RSVP_Link`

### `ReminderLog`
Auto-created if missing with columns:
- `Timestamp`, `TeamSlug`, `PlayerID`, `PlayerName`, `ParentEmail`, `CoachEmail`, `GameID`, `GameDate`, `Result`, `Details`

## Trigger recommendation

- Keep the production trigger as **weekly Thursday 9am ET**.
- Use manual runs for spot-checks after any change.

