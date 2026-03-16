# Trivia Weekly Rollup (Sunday → Saturday)

If weekly boards are co-mingled across weeks, the clean fix is to rebuild `TriviaWeekly` directly from `TriviaResponses.SubmittedAt`.

This script does exactly that:

- Reads `TriviaResponses`
- Keeps only rows where `SubmittedAt` is in the current Sunday–Saturday week
- Groups by player
- Calculates `Correct`, `Attempted`, `Accuracy`
- Rewrites `TriviaWeekly` from scratch each run

Script file:

- `docs/trivia-weekly-rollup-apps-script.js`

## Setup

1. Open the spreadsheet → Extensions → Apps Script.
2. Paste script from `docs/trivia-weekly-rollup-apps-script.js`.
3. Run `rebuildTriviaWeeklyFromResponses` once (authorize).
4. Add trigger (time-driven) to run daily or hourly.

## Expected columns

### TriviaResponses
- `PlayerName`
- `TeamName`
- `SubmittedAt`
- `IsCorrect` (or `Correct`)

### TriviaWeekly (script rewrites this tab)
- `Rank`, `PlayerName`, `Team`, `Correct`, `Attempted`, `Accuracy`, `WeekStart`, `WeekEnd`, `UpdatedAt`

