# PR Description

## Title
fix: add Telegram reputation commands and route handlers

## Summary
This PR adds Telegram command integration for reputation and leaderboard features, including new route handlers for the Telegram bot command flow.

## Changes Included
- Added `backend/src/bots/telegram/commands/reputationCommand.ts` implementing reputation and leaderboard command handling.
- Updated `backend/src/bots/telegram/index.ts` to register and route new Telegram commands:
  - `/reputation`
  - `/leaderboard`
  - `/track`
  - `/untrack`
  - `/list`
  - `/balance`
  - `/tx`
  - `/price`
  - `/status`
  - `/help`

## Motivation
This change improves Telegram bot functionality by exposing reputation-related features and ensuring command routing is centralized through the Telegram bot command registration flow.

## Testing
- Confirmed commit successfully created and pushed on branch `feat/solve-pending-issues`.
- Verified updated Telegram commands are now registered and handled by the bot entrypoint.
- No runtime verification beyond git operation was performed in this PR description.

## Notes
The branch is now tracking `origin/feat/solve-pending-issues` and contains only the Telegram bot command updates relevant to this feature request.