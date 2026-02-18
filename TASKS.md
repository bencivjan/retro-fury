# RETRO FURY - Implementation Tasks

Detailed task breakdown for implementation. Each task is a single-commit-sized unit of work.
Tasks are ordered by dependency - later tasks may depend on earlier ones.

Reference: `GAME_PLAN.md` for full design specification.

---

## Phase 1: Project Scaffold & Utilities

### Task 1.1: Project Scaffold
**Create the base project files and directory structure.**
- Create `index.html` with a fullscreen `<canvas>` element, pointer lock on click, and script imports using ES6 modules
- Create `css/style.css` with black background, centered canvas, hidden cursor, retro font (use a system monospace font)
- Create empty stub files for all modules listed in `GAME_PLAN.md` file structure so imports don't break during development
- The canvas should render at 320x200 internal resolution, scaled to fill the window while maintaining aspect ratio
- **Acceptance**: Opening `index.html` in a browser shows a black canvas that fills the screen. No console errors.

### Task 1.2: Math Utilities
**Implement `src/utils/math.js` with vector and angle helper functions.**
- 2D vector operations: add, subtract, multiply, normalize, dot product, length, distance
- Angle utilities: degrees-to-radians, radians-to-degrees, normalize angle to 0-2PI range
- Line intersection for raycasting: ray-segment intersection test
- Clamping, lerp (linear interpolation), random range
- **Acceptance**: All functions are pure, exported, and handle edge cases (zero vectors, angle wrapping).

### Task 1.3: Input Handler
**Implement `src/utils/input.js` for keyboard and mouse input.**
- Track key states (down/up) using a Set, expose `isKeyDown(key)` method
- Track mouse movement delta for look rotation, using pointer lock API
- Track mouse button state for firing
- Expose `update()` to be called each frame that resets per-frame deltas
- Handle pointer lock request on canvas click and pointer lock exit on Esc
- Prevent default on game keys (WASD, E, M, Tab, 1-5) to avoid browser shortcuts
- **Acceptance**: Input state is queryable per-frame. Pointer lock engages on click. Mouse deltas report correctly.

---

## Phase 2: Core Raycasting Engine

### Task 2.1: Camera Module
**Implement `src/engine/camera.js` with the player's view representation.**
- Camera properties: position (x, y), direction vector, view plane vector (perpendicular to direction, determines FOV)
- FOV of approximately 66 degrees (set via plane vector magnitude)
- Methods: `rotate(angle)` to turn left/right, `screenXToRayDir(screenX, screenWidth)` to compute ray direction for a given screen column
- Camera is a data object, not tied to rendering - it feeds into the raycaster
- **Acceptance**: Ray directions fan out correctly across the screen width. Rotation updates both direction and plane vectors.

### Task 2.2: Raycasting Engine
**Implement `src/engine/raycaster.js` using the DDA (Digital Differential Analyzer) algorithm.**
- For each screen column, cast a ray from the camera through the map grid
- Use DDA stepping to find the first wall tile hit
- Calculate perpendicular distance (not Euclidean, to avoid fisheye) to determine wall strip height
- Record per-column: wall distance, wall texture ID, exact texture X coordinate (where on the wall the ray hit), and which side was hit (N/S vs E/W for shading)
- Store results in a depth buffer array (one entry per screen column) for use by sprite renderer
- Support multiple wall texture IDs (tile values in the map determine texture)
- Apply darker shading to one wall side (N/S vs E/W) for visual depth
- **Acceptance**: Given a camera and a 2D tile map, produces an array of wall strip data. Distance-based wall heights look correct with no fisheye distortion.

### Task 2.3: Renderer
**Implement `src/engine/renderer.js` that composites all visual layers onto the canvas.**
- Clear the canvas each frame
- Draw ceiling (top half, solid dark color) and floor (bottom half, slightly lighter color) - per level palette
- Draw wall strips from raycaster output: for each column, sample from the wall texture and draw a vertical strip at the correct height
- Apply distance-based fog/darkening (further walls are darker, fade to black at max distance)
- Provide a method to draw the sprite layer (called after walls, before HUD)
- Provide a method to draw the HUD layer on top
- Use an offscreen canvas at 320x200 then scale to display canvas for crisp pixels (use `imageSmoothingEnabled = false`)
- Target 60 FPS - optimize the inner rendering loop (avoid allocations, use typed arrays)
- **Acceptance**: Renders a textured 3D-looking scene from a tile map. Walls have correct perspective, texturing, and shading. Runs at 60 FPS.

### Task 2.4: Sprite Rendering
**Implement `src/engine/sprite.js` for billboarded sprite rendering.**
- Accept a list of sprites (each with position, texture, animation frame)
- Transform sprite positions relative to camera (translate + rotate into camera space)
- Calculate screen position and scale based on perpendicular distance
- Clip sprites against the wall depth buffer (sprites behind walls are not drawn)
- Draw sprites column-by-column, checking depth buffer per column for partial occlusion
- Sort sprites back-to-front before drawing (painter's algorithm)
- Support sprite sheets: given a sprite texture and frame index, sample the correct sub-region
- Handle transparency in sprites (skip transparent pixels)
- **Acceptance**: Sprites appear at correct world positions, scale with distance, are occluded by walls, and render with transparency.

---

## Phase 3: Procedural Assets

### Task 3.1: Wall & Environment Textures
**Implement the wall/environment portion of `src/utils/textures.js`.**
- Generate all textures as ImageData objects at 64x64 pixels
- Wall textures (at least 8 variants): brick (red/brown), concrete (grey), lab tile (white/teal), prison metal (dark grey/rust), tech panel (blue/silver), crate (wood brown), door (metal with handle detail), locked door (same but with colored stripe matching keycard)
- Each texture should look distinctly retro/pixelated with visible pixel detail
- Use a seeded approach so textures are deterministic
- Floor/ceiling colors defined per-level (not textures, just solid colors)
- Export a `TextureManager` that stores all generated textures and provides `getTexture(id)` lookup
- **Acceptance**: All textures are visually distinct, look retro/pixelated, and render correctly on walls in the raycaster.

### Task 3.2: Sprite Textures (Enemies, Items, Weapons)
**Generate sprite textures for all game entities in `src/utils/textures.js`.**
- Enemy sprites: each enemy type needs frames for idle (1), walk (2), attack (2), pain (1), death (3) - front-facing only (no rotation, classic DOOM style)
  - Grunt: green uniform, small build
  - Soldier: blue uniform, medium build, rifle visible
  - Scout: light grey, lean build, shotgun
  - Brute: large sprite (2x width), heavy armor, minigun
  - Commander: very large sprite, red/black armor, imposing
- Item sprites: health pack (white box, red cross), armor (blue vest), ammo boxes (yellow/green/red per type), keycards (colored rectangles), weapon pickups (simplified weapon shapes)
- Weapon sprites (HUD): each weapon needs idle frame and 2-3 fire animation frames, drawn large at bottom of screen (hand + weapon)
  - Pistol, Shotgun, Machine Gun, Rocket Launcher, Plasma Rifle
- All sprites use the same pixel-art style as wall textures
- Muzzle flash sprite (bright yellow/white burst)
- **Acceptance**: All entity types have visually distinct, recognizable sprites. Animations have enough frames to look good in motion.

### Task 3.3: Audio System
**Implement `src/audio/audio.js` using Web Audio API for procedural retro sounds.**
- Create an AudioManager class that initializes an AudioContext (with user gesture requirement handling)
- Procedurally generate sound effects using oscillators, noise, and envelopes:
  - Weapon sounds: pistol (short pop), shotgun (loud blast), machine gun (rapid taps), rocket (whoosh + low boom), plasma (zap/buzz)
  - Enemy sounds: alert grunt, pain yelp (vary per enemy type by pitch), death scream
  - Environment: door slide open, item pickup (positive chime), objective complete (fanfare), keycard pickup (special chime)
  - Player: hurt sound (oof), death sound, low health warning beep
  - Ambient: low droning hum per level (different frequency/character per level theme)
- Support positional audio approximation: pan left/right based on angle to sound source relative to player facing direction
- Volume control, ability to mute
- Keep sounds short (< 1 second for most effects) for retro feel
- **Acceptance**: All gameplay actions have corresponding sound effects. Sounds are retro-appropriate and not annoying. Positional panning works.

---

## Phase 4: Game Entities

### Task 4.1: Player System
**Implement `src/game/player.js` for player state and movement.**
- Player state: position (x, y), angle, health (max 200), armor (max 100), ammo (per type), weapon inventory, current weapon index, keys/keycards collected, alive/dead flag
- Movement: WASD relative to facing direction. Forward/back along direction vector, strafe perpendicular. Collision detection against wall tiles (circle-vs-tile with small radius ~0.2). Slide along walls on collision (don't just stop).
- Mouse look: rotate player angle based on mouse delta X. Sensitivity configurable.
- Interaction: when E pressed, check for interactable entities within range (~1.5 tiles in front of player) - doors, objectives, NPCs
- Taking damage: reduce armor first (50% absorption), then health. Trigger damage flash and hurt sound. At 0 health, enter death state.
- Per-frame `update(dt, map)` method that processes input and updates position
- **Acceptance**: Player moves smoothly, collides with walls and slides along them, rotates with mouse, and tracks all state correctly.

### Task 4.2: Door System
**Implement `src/game/door.js` for interactive doors.**
- Door states: CLOSED, OPENING, OPEN, CLOSING
- When player presses E near a closed door: if unlocked, begin opening animation (slide up or to side over ~0.5 seconds). If locked, check player keycards and either unlock or show "NEED [COLOR] KEYCARD" message.
- Doors auto-close after 3 seconds of being fully open (unless blocked by entity)
- In the tile map, doors occupy a tile. When closed, they block raycasting like a wall. When open, they don't. Partially open doors render at intermediate positions.
- Door rendering: rendered as a thin wall in the middle of the tile (offset from tile edge) with a door texture
- **Acceptance**: Doors open/close smoothly, block/unblock movement and raycasting, respect keycard requirements.

### Task 4.3: Item System
**Implement `src/game/item.js` for pickup items.**
- Item types: HEALTH_SMALL (+10), HEALTH_LARGE (+25), ARMOR (+25), AMMO_BULLETS (+20), AMMO_SHELLS (+8), AMMO_ROCKETS (+3), AMMO_CELLS (+15), KEYCARD_BLUE, KEYCARD_RED, KEYCARD_YELLOW, WEAPON_SHOTGUN, WEAPON_MACHINEGUN, WEAPON_ROCKET, WEAPON_PLASMA, OBJECTIVE_ITEM (level-specific)
- Items float and bob up and down slightly (sine wave animation)
- When player walks within pickup radius (~0.5 tiles), apply item effect, play pickup sound, remove item from world
- Don't pick up health/armor if already at max. Don't pick up ammo if at max for that type.
- Weapon pickups: add weapon to inventory, give starter ammo for that weapon, switch to new weapon
- Keycards: add to player keycard set, show "[COLOR] KEYCARD ACQUIRED" message
- **Acceptance**: All item types work correctly. Pickup radius feels right. Items don't pick up when at max. Visual bob animation looks good.

### Task 4.4: Weapon System
**Implement `src/game/weapon.js` for the weapon mechanics.**
- Define 5 weapons with properties: name, damage, fireRate (shots per second), ammoType, ammoPerShot, spread (for shotgun), isProjectile (for rockets), maxAmmo, spriteFrames
  1. Pistol: 10 dmg, 3/sec, infinite ammo, hitscan, no spread
  2. Shotgun: 8 dmg x 5 pellets, 1.2/sec, shells, hitscan, wide spread
  3. Machine Gun: 8 dmg, 10/sec, bullets, hitscan, slight spread
  4. Rocket Launcher: 80 dmg direct + 40 splash (2 tile radius), 1/sec, rockets, projectile
  5. Plasma Rifle: 25 dmg, 6/sec, cells, fast projectile (visible bolt)
- Weapon state machine: IDLE -> FIRING (show fire frames, deal damage) -> COOLDOWN -> IDLE
- Number keys 1-5 switch weapons (only if weapon is in inventory)
- Weapon bob: slight vertical oscillation synced to player movement
- Hitscan weapons: cast a ray from player in facing direction, check for enemy hits along the ray (use the raycasting system)
- Projectile weapons: spawn a projectile entity that travels forward and checks for collisions each frame
- **Acceptance**: All 5 weapons fire correctly with different feels. Damage applies to enemies. Ammo is consumed. Weapon switching is instant and responsive.

### Task 4.5: Projectile System
**Implement `src/game/projectile.js` for rocket and plasma bolt physics.**
- Projectile properties: position, velocity (direction * speed), damage, splashRadius (0 for plasma), owner (player or enemy), sprite, alive flag
- Per-frame update: move by velocity * dt, check collision with walls (if hit wall tile, explode/remove), check collision with enemies (radius check), check collision with player (for enemy projectiles)
- Rocket explosion: deal splash damage to all entities within splash radius, falling off with distance. Visual flash effect.
- Plasma bolt: smaller, faster, no splash, just direct hit
- Remove projectile after hit or after max lifetime (5 seconds)
- **Acceptance**: Projectiles travel in straight lines, hit walls and enemies, rockets have splash damage, plasma bolts are fast and direct.

---

## Phase 5: Enemy AI

### Task 5.1: AI State Machine
**Implement `src/ai/state-machine.js` as a reusable finite state machine.**
- States: IDLE, PATROL, ALERT, CHASE, ATTACK, PAIN, DYING, DEAD
- Each state has: enter(), update(dt), exit() hooks
- Transitions triggered by conditions: player spotted (line of sight), took damage, player in attack range, lost sight of player, health <= 0
- State machine is generic - enemy-type-specific behavior is configured via behavior objects
- **Acceptance**: State machine transitions correctly between all states. Enter/exit hooks fire. Updates run per frame.

### Task 5.2: Pathfinding
**Implement `src/ai/pathfinding.js` with simple tile-based movement.**
- No complex A* needed for retro feel. Use direct movement toward player with basic obstacle avoidance.
- Move toward player position. If blocked by a wall tile, try sliding along the wall (similar to player movement).
- If stuck for more than 1 second, try a random perpendicular direction to get unstuck.
- Enemies should not stack on top of each other - basic separation: push apart if overlapping.
- Collision detection: circle-vs-tile for walls, circle-vs-circle for other enemies
- **Acceptance**: Enemies navigate toward the player, don't get permanently stuck on walls, and don't overlap each other.

### Task 5.3: Enemy Behaviors Configuration
**Implement `src/ai/behaviors.js` with per-enemy-type behavior parameters.**
- Define behavior configs that the state machine uses:
  - **Grunt**: sight range 8 tiles, attack range 6 tiles, fire rate 0.8/sec, accuracy 0.3, patrol speed 1.0, chase speed 1.5, pain chance 0.5 (50% chance to enter pain state when hit)
  - **Soldier**: sight range 10, attack range 8, fire rate 1.5/sec, accuracy 0.5, strafes while attacking (alternates left/right every 1-2 seconds), pain chance 0.3
  - **Scout**: sight range 12, attack range 3 (close range shotgun), fire rate 0.8/sec, accuracy 0.4, chase speed 3.0 (very fast), zigzag movement pattern, pain chance 0.6
  - **Brute**: sight range 8, attack range 7, fire rate 5/sec (minigun), accuracy 0.2 (spray), chase speed 0.7 (very slow), pain chance 0.1 (rarely flinches)
  - **Commander**: custom multi-phase behavior (see Task 5.5)
- **Acceptance**: Each enemy type feels distinctly different in combat. Behaviors create varied tactical situations.

### Task 5.4: Enemy Base Implementation
**Implement `src/game/enemy.js` as the base enemy class and all regular enemy types in `src/game/enemies/`.**
- Base Enemy class: position, type, health, maxHealth, state machine instance, behavior config, sprite reference, current animation frame, damage cooldown
- Per-frame update: run state machine, update animation frame, apply movement from pathfinding
- Line of sight check: cast a ray from enemy to player, if it hits a wall before reaching the player, LOS is blocked
- Attack: when in ATTACK state and cooldown elapsed, fire at player. Apply accuracy by adding random spread to aim direction. Hitscan for most enemies.
- Pain state: brief stun (0.3s) with pain sprite frame, interrupts current action
- Death: play death animation (3 frames over 0.5s), then leave corpse sprite on ground (non-blocking)
- Sound: play alert sound when transitioning to ALERT/CHASE, pain sound in PAIN, death sound in DYING
- Implement grunt.js, soldier.js, scout.js, brute.js as thin wrappers that apply the correct behavior config and sprites
- **Acceptance**: All 4 regular enemy types patrol, detect the player, chase, attack, take damage, flinch, and die with appropriate animations and sounds.

### Task 5.5: Commander Boss
**Implement `src/game/enemies/commander.js` with multi-phase boss behavior.**
- Phase 1 (100-66% HP): Missile barrage - fires 3 rockets in a spread pattern every 3 seconds. Moves slowly, strafes.
- Phase 2 (66-33% HP): Charge attack - periodically rushes at the player at high speed (3x normal). Summons 2 Grunts every 15 seconds (spawns them at designated spawn points in the arena). Continues missile attacks but less frequently.
- Phase 3 (33-0% HP): Rage mode - all attacks fire 50% faster. Alternates between minigun spray (high fire rate, low accuracy) and missile barrage. Summons 1 Grunt every 10 seconds.
- Boss health bar displayed at top of screen
- Phase transitions: brief invulnerability (1 second), screen shake, announcement text ("THE COMMANDER IS ENRAGED!")
- Death: dramatic explosion effect, victory trigger
- **Acceptance**: Boss fight has 3 distinct phases. Each phase is challenging but fair. Player can learn patterns and improve. Feels like a real boss fight.

---

## Phase 6: Level System

### Task 6.1: Level Loader
**Implement `src/levels/level-loader.js` for parsing and initializing levels.**
- Level data format: each level module exports an object with:
  - `name`: display name
  - `briefing`: intro text shown before level starts
  - `map`: 2D array of tile IDs (0=empty, 1-8=wall types, 9=door, 10-12=locked doors by color)
  - `playerStart`: {x, y, angle}
  - `enemies`: array of {type, x, y, patrolPath?}
  - `items`: array of {type, x, y}
  - `objectives`: array of {type, x, y, description}
  - `exitTrigger`: {x, y, requiredObjectives}
  - `palette`: {ceiling, floor, fog} colors
  - `parTime`: target completion time in seconds
- Level loader: reads level data, creates entity instances, configures renderer palette
- Level completion: triggered when player reaches exit trigger AND all required objectives are met
- Stats tracking: kills, total enemies, time, secrets found
- **Acceptance**: Level data format is clean and easy to author. Loader correctly instantiates all entities from level data.

### Task 6.2: Level 1 - Infiltration
**Design and implement `src/levels/level1.js`.**
- 32x32 tile map representing a military base perimeter
- Layout: Start outside, enter through gates, navigate guard rooms and corridors, find blue keycard in a side office, reach elevator (locked blue door) at far end
- Enemy placement: 8-10 Grunts on patrol routes near key areas (gates, corridors, keycard room)
- Items: Shotgun pickup early-ish (reward for exploration), health kits near combat areas, ammo scattered
- Objectives: 1 objective - reach exit (blue keycard required)
- Intro briefing: "MISSION 1: INFILTRATION\n\nINFILTRATE THE BASE PERIMETER.\nFIND THE BLUE KEYCARD.\nREACH THE ELEVATOR."
- Hint system: After 60 seconds, if keycard not found, show "CHECK THE OFFICE IN THE EAST WING"
- Palette: olive/brown tones
- **Acceptance**: Level is playable, takes 2-3 minutes, teaches core mechanics (move, shoot, pickup, keycard, door). Not too hard.

### Task 6.3: Level 2 - Lockdown
**Design and implement `src/levels/level2.js`.**
- 40x40 tile map representing an underground research lab
- Layout: Elevator opens to a hub area with 3 branching paths (west lab, north lab, east lab), each containing a data drive. Return all 3 to the exit terminal.
- Enemy placement: 12-15 enemies (Grunts + Soldiers). Soldiers introduced here - place them in strategic positions.
- Items: Machine Gun pickup in the first lab, ammo/health throughout
- Objectives: 3 data drives to collect. Counter displayed: "DRIVES: 0/3"
- Intro briefing: "MISSION 2: LOCKDOWN\n\nTHE LAB IS IN LOCKDOWN.\nCOLLECT 3 DATA DRIVES.\nBRING THEM TO THE EXIT TERMINAL."
- Palette: white/teal/green tones
- **Acceptance**: Three-wing layout encourages exploration. Soldiers provide new challenge. Takes 3-4 minutes.

### Task 6.4: Level 3 - Rescue Op
**Design and implement `src/levels/level3.js`.**
- 40x40 tile map representing a prison block
- Layout: Linear progression through 4 cell blocks (A, B, C, D). Each block has a prisoner to free (walk to their cell). Enemies guard each block more heavily than the last.
- Enemy placement: 15-18 enemies (Grunts + Soldiers + Scouts). Scouts introduced here - they rush from dark corridors.
- Items: Rocket Launcher in a secret area (destructible wall hint), health/ammo
- Objectives: 4 prisoners to rescue. Counter: "RESCUED: 0/4". Prisoners show a "THANK YOU!" text bubble.
- Intro briefing: "MISSION 3: RESCUE OP\n\nPRISONERS ARE HELD IN 4 CELL BLOCKS.\nFIGHT THROUGH AND FREE THEM ALL.\nGET EVERYONE OUT ALIVE."
- Palette: dark grey/rust/red tones, dim lighting
- **Acceptance**: Scouts add urgency. Prison setting feels oppressive. Takes 4-5 minutes.

### Task 6.5: Level 4 - Sabotage
**Design and implement `src/levels/level4.js`.**
- 48x48 tile map representing a command center
- Layout: Large complex with 3 reactor nodes in separate areas. Each node requires holding E for 3 seconds to plant explosives (progress bar shown). Enemies spawn/rush during planting.
- Enemy placement: 20+ enemies (all regular types). Brutes introduced here - place them guarding reactor nodes.
- Items: Plasma Rifle pickup, heavy ammo, health stations (reusable heal spots)
- Objectives: 3 reactor nodes to sabotage. Counter: "REACTORS: 0/3". Progress bar during planting.
- Intro briefing: "MISSION 4: SABOTAGE\n\nPLANT EXPLOSIVES AT 3 REACTOR NODES.\nHOLD [E] TO ARM EACH CHARGE.\nEXPECT HEAVY RESISTANCE."
- Palette: dark blue/red/silver tones
- **Acceptance**: Planting mechanic creates tension. Brutes are real threats. Takes 5-6 minutes.

### Task 6.6: Level 5 - Showdown
**Design and implement `src/levels/level5.js`.**
- 48x48 tile map with two sections: a corridor gauntlet leading to a large circular boss arena
- Layout: Fight through corridors with mixed enemies, collect health/ammo, then enter the arena. Boss arena has pillars for cover, health pickups along edges, and designated grunt spawn points.
- Enemy placement: 10-12 mixed enemies in corridors. Commander boss in arena. Boss summons Grunts during fight.
- Items: All ammo types, health packs, armor. Generous pickups before boss room.
- Objectives: 1 - Defeat the Commander. Boss health bar at top of screen.
- Intro briefing: "MISSION 5: SHOWDOWN\n\nTHE COMMANDER AWAITS.\nFIGHT THROUGH THE STRONGHOLD.\nEND THIS."
- Palette: black/orange/red tones
- **Acceptance**: Boss fight is the climax. Fair but challenging. Takes 5-8 minutes. Victory feels earned.

---

## Phase 7: UI & HUD

### Task 7.1: In-Game HUD
**Implement `src/ui/hud.js` for the heads-up display.**
- Rendered on top of the game view each frame
- Elements (retro styling - blocky text, bright colors on dark backgrounds):
  - Health: red bar + number, bottom left. Flashes when low (< 25%).
  - Armor: blue bar + number, next to health
  - Ammo: current weapon ammo count, bottom right. Shows infinity symbol for pistol.
  - Current weapon name: small text above ammo
  - Crosshair: simple dot or small cross in center of screen
  - Damage flash: red overlay that fades quickly when player takes damage
  - Pickup text: brief message when picking up items (fades after 2 seconds)
  - Objective counter: top center, shows current objective progress (e.g., "DRIVES: 2/3")
- All text rendered using canvas fillText with a monospace/pixel font style
- **Acceptance**: All HUD elements are readable and don't obstruct gameplay. Retro aesthetic. Damage flash is noticeable but not annoying.

### Task 7.2: Minimap
**Implement `src/ui/minimap.js` for the toggleable minimap overlay.**
- Toggle with M key
- Rendered in the top-right corner, semi-transparent background
- Shows: wall tiles as white blocks, empty tiles as dark, player position as green arrow (shows facing direction), enemy positions as red dots (only if in line of sight), objective markers as yellow diamonds, exit as green square
- Fog of war: only show tiles the player has been near (explored radius ~5 tiles)
- Scale: show ~20x20 tiles centered on player
- **Acceptance**: Minimap is useful for navigation without spoiling the level. Toggle works. Doesn't tank performance.

### Task 7.3: Menus & Screens
**Implement `src/ui/menu.js` for all menu screens.**
- **Title Screen**: "RETRO FURY" in large retro text (blocky/pixelated), "PRESS ENTER TO START" blinking, brief controls list
- **Pause Menu** (Esc during gameplay): semi-transparent overlay, "PAUSED" text, "RESUME (Esc)", "RESTART LEVEL (R)", "QUIT TO TITLE (Q)"
- **Death Screen**: "YOU ARE DEAD" in red, "PRESS ENTER TO RETRY" blinking, show kill count and time survived
- **Victory Screen** (after level 5): "MISSION COMPLETE" in gold, total stats across all levels, "PRESS ENTER TO PLAY AGAIN"
- All menus use retro styling: scanline effect, CRT vignette, monospace text, neon-on-dark colors
- Menu navigation: keyboard only (Enter to select, Esc to back)
- **Acceptance**: All screens are visually polished with retro aesthetic. Navigation is clear. No way to get stuck.

### Task 7.4: Objective & Hint System
**Implement `src/ui/objectives.js` for objective tracking and player hints.**
- Display current objective at top of screen when Tab is held (or briefly on level start)
- Objective text comes from level data
- Hint system: if player hasn't made progress toward the objective for 60 seconds, show a context-sensitive hint (e.g., "TRY CHECKING THE EAST WING", "LOOK FOR COLORED KEYCARDS")
- Hints appear as yellow text that fades in, stays 5 seconds, fades out
- Objective completion: green flash + "OBJECTIVE COMPLETE" text + fanfare sound
- Level-specific objective rendering: boss health bar (level 5), planting progress bar (level 4), rescue counter, drive counter, keycard status
- **Acceptance**: Player always knows what to do. Hints fire at appropriate times. Objective completion feels satisfying.

### Task 7.5: Level Transitions
**Implement `src/ui/transitions.js` for between-level screens.**
- **Level Intro**: Black screen with level name, briefing text (typewriter effect - characters appear one at a time), "PRESS ENTER TO BEGIN"
- **Level Complete Stats**: "MISSION COMPLETE" header, stats: Kills (X/Y), Time (M:SS), Par Time comparison, Secrets (X/Y). Letter grade (S/A/B/C/D based on kills% + time). "PRESS ENTER TO CONTINUE"
- **Transition**: Brief fade-to-black between screens
- Stats are calculated from gameplay tracking data
- After level 5 stats, show the victory screen
- **Acceptance**: Transitions feel polished. Typewriter effect adds atmosphere. Stats provide replayability motivation.

---

## Phase 8: Main Game Loop & Integration

### Task 8.1: Game State Manager
**Implement the state management portion of `src/main.js`.**
- Game states: TITLE, LEVEL_INTRO, PLAYING, PAUSED, DEATH, LEVEL_COMPLETE, VICTORY
- State transitions: TITLE -> LEVEL_INTRO -> PLAYING -> (PAUSED/DEATH/LEVEL_COMPLETE) -> LEVEL_INTRO / TITLE / VICTORY
- Each state has update(dt) and render(ctx) methods
- Level progression: track current level index (0-4), advance on level complete, victory after level 5
- Persist weapon inventory and partial ammo between levels (restore health to 100, give bonus ammo)
- **Acceptance**: All state transitions work correctly. No way to get into an invalid state. Level progression works end to end.

### Task 8.2: Main Game Loop
**Implement the game loop and entity management in `src/main.js`.**
- requestAnimationFrame loop with delta time calculation (cap dt at 1/30 to prevent physics issues)
- Per-frame during PLAYING state:
  1. Process input
  2. Update player (movement, interactions)
  3. Update all enemies (AI, movement, attacks)
  4. Update all projectiles (movement, collision)
  5. Update all items (animation)
  6. Update all doors (animation)
  7. Check objective completion
  8. Render: raycaster -> sprites -> HUD
  9. Update audio (ambient)
- Entity management: arrays of enemies, items, projectiles, doors. Remove dead entities. Handle spawning (boss summons).
- Collision between player projectiles and enemies, enemy projectiles and player
- **Acceptance**: Game runs at 60 FPS. All systems update and render correctly. No entity leaks. Gameplay feels responsive.

### Task 8.3: Full Integration & Polish
**Wire everything together and ensure the complete game flow works.**
- Verify: Start game -> Title -> Level 1 intro -> Play Level 1 -> Complete -> Stats -> Level 2 intro -> ... -> Level 5 -> Boss fight -> Victory
- Verify: Death -> Retry -> Same level restarts correctly (fresh enemies, items, objectives)
- Verify: Pause/resume doesn't break game state
- Verify: All weapons work against all enemy types
- Verify: All objective types (keycard, collection, rescue, planting, boss) function correctly
- Verify: Audio plays for all events without errors
- Verify: Minimap shows correct information
- Verify: Hints fire at appropriate times
- Performance: maintain 60 FPS throughout all levels
- Add a brief "loading" message while textures generate on first load
- **Acceptance**: Complete game is playable from start to finish with no crashes, soft locks, or missing features. The game is FUN.

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1.1 - 1.3 | Scaffold, utilities, input |
| 2 | 2.1 - 2.4 | Raycasting engine |
| 3 | 3.1 - 3.3 | Textures, sprites, audio |
| 4 | 4.1 - 4.5 | Player, doors, items, weapons, projectiles |
| 5 | 5.1 - 5.5 | Enemy AI, all enemy types, boss |
| 6 | 6.1 - 6.6 | Level loader + 5 levels |
| 7 | 7.1 - 7.5 | HUD, minimap, menus, objectives, transitions |
| 8 | 8.1 - 8.3 | Game loop, integration, polish |

**Total: 31 tasks across 8 phases**
