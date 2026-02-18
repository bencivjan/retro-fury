# RETRO FURY - Multiplayer PvP Gun Game: High-Level Plan

## Overview

Add a multiplayer PvP "Gun Game" mode to RETRO FURY. Players compete 1v1 in a custom arena map. Each kill promotes the killer to the next weapon in the progression chain. The first player to get a kill with the final weapon (knife) wins the match.

**Weapon Progression:** Pistol → Shotgun → Machine Gun → Sniper → Knife

---

## Architecture: Client-Server with WebSocket

```
┌──────────────┐     WebSocket     ┌──────────────┐     WebSocket     ┌──────────────┐
│   Client A   │ ◄───────────────► │  Node.js     │ ◄───────────────► │   Client B   │
│  (Browser)   │   inputs/state    │  Server      │   inputs/state    │  (Browser)   │
└──────────────┘                   └──────────────┘                   └──────────────┘
```

- **Server**: Authoritative Node.js WebSocket server handles game state, hit validation, weapon progression, scoring, and respawns.
- **Clients**: Send player inputs (movement keys, mouse deltas, fire events). Receive authoritative game state updates (both player positions, health, current weapons, kills, game events).
- **Why server-authoritative**: Prevents cheating, ensures consistent hit detection, single source of truth for weapon progression.

---

## Phase Breakdown

### Phase 1: Project Infrastructure & Networking Foundation
Set up the Node.js server, WebSocket communication layer, and basic message protocol. Establish the client-side network manager that can connect, send, and receive messages. No gameplay yet — just reliable bidirectional communication.

**Key deliverables:**
- Node.js WebSocket server (`server/` directory)
- Message protocol definition (JSON message types)
- Client-side `NetworkManager` class
- Lobby system: create room, join room, ready up

### Phase 2: Main Menu Overhaul
Modify the existing title screen to offer a choice between Single Player and Multiplayer. Add a multiplayer lobby screen for hosting/joining games. The existing single player flow remains untouched.

**Key deliverables:**
- Title screen with "SINGLE PLAYER" / "MULTIPLAYER" selection
- Multiplayer lobby screen (host/join with room code)
- "Waiting for opponent" / "Ready" states
- Clean state management for mode selection

### Phase 3: Gun Game Weapons
Create the two new weapons needed for gun game (Sniper and Knife) and define the gun game weapon progression as a standalone system separate from the single-player weapon definitions.

**Key deliverables:**
- Sniper weapon: hitscan, high damage (100), very slow fire rate (0.8 fps), zoom/scope effect, no spread
- Knife weapon: melee-only, very short range (~1.0 tile), instant kill, fast swing
- Procedural textures for sniper and knife (view model + pickup sprite)
- Gun game weapon progression manager (tracks current tier per player, handles promotion on kill)

### Phase 4: Arena Map
Design and build a dedicated multiplayer arena map optimized for 1v1 PvP gun game. Needs good flow, multiple sight lines, cover options, and defined spawn points.

**Key deliverables:**
- Arena map data file (same tile-grid format as existing levels)
- Symmetric or near-symmetric layout for fairness
- Multiple spawn points (at least 4, spread across map)
- Mix of tight corridors and open areas for varied weapon effectiveness
- Procedural textures for any new wall types (or reuse existing)

### Phase 5: Multiplayer Game Loop
The core multiplayer gameplay implementation. This is the largest phase — it integrates networking, the gun game rules, both players' rendering, and the PvP combat loop.

**Key deliverables:**
- **Server-side game loop**: Tick-based update (20 tps), processes inputs, runs physics, validates hits, manages respawns
- **Client-side prediction**: Local player moves immediately based on own input, reconciles with server state
- **Remote player rendering**: Render opponent as a billboard sprite (reuse enemy sprite pipeline), interpolate position between server updates
- **Hit detection**: Server validates all weapon fire (hitscan rays, melee range checks), applies damage, checks kills
- **Weapon progression**: On kill → promote killer to next weapon tier, reset ammo. On knife kill → trigger win
- **Respawn system**: On death → 2-second respawn timer → spawn at random spawn point with current weapon tier
- **HUD adaptations**: Show opponent's weapon tier, kill feed, score display

### Phase 6: Match Flow & Victory
Implement the full match lifecycle: countdown, active play, match end, and post-game screen.

**Key deliverables:**
- Pre-match countdown (3-2-1-GO)
- Kill feed overlay (recent kills with weapon icons)
- Scoreboard (current weapon tier for each player)
- Match victory screen when knife kill lands
- "Play Again" / "Return to Menu" options
- Disconnect handling (opponent leaves → auto-win or return to menu)

### Phase 7: Polish & Audio
Add multiplayer-specific audio cues, visual feedback, and quality-of-life features.

**Key deliverables:**
- Procedural audio for sniper shot and knife swing
- Kill/death sound effects
- Weapon promotion sound effect and visual flash
- Hit confirmation feedback (crosshair flash, hit sound)
- Network latency indicator on HUD
- Opponent name tag (floating text above remote player sprite)

---

## Technical Details

### Message Protocol (JSON over WebSocket)
```
Client → Server:
  { type: "join", roomCode: "ABCD" }
  { type: "create_room" }
  { type: "ready" }
  { type: "input", keys: [...], mouseDX, mouseDY, fire: bool, dt }

Server → Client:
  { type: "room_created", roomCode: "ABCD" }
  { type: "player_joined", playerId }
  { type: "game_start", map, spawnPoints, yourId }
  { type: "state", players: [{id, x, y, angle, health, weaponTier, alive}], tick }
  { type: "hit", shooterId, targetId, damage, weapon }
  { type: "kill", killerId, victimId, weapon, killerNewTier }
  { type: "respawn", playerId, x, y }
  { type: "victory", winnerId }
  { type: "opponent_disconnected" }
```

### Server Tick Rate
- 20 ticks/second (50ms intervals)
- Client sends inputs every frame, server processes on tick
- State broadcast every tick to both clients

### Rendering the Remote Player
- Reuse existing `SpriteRenderer` — remote player is just another billboard sprite
- Create a "player" sprite sheet (idle, walking frames) using procedural texture generation
- Remote player position is interpolated between last two received server states for smooth movement

### New Files (Estimated)
```
server/
  index.js              — WebSocket server entry point
  game-room.js          — Room management, matchmaking
  game-loop.js          — Server-side game tick, physics, hit validation
  gun-game.js           — Weapon progression rules, win condition

src/
  net/
    network-manager.js  — Client WebSocket connection, message handling
    state-buffer.js     — Interpolation buffer for remote player state
  game/
    gun-game-weapons.js — Sniper + knife definitions, progression tiers
    remote-player.js    — Remote player entity (render, interpolate)
  levels/
    arena.js            — Multiplayer arena map
  ui/
    lobby.js            — Multiplayer lobby screen
    kill-feed.js        — Kill notification overlay
    scoreboard.js       — Gun game progress display
```

### Dependencies
- `ws` npm package for WebSocket server (zero-dependency alternative to socket.io)
- No other external dependencies — keep it lean

---

## Scope Boundaries

**In scope:**
- 1v1 PvP gun game over LAN/localhost
- 5-tier weapon progression (pistol → shotgun → machine gun → sniper → knife)
- One dedicated arena map
- Basic lobby (create/join room)
- Server-authoritative hit detection

**Out of scope (future work):**
- More than 2 players
- Multiple arena maps
- Player customization / skins
- Persistent stats / leaderboards
- NAT traversal / public internet play (works on LAN or with port forwarding)
- Anti-cheat beyond server authority
- Voice chat
