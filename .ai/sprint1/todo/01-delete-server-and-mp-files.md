# Task 01: Delete server directory and multiplayer-only files

## What
Delete all files that exist solely for multiplayer functionality.

## Files to delete
- Entire `server/` directory (Node.js WebSocket server)
- `src/net/network-manager.js` (WebSocket client)
- `src/net/mp-state.js` (multiplayer state tracking)
- `src/ui/lobby.js` (multiplayer lobby UI)
- `src/ui/kill-feed.js` (multiplayer kill feed)
- `src/ui/scoreboard.js` (multiplayer scoreboard)
- `src/game/gun-game.js` (gun game tier progression)
- `src/game/remote-player.js` (remote player interpolation)
- `src/levels/arena.js` (multiplayer arena map)
- `MULTIPLAYER_PLAN.md` (planning doc)
- `MULTIPLAYER_TASKS.md` (task tracking doc)

## Acceptance criteria
- All listed files and directories are removed from the repo
- No other files are modified in this commit
