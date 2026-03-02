# Task 04: Audit and clean remaining modules for MP references

## What
Scan all remaining source files for any lingering multiplayer references and remove them. Some modules may have conditional MP logic or unused exports.

## Files to audit
- `src/game/weapon.js` — check for MP-specific weapon configs
- `src/game/player.js` — check for MP-related properties or methods
- `src/ui/hud.js` — check for MP rendering branches
- `src/ui/minimap.js` — check for MP rendering branches
- `src/engine/sprite.js` — check for remote player sprite handling
- `src/audio/audio.js` — check for MP-specific sounds
- `src/utils/input.js` — check for MP-specific input handling
- All other remaining source files

## Acceptance criteria
- No remaining file references multiplayer, network, lobby, arena, gun-game, remote-player, kill-feed, or scoreboard
- All imports across the codebase resolve correctly
- No unused exports or dead code paths related to multiplayer
