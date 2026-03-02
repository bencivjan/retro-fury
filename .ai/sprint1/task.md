# Sprint 1: Refactor to Static Single-Player Site

## Goal
Refactor the repo so it is fully statically hostable (no server required). Remove all multiplayer functionality, the Node.js server, and multiplayer UI. Keep the 5 single-player campaign levels intact and working. The root `index.html` remains the entry point.

## Current State
- Game already has `index.html` at root loading `src/main.js` as ES6 module
- Single-player works client-side only (no server needed)
- Multiplayer code is interleaved in `src/main.js` (imports, game states, update/render branches)
- Server lives in `server/` directory
- Multiplayer-specific client modules: `src/net/`, `src/ui/lobby.js`, `src/ui/kill-feed.js`, `src/ui/scoreboard.js`, `src/game/gun-game.js`, `src/game/remote-player.js`, `src/levels/arena.js`

## High-Level Plan

### Phase 1: Remove server and multiplayer-only files
Delete the `server/` directory entirely. Delete client files that exist solely for multiplayer: `src/net/`, `src/ui/lobby.js`, `src/ui/kill-feed.js`, `src/ui/scoreboard.js`, `src/game/gun-game.js`, `src/game/remote-player.js`, `src/levels/arena.js`. Delete multiplayer planning docs (`MULTIPLAYER_PLAN.md`, `MULTIPLAYER_TASKS.md`).

### Phase 2: Strip multiplayer code from main.js
Remove all multiplayer imports. Remove MP game states (`LOBBY`, `MP_PLAYING`, `MP_DEATH`, `MP_VICTORY`). Remove MP-related variables and initialization. Strip MP branches from `update()` and `render()` functions. Remove the "Multiplayer" option from the title menu. Clean up any dead code or unused references.

### Phase 3: Clean up remaining modules
Audit `src/ui/menu.js` for multiplayer menu options and remove them. Audit `src/game/weapon.js` for any MP-only weapon configurations. Audit `src/ui/hud.js` and `src/ui/minimap.js` for MP rendering paths. Ensure all remaining imports resolve correctly.

### Phase 4: Add test infrastructure
Add a lightweight test runner (no npm/node dependency — browser-based or use a simple script). Write tests for core game systems: raycasting, player movement/collision, weapon firing, enemy AI, level loading. Ensure tests can run in a static hosting context.

### Phase 5: Verify static hosting works
Confirm the game loads and plays via a simple HTTP server (`python -m http.server`). Verify all 5 campaign levels load correctly. Verify no console errors referencing removed multiplayer code. Play-test using browser automation.

## Success Criteria
- [ ] `server/` directory deleted
- [ ] All `src/net/` files deleted
- [ ] All MP-only UI files deleted
- [ ] `main.js` has zero multiplayer references
- [ ] Title menu shows only single-player option
- [ ] All 5 campaign levels playable
- [ ] No JavaScript errors in console
- [ ] Game works when served from any static file server
- [ ] Test suite passes
