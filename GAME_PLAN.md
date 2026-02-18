# RETRO FURY - High-Level Game Plan

## Overview

A retro-style first-person shooter built with JavaScript and HTML5 Canvas, using a raycasting engine inspired by Wolfenstein 3D and DOOM. The game features 5 progressively challenging levels with unique objectives, multiple enemy types with distinct behaviors, and an arsenal of weapons.

## Technology Stack

- **Rendering**: HTML5 Canvas 2D with raycasting engine
- **Language**: Vanilla JavaScript (ES6 modules)
- **Audio**: Web Audio API for retro sound effects
- **Assets**: Procedurally generated pixel art textures (no external asset dependencies)
- **Build**: Single HTML file + JS modules, no build tooling required
- **Target**: Modern web browsers (Chrome, Firefox, Safari, Edge)

## Core Architecture

### 1. Raycasting Engine
- DDA-based raycasting algorithm for wall rendering
- Textured walls with different textures per tile type
- Floor and ceiling rendering (solid color for performance, retro feel)
- Sprite rendering with depth sorting (billboarded sprites)
- Distance-based shading/fog for depth perception
- Resolution: 320x200 viewport scaled up (authentic retro resolution)

### 2. Level System
- Tile-based maps stored as 2D arrays
- Tile types: empty, wall (multiple textures), door, locked door, objective marker, spawn point
- Each level defines: map data, enemy spawns, item placements, objective locations, exit trigger
- Level transition with stats screen (kills, time, secrets)

### 3. Entity System
- **Player**: position, angle, health, armor, ammo, inventory, current weapon
- **Enemies**: position, type, health, state machine (idle/patrol/chase/attack/pain/death), sprite animations
- **Projectiles**: position, velocity, damage, owner (for friendly fire prevention)
- **Items**: position, type (health, ammo, armor, keycard, weapon, objective item)
- **Interactables**: doors, switches, prisoners (NPCs), explosive barrels

### 4. Enemy AI System
- State machine per enemy: IDLE -> PATROL -> ALERT -> CHASE -> ATTACK -> PAIN -> DEATH
- Line-of-sight detection using raycasting
- Pathfinding: simple tile-based movement toward player (no complex pathfinding needed for retro feel)
- Per-type behavior modifiers (speed, aggression, accuracy, fire rate)
- Sound-based alerting (nearby enemies hear gunshots)

### 5. Weapon System
- Weapon switching with number keys (1-5)
- Per-weapon: damage, fire rate, ammo type, spread, range, projectile vs hitscan
- Weapon bob animation while moving
- Muzzle flash effect
- Weapon sprites rendered as HUD overlay

### 6. HUD & UI
- Health bar, armor bar, ammo counter
- Current weapon display
- Minimap (togglable, shows explored areas)
- Objective tracker with hints
- Crosshair
- Damage flash (red screen overlay when hit)
- Pickup notifications
- Level intro screen with briefing
- Pause menu
- Death screen with retry option

### 7. Audio
- Procedural retro sound effects (Web Audio API oscillators)
- Weapon fire sounds per weapon type
- Enemy alert/pain/death sounds
- Door opening, item pickup, objective completion sounds
- Ambient background drone per level
- Boss music for level 5

## Game Design

### Weapons (Progressive Unlocks)

| # | Weapon | Damage | Fire Rate | Ammo | Unlock |
|---|--------|--------|-----------|------|--------|
| 1 | Pistol | 10 | Medium | Infinite | Start |
| 2 | Shotgun | 40 (spread) | Slow | Shells | Level 1 |
| 3 | Machine Gun | 8 | Very Fast | Bullets | Level 2 |
| 4 | Rocket Launcher | 80 (splash) | Very Slow | Rockets | Level 3 |
| 5 | Plasma Rifle | 25 | Fast | Cells | Level 4 |

### Enemy Types

| Type | HP | Speed | Weapon | Behavior |
|------|-----|-------|--------|----------|
| **Grunt** | 30 | Slow | Pistol | Patrol routes, shoot on sight, basic chase. Easiest enemy. |
| **Soldier** | 50 | Medium | Rifle | Strafes while shooting, attempts to use cover, more accurate. |
| **Scout** | 25 | Fast | Shotgun | Rushes the player aggressively, flanks, erratic zigzag movement. |
| **Brute** | 150 | Very Slow | Minigun | Slow advance, suppressive fire, high damage output, bullet sponge. |
| **Commander** | 500 | Medium | Multi-attack | Boss only. Phase-based: missile barrage → charge attack → summon grunts. |

### Levels

#### Level 1: "Infiltration" - Military Base Perimeter
- **Theme**: Outdoor walls, crates, guard posts, chain-link textures
- **Palette**: Olive green, brown, grey
- **Objective**: Find the access keycard (blue) and reach the elevator
- **Enemies**: 8-10 Grunts
- **Items**: Shotgun pickup, health kits, ammo
- **Hints**: "FIND THE BLUE KEYCARD TO ACCESS THE ELEVATOR" displayed at start. Keycard location shown on minimap as blinking dot after 60 seconds.
- **Design intent**: Tutorial level. Teaches movement, shooting, pickups, doors, keycards.

#### Level 2: "Lockdown" - Underground Research Lab
- **Theme**: Sterile corridors, lab equipment, green/blue lighting, containment cells
- **Palette**: White, teal, green glow
- **Objective**: Collect 3 data drives from different lab sections
- **Enemies**: 12-15 (Grunts + Soldiers)
- **Items**: Machine Gun pickup, armor, health, ammo caches
- **Hints**: "3 DATA DRIVES DETECTED IN THE LAB - CHECK YOUR MINIMAP". Drives shown as markers. Counter: "DRIVES: 1/3"
- **Design intent**: Introduces Soldiers and multi-objective collection. Branching paths.

#### Level 3: "Rescue Op" - Prison Block
- **Theme**: Dark cells, rusty metal, dim lighting, blood stains
- **Palette**: Dark grey, rust orange, red
- **Objective**: Free 4 prisoners by reaching their cells
- **Enemies**: 15-18 (Grunts + Soldiers + Scouts)
- **Items**: Rocket Launcher pickup, health, ammo
- **Hints**: "PRISONERS DETECTED IN 4 CELL BLOCKS". Prisoner cells marked on map. Prisoners say "THANK YOU!" when freed. Counter: "RESCUED: 2/4"
- **Design intent**: Introduces Scouts. More combat-intensive. Tight corridors favor shotgun.

#### Level 4: "Sabotage" - Command Center
- **Theme**: High-tech screens, server racks, warning lights, industrial
- **Palette**: Dark blue, red warning lights, silver
- **Objective**: Plant explosives at 3 reactor nodes (interact and hold for 3 seconds)
- **Enemies**: 20+ (All regular types including Brutes)
- **Items**: Plasma Rifle pickup, heavy ammo, health
- **Hints**: "PLANT CHARGES AT 3 REACTOR NODES - HOLD [E] TO ARM". Progress bar shown when planting. Enemies rush during planting.
- **Design intent**: Introduces Brutes. Planting mechanic forces the player to defend a position. Highest regular enemy count.

#### Level 5: "Showdown" - The Stronghold
- **Theme**: Industrial fortress, lava/energy pits, massive open arena for boss
- **Palette**: Black, orange, red, metal
- **Objective**: Defeat the Commander (boss fight)
- **Enemies**: Mixed regular enemies in corridors → Commander boss in arena
- **Items**: All ammo types, health stations, armor
- **Boss Phases**:
  - Phase 1 (100-66% HP): Missile barrage - fires 3 rockets in spread, dodge-able
  - Phase 2 (66-33% HP): Charge attack - rushes player at high speed, summons 2 Grunts every 15s
  - Phase 3 (33-0% HP): Rage mode - all attacks faster, minigun spray + missiles
- **Hints**: "THE COMMANDER AWAITS IN THE CENTRAL ARENA". Phase change announcements. Health bar displayed at top of screen.
- **Design intent**: Epic finale. Tests all skills learned. Boss requires pattern recognition.

### Player Progression
- Health: 100 (max 200 with medkits)
- Armor: 0-100 (absorbs 50% damage)
- Movement: WASD + mouse look
- Interaction: E key for doors, pickups, objectives
- Weapons persist between levels
- Ammo partially restocked between levels

### Controls
- **WASD**: Move/strafe
- **Mouse**: Look left/right
- **Left Click**: Fire weapon
- **E**: Interact (doors, objectives)
- **1-5**: Switch weapons
- **M**: Toggle minimap
- **Esc**: Pause menu
- **Tab**: Show objective

## File Structure

```
fps-game/
├── index.html              # Entry point, canvas setup
├── css/
│   └── style.css           # Minimal styling, fullscreen canvas
├── src/
│   ├── main.js             # Game initialization, main loop
│   ├── engine/
│   │   ├── raycaster.js    # DDA raycasting, wall/floor rendering
│   │   ├── renderer.js     # Canvas rendering orchestrator
│   │   ├── sprite.js       # Sprite rendering, depth sorting
│   │   └── camera.js       # Player camera, view calculations
│   ├── game/
│   │   ├── player.js       # Player state, movement, interaction
│   │   ├── enemy.js        # Enemy base class, state machine
│   │   ├── enemies/
│   │   │   ├── grunt.js
│   │   │   ├── soldier.js
│   │   │   ├── scout.js
│   │   │   ├── brute.js
│   │   │   └── commander.js
│   │   ├── weapon.js       # Weapon system, firing, switching
│   │   ├── projectile.js   # Projectile physics
│   │   ├── item.js         # Pickup items
│   │   └── door.js         # Door logic (open, locked, keycards)
│   ├── levels/
│   │   ├── level-loader.js # Level parsing and initialization
│   │   ├── level1.js       # Infiltration map + config
│   │   ├── level2.js       # Lockdown map + config
│   │   ├── level3.js       # Rescue Op map + config
│   │   ├── level4.js       # Sabotage map + config
│   │   └── level5.js       # Showdown map + config
│   ├── ai/
│   │   ├── state-machine.js # Enemy AI state machine
│   │   ├── pathfinding.js   # Simple tile-based pathfinding
│   │   └── behaviors.js     # Per-enemy-type behavior configs
│   ├── ui/
│   │   ├── hud.js          # In-game HUD rendering
│   │   ├── minimap.js      # Minimap overlay
│   │   ├── menu.js         # Main menu, pause menu, death screen
│   │   ├── objectives.js   # Objective tracker and hints
│   │   └── transitions.js  # Level intro/outro, stats screen
│   ├── audio/
│   │   └── audio.js        # Web Audio API sound generation
│   └── utils/
│       ├── input.js        # Keyboard + mouse input handling
│       ├── math.js         # Vector math, angle utilities
│       └── textures.js     # Procedural texture generation
└── pipeline/
    └── dev-pipeline.dot    # Attractor pipeline definition
```

## Attractor Pipeline

The development workflow is orchestrated via an Attractor DOT pipeline:

1. **Plan** (Claude) → High-level game design (this document)
2. **Breakdown** (Claude) → Detailed implementation tasks
3. **Implement** (Codex) → Code each module
4. **QA Review** (Claude) → Review code quality, gameplay, bugs
5. **Iterate** → Fix issues found in QA

See `pipeline/dev-pipeline.dot` for the full pipeline definition.
