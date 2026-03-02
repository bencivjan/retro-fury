# Task 02: Strip all multiplayer code from main.js

## What
Remove every line of multiplayer-related code from `src/main.js`. This is the largest task — main.js has interleaved MP logic throughout.

## Changes required
- Remove all multiplayer imports (NetworkManager, MultiplayerState, LobbyScreen, KillFeed, ScoreboardDisplay, GUN_GAME_TIERS, TIER_NAMES, arena)
- Remove MP game states from the GameState enum (LOBBY, MP_PLAYING, MP_DEATH, MP_VICTORY)
- Remove all MP-related variable declarations and initialization
- Remove MP branches from the `update()` function
- Remove MP branches from the `render()` function
- Remove MP-related input handling
- Remove any MP utility functions or helpers
- Ensure the remaining single-player code is clean and functional

## Acceptance criteria
- Zero references to multiplayer, network, lobby, kill-feed, scoreboard, gun-game, remote-player, or arena in main.js
- All single-player game states remain functional
- File loads without import errors (all imports resolve)
- Game state machine flows correctly: LOADING → TITLE → LEVEL_INTRO → PLAYING → (PAUSED/DEATH/LEVEL_COMPLETE) → VICTORY
