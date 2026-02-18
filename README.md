# Retro Fury

A retro-style first-person shooter inspired by Wolfenstein 3D and DOOM, built entirely with vanilla JavaScript and HTML5 Canvas. No frameworks, no build tools — just open `index.html` and play.

All textures and audio are procedurally generated at runtime. Zero external assets required.

## Gameplay

### Single-Player Campaign

Fight through 5 progressively harder levels, each with unique objectives:

| Level | Name | Objective | Enemy Types |
|-------|------|-----------|-------------|
| 1 | Infiltration | Find the keycard | Grunts |
| 2 | Lockdown | Collect 3 data drives | Grunts, Soldiers |
| 3 | Rescue Op | Free 4 prisoners | + Scouts |
| 4 | Sabotage | Plant 3 explosives | + Brutes |
| 5 | Showdown | Defeat the Commander | Boss fight (3 phases) |

**5 Weapons**: Pistol, Shotgun, Machine Gun, Rocket Launcher, Plasma Rifle

**5 Enemy Types**: Grunts, Soldiers, Scouts, Brutes, and a multi-phase Commander boss

### Multiplayer Gun Game (1v1)

Compete in real-time PvP arena combat over WebSocket:

- Kill your opponent to advance through weapon tiers: **Pistol → Shotgun → Machine Gun → Sniper Rifle → Knife**
- First player to score a **knife kill** wins
- Server-authoritative hit validation prevents cheating
- 2-second respawn timer, random spawn points

## Getting Started

### Single-Player (no setup required)

Open `index.html` in any modern browser. That's it.

### Multiplayer

Start the WebSocket server:

```bash
cd server
npm install
npm start
```

The server runs on `ws://localhost:3000`. Then open `index.html` in your browser, select **Multiplayer**, and either host or join a game using a 4-letter room code.

## Controls

| Key | Action |
|-----|--------|
| WASD | Move / Strafe |
| Mouse | Look / Aim |
| Left Click | Fire |
| E | Interact (doors, objectives, pickups) |
| 1-5 | Switch weapon |
| M | Toggle minimap |
| Tab | Show objective hints |
| ESC | Pause menu |

## Tech Stack

- **Client**: Vanilla JavaScript (ES6 modules), HTML5 Canvas 2D
- **Rendering**: Custom raycasting engine using the DDA (Digital Differential Analyzer) algorithm
- **Server**: Node.js + `ws` (WebSocket) — the only external dependency
- **Audio**: Procedurally generated via Web Audio API
- **Textures**: Procedurally generated pixel art (brick, concrete, metal, tech panels, sprites)

## Project Structure

```
retro-fury/
├── index.html              # Game entry point
├── css/style.css           # Minimal fullscreen canvas styling
├── src/
│   ├── main.js             # Core game loop
│   ├── engine/             # Raycasting renderer (camera, raycaster, sprites)
│   ├── game/               # Player, weapons, enemies, projectiles, doors, items
│   │   └── enemies/        # Grunt, Soldier, Scout, Brute, Commander
│   ├── levels/             # 5 campaign levels + multiplayer arena
│   ├── ai/                 # Enemy AI (state machine, pathfinding, behaviors)
│   ├── ui/                 # HUD, menus, minimap, objectives, transitions
│   ├── net/                # WebSocket client for multiplayer
│   ├── audio/              # Procedural sound generation
│   └── utils/              # Math, input handling, texture generation
├── server/
│   ├── index.js            # WebSocket server entry
│   ├── room.js             # Room management (4-letter codes)
│   ├── game-loop.js        # Server tick (20 Hz)
│   └── protocol.js         # Message types
└── pipeline/
    └── dev-pipeline.dot    # Development workflow definition
```

## How It Works

The game renders a 3D perspective from a 2D tile map using **raycasting** — the same technique used by Wolfenstein 3D (1992). One ray is cast per screen column at 320x200 internal resolution, then scaled up to fill the browser window.

Enemies and items are rendered as **billboard sprites** that always face the player, depth-sorted and clipped against walls.

The multiplayer server runs an authoritative game loop at 20 ticks/second, validating hit detection and managing game state. Clients interpolate remote player positions between server updates for smooth rendering.

## License

MIT
