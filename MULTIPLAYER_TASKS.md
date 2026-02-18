# RETRO FURY - Multiplayer Tasks Breakdown

## Phase 1: Server Infrastructure & Networking

### Task 1.1: Create Node.js WebSocket Server
- Create `server/` directory at project root
- Create `server/package.json` with `ws` dependency (no other deps)
- Create `server/index.js` — HTTP server on port 3000 that upgrades to WebSocket
- On new connection: assign a unique player ID, log connection
- On disconnect: clean up player from any active room, notify other player
- Add a `start` script to package.json

### Task 1.2: Room Management System
- Create `server/room.js` — Room class that manages a game session
- Room stores: room code (4 uppercase letters), two player slots, room state (waiting/playing/ended)
- `createRoom(playerId)`: generate unique 4-letter code, create room, add creator as player 1
- `joinRoom(roomCode, playerId)`: validate room exists and has open slot, add as player 2
- `removePlayer(playerId)`: remove from room, notify remaining player, destroy room if empty
- Room code generation: random 4 uppercase ASCII chars, retry if collision

### Task 1.3: Message Protocol
- Create `server/protocol.js` — defines all message types as string constants
- Client-to-server message types: `join`, `create_room`, `ready`, `input`
- Server-to-client message types: `room_created`, `player_joined`, `game_start`, `state`, `hit`, `kill`, `respawn`, `victory`, `opponent_disconnected`, `error`
- Each message is a JSON object with a `type` field plus type-specific data fields
- Export a `parse(rawString)` function that JSON-parses and validates the `type` field
- Export a `serialize(msgObject)` function that JSON-stringifies

### Task 1.4: Wire Server Message Routing
- In `server/index.js`, on WebSocket message received: parse with protocol, route to handler
- Handle `create_room`: create room via room manager, send back `room_created` with code
- Handle `join`: join room, send `player_joined` to both players
- Handle `ready`: mark player as ready in room; when both ready, send `game_start` to both
- Handle `input`: store input in the room's pending input buffer for that player
- All unknown/malformed messages: send `error` response

### Task 1.5: Client Network Manager
- Create `src/net/network-manager.js`
- Constructor takes WebSocket URL (defaults to `ws://localhost:3000`)
- `connect()`: open WebSocket, return promise that resolves on open
- `send(msgObject)`: serialize and send via WebSocket
- `onMessage(callback)`: register a handler for incoming parsed messages
- `disconnect()`: close WebSocket cleanly
- `isConnected()`: returns boolean
- Internal: parse incoming messages, dispatch to registered callback
- Handle connection errors and unexpected closes by calling an `onDisconnect` callback

## Phase 2: Menu System Overhaul

### Task 2.1: Add Game Mode Selection to Title Screen
- In `src/ui/menu.js`, modify `renderTitle()` to show two selectable options below the title
- Options: "SINGLE PLAYER" and "MULTIPLAYER" displayed vertically
- Add a `selectedOption` property (0 or 1) to MenuSystem
- W/S or Up/Down arrow keys move selection; selected option is highlighted (e.g., yellow text vs grey)
- Enter key confirms selection
- Add a new method `getSelectedMode()` that returns `'singleplayer'` or `'multiplayer'`
- The existing "PRESS ENTER TO START" prompt is replaced by the two options

### Task 2.2: Create Multiplayer Lobby Screen
- Create `src/ui/lobby.js` — LobbyScreen class
- Two sub-states: `HOST` and `JOIN`
- On entry from menu: show two options "HOST GAME" and "JOIN GAME" (same W/S + Enter navigation)
- HOST state: display "CREATING ROOM..." then display the room code in large text, "WAITING FOR OPPONENT..."
- JOIN state: display a 4-character input field for room code entry, typed via keyboard A-Z keys, Backspace to delete, Enter to submit
- When both players connected: show "OPPONENT CONNECTED" then "PRESS ENTER WHEN READY"
- Both players press Enter → send `ready` message → wait for `game_start` from server
- Render all text in the same retro style (monospace, small fonts matching 320x200 resolution)
- ESC returns to previous screen at any point

### Task 2.3: Integrate Mode Selection into Main Game Loop
- In `src/main.js`, add new game states: `MODE_SELECT` (inside TITLE), `LOBBY`, `MP_PLAYING`, `MP_DEATH`, `MP_VICTORY`
- Modify the TITLE state: when Enter is pressed and mode is 'singleplayer', proceed to LEVEL_INTRO as before; when 'multiplayer', transition to LOBBY state
- LOBBY state: update/render the LobbyScreen; when `game_start` received, transition to MP_PLAYING
- These new states will be wired to the multiplayer game loop in Phase 5

## Phase 3: Gun Game Weapons

### Task 3.1: Define Sniper Weapon
- In `src/game/weapon.js`, add a new weapon definition at index 5 in WEAPON_DEFS array:
  - name: 'Sniper Rifle'
  - damage: 100 (one-shot body hit kill against 100hp player)
  - fireRate: 0.8 (very slow — one shot every 1.25 seconds)
  - ammoType: 'sniper' (new ammo type, or use infinite ammo with ammoPerShot: 0)
  - spread: 0 (perfectly accurate)
  - isProjectile: false (hitscan)
  - spriteId: 305 (new HUD sprite)
- This weapon is only available in gun game mode, not in single player

### Task 3.2: Define Knife Weapon
- In `src/game/weapon.js`, add a new weapon definition at index 6 in WEAPON_DEFS array:
  - name: 'Knife'
  - damage: 200 (instant kill)
  - fireRate: 2 (fast swing)
  - ammoType: 'none' with ammoPerShot: 0 (infinite)
  - spread: 0
  - isProjectile: false
  - spriteId: 306 (new HUD sprite)
  - Add a new property `maxRange: 1.2` to indicate melee-only range (tiles)
  - In `_castHitscanRay`, if the weapon def has `maxRange`, use that instead of MAX_HITSCAN_RANGE

### Task 3.3: Generate Sniper Rifle HUD Texture
- In `src/utils/textures.js`, add `generateSniperRifleHUD()` function
- 3-frame sprite sheet at 128x128 per frame (same format as other weapons)
- Draw a long, slim rifle with scope on top — distinct silhouette from machine gun
- Frame 0: idle, Frame 1: fire with sharp muzzle flash, Frame 2: recoil settling
- Register as texture ID 305 in TextureManager._generateAll()

### Task 3.4: Generate Knife HUD Texture
- In `src/utils/textures.js`, add `generateKnifeHUD()` function
- 3-frame sprite sheet at 128x128 per frame
- Draw a combat knife held in the hand — blade pointing up/forward
- Frame 0: idle (knife ready), Frame 1: slash right, Frame 2: slash follow-through
- No muzzle flash — instead, draw a motion arc/trail on the slash frames
- Register as texture ID 306 in TextureManager._generateAll()

### Task 3.5: Generate Sniper and Knife Procedural Audio
- In `src/audio/audio.js`, add two new sound generators:
- `_genSniperFire(sr)`: loud, sharp crack — high-frequency transient followed by echo-like reverb tail. Louder and crisper than pistol, with longer tail (~0.4s)
- `_genKnifeSwing(sr)`: quick whoosh — short frequency sweep (high to low, ~0.1s) with subtle noise
- Register as `sniper_fire` and `knife_swing` in `_generateAllSounds()`

### Task 3.6: Gun Game Weapon Progression System
- Create `src/game/gun-game.js`
- Define `GUN_GAME_TIERS` array: indices into WEAPON_DEFS for [0(pistol), 1(shotgun), 2(machinegun), 5(sniper), 6(knife)]
- `GunGameManager` class with per-player state:
  - `tiers: Map<playerId, number>` — current tier index (0-4) for each player
  - `getTier(playerId)` → tier index
  - `getWeaponIndex(playerId)` → WEAPON_DEFS index for their current tier
  - `promote(playerId)` → increment tier, return new tier; if already at tier 4 (knife), return -1 (signals this was a knife kill = victory)
  - `getAmmoForTier(tier)` → return ammo config for weapon at that tier (infinite for pistol and knife, fixed amounts for others)
  - `resetPlayer(playerId)` → reset to tier 0 (for match restart)

## Phase 4: Arena Map

### Task 4.1: Design Arena Map Layout
- Create `src/levels/arena.js`
- 32x32 tile grid optimized for 1v1 PvP
- Layout features:
  - Roughly symmetric across center (fair for both players)
  - Central open area for sniper duels (3-4 tile wide corridors converging)
  - 4 corner rooms with narrow doorways for close-quarters combat
  - L-shaped corridors connecting corners through center
  - Pillars/columns in open areas for cover
  - No dead ends — every path loops back (good flow)
- Use wall textures 1 (brick), 2 (concrete), 4 (metal), 5 (tech panel) for variety
- 4 spawn points in different quadrants, each in a semi-protected alcove
- Export as same format as existing levels (map grid, palette, name)
- Palette: dark industrial theme (dark grey ceiling, dark floor)

### Task 4.2: Generate Player Character Sprite
- In `src/utils/textures.js`, add `generatePlayerSprite()` function
- Create a sprite sheet using the existing `drawHumanoid` helpers
- Use a distinct color scheme from enemies (e.g., bright orange/yellow uniform)
- 9 frames matching enemy sprite format: idle, walk1, walk2, attack1, attack2, pain, death1, death2, death3
- Register as texture ID 110 in TextureManager._generateAll()
- This sprite is used to render the remote player as a billboard

## Phase 5: Multiplayer Game Loop

### Task 5.1: Server-Side Game Loop
- Create `server/game-loop.js`
- `GameLoop` class that processes a game room's state at 20 ticks per second
- Stores authoritative state: both player positions, angles, health, weapon tiers, alive status, respawn timers
- `start(room)`: begin setInterval at 50ms
- `stop()`: clear interval
- Each tick:
  1. Process buffered inputs for each player (apply movement with collision detection against arena map)
  2. Process fire events (hitscan ray validation against map walls and opponent position)
  3. Check for kills and weapon tier promotions
  4. Process respawn timers (2-second timer, then respawn at random spawn point)
  5. Check for knife kill → declare victory
  6. Broadcast state update to both clients

### Task 5.2: Server-Side Collision Detection
- In `server/game-loop.js` (or a helper `server/physics.js`), implement tile collision for the server
- Port the player collision logic from `src/game/player.js` (circle vs AABB with wall sliding)
- The server needs the arena map grid to validate movement
- Import or inline the arena map data on the server side

### Task 5.3: Server-Side Hit Detection
- In `server/game-loop.js`, implement hitscan validation
- When a player fires: cast ray from their authoritative position in their facing direction
- Check ray against map walls (DDA) and opponent position (circle intersection at radius 0.4)
- For shotgun: validate each pellet with random spread (use server-side seed)
- For knife: only validate if opponent is within 1.2 tiles
- For sniper: same as pistol but with higher damage
- Return hit result: { hit: boolean, damage: number }

### Task 5.4: Client-Side State Manager for Multiplayer
- Create `src/net/mp-state.js`
- Manages the local multiplayer game state
- Stores: local player state (predicted), remote player state (interpolated), gun game tiers, kill feed
- `applyServerState(stateMsg)`: update remote player position/angle/health; reconcile local player position with server position (snap if too far off, >1 tile distance)
- `getRemotePlayerSprite()`: return a WorldSprite object for the remote player (position, texture ID 110, frame index based on movement)
- Interpolation: store last two server states for remote player, lerp between them based on time since last update

### Task 5.5: Remote Player Rendering
- Create `src/game/remote-player.js`
- RemotePlayer class that produces a renderable sprite for the existing SpriteRenderer
- Properties: pos {x,y}, angle, health, weaponTier, alive, animFrame
- `toWorldSprite()`: return {x, y, textureId: 110, frameIndex, scaleX: 1, scaleY: 1}
- Frame selection: 0=idle if not moving, 1-2=walk alternating based on time, 3-4=attack if firing
- This object is added to the sprites array alongside item sprites during renderPlaying

### Task 5.6: Multiplayer Update Loop
- In `src/main.js`, create `updateMultiplayer(dt)` function for the MP_PLAYING state
- Each frame:
  1. Read local input (same as single player: WASD, mouse, fire)
  2. Apply local prediction: move local player with collision detection (same as updatePlaying but no enemies/doors/items)
  3. Send input packet to server via NetworkManager: { keys, mouseDX, mouseDY, fire, dt }
  4. Process any incoming server messages (state updates, hit events, kill events, respawn, victory)
  5. Update remote player interpolation
  6. Update weapon system for local player (fire animation, bob)
  7. Update gun game weapon tier display
  8. Update minimap exploration

### Task 5.7: Multiplayer Render Loop
- In `src/main.js`, create `renderMultiplayer(dt)` function
- Same render pipeline as single player but simplified (no doors, no items, no AI enemies):
  1. Clear frame buffer
  2. Draw ceiling and floor with arena palette
  3. Raycaster with arena map
  4. Build sprite array: remote player sprite only
  5. Sprite renderer draws remote player
  6. Draw local weapon HUD (view model with fire animation)
  7. HUD rendering adapted for PvP: health, current weapon name, weapon tier progress
  8. Minimap with arena map
  9. Kill feed overlay
  10. Scoreboard (current tiers)

### Task 5.8: Respawn System
- When server sends `kill` message targeting local player:
  - Show death flash (red screen overlay, 0.5s)
  - Show "KILLED BY [OPPONENT]" briefly
  - Disable input during 2-second respawn timer
  - Show respawn countdown on screen
- When server sends `respawn` message:
  - Teleport local player to the respawn position
  - Reset health to 100
  - Re-enable input
  - Brief invulnerability flash (0.5s of blinking)
- When server sends `kill` message where local player is killer:
  - Show "+1 LEVEL UP" notification
  - Play weapon_pickup sound
  - Switch to the next weapon tier

## Phase 6: Match Flow & Victory

### Task 6.1: Pre-Match Countdown
- After `game_start` received, before entering MP_PLAYING:
- Show 3-second countdown overlay: "3" → "2" → "1" → "GO!"
- Both players can look around but cannot move or fire during countdown
- Each number displayed centered on screen in large retro font with flash effect
- After "GO!" fades, transition to full MP_PLAYING state

### Task 6.2: Kill Feed UI
- Create `src/ui/kill-feed.js`
- KillFeed class that displays recent kill notifications
- `addKill(killerName, victimName, weaponName)`: add entry to feed
- Render: show last 3 kills in top-left corner, each line fades out after 4 seconds
- Format: "KILLER [WEAPON] VICTIM" in small retro font
- Weapon name in the kill's weapon color (e.g., yellow for pistol, red for shotgun)

### Task 6.3: Weapon Tier Scoreboard
- Create `src/ui/scoreboard.js`
- ScoreboardDisplay class showing both players' weapon progression
- Render as a small bar at the top-center of screen:
  - 5 boxes in a row (one per weapon tier)
  - Local player's current tier highlighted in green
  - Remote player's current tier highlighted in red
  - Weapon icons/labels in each box: P, SG, MG, SR, K
- Alternately: hold Tab to see full overlay with player names, tiers, and kill counts

### Task 6.4: Victory Screen
- When server sends `victory` message:
  - Transition to MP_VICTORY game state
  - If local player won: show "VICTORY!" in gold with the winning weapon displayed
  - If local player lost: show "DEFEATED" in red
  - Display match stats: kills per weapon tier, total time
  - Options: "PLAY AGAIN" (sends ready to server for rematch) or "QUIT" (return to title)
  - Play appropriate sound (level_complete for win, player_death for loss)

### Task 6.5: Disconnect Handling
- When server sends `opponent_disconnected`:
  - Show "OPPONENT DISCONNECTED" overlay
  - Auto-return to lobby after 3 seconds (or press Enter to go immediately)
- When local client loses connection:
  - Show "CONNECTION LOST" overlay
  - Return to title screen after 3 seconds

## Phase 7: Polish & Audio

### Task 7.1: Multiplayer-Specific Sound Effects
- Add to `src/audio/audio.js`:
  - `kill_confirmed`: triumphant sting — quick ascending 3-note chime (similar to objective_complete but shorter, ~0.3s)
  - `player_killed`: deeper version of player_death but shorter (~0.5s)
  - `weapon_promote`: ascending power-up sound — rising frequency sweep with harmonics (~0.4s)
  - `countdown_tick`: short metallic click for 3-2-1 countdown
  - `countdown_go`: bright burst sound for "GO!"
  - `match_victory`: extended fanfare (reuse level_complete or create longer version)

### Task 7.2: Hit Confirmation Feedback
- When a hitscan weapon hits the opponent (server confirms hit):
  - Flash the crosshair red for 0.15 seconds
  - Play a short "hit marker" sound (quick high-pitched tick)
- Add `hitConfirmTimer` to HUD that triggers the red flash
- Add `hit_marker` sound to AudioManager: very short (~0.05s) high-pitched click

### Task 7.3: Weapon Promotion Visual Effect
- When promoted to next weapon tier:
  - Brief full-screen yellow flash (0.2s, fading)
  - The weapon name appears centered: "PROMOTED: SHOTGUN" in gold text, fades over 2 seconds
  - Current weapon HUD sprite transitions smoothly

### Task 7.4: Opponent Name Tag
- Render the opponent's name ("P1" or "P2") as floating text above their sprite
- Only visible when opponent is within line of sight and within 15 tiles
- Small text rendered via canvas above the billboard sprite position
- Fades with distance (fully visible at 5 tiles, fades to invisible at 15)
