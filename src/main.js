// =============================================================================
// main.js - Main game loop and integration for RETRO FURY
// =============================================================================
// This is the central orchestration module. It wires every subsystem together
// into a playable game: engine (camera, raycaster, renderer, sprite renderer),
// game entities (player, enemies, doors, items, projectiles, weapons), levels,
// UI (HUD, minimap, menus, objectives, transitions), audio, and input.
// =============================================================================

// -- Engine -------------------------------------------------------------------
import { Camera } from './engine/camera.js';
import { Raycaster, FIELDS_PER_COLUMN, OFF_PERP_DIST, OFF_TEX_ID, OFF_TEX_X, OFF_SIDE } from './engine/raycaster.js';
import { Renderer } from './engine/renderer.js';
import { SpriteRenderer } from './engine/sprite.js';

// -- Game entities ------------------------------------------------------------
import { Player } from './game/player.js';
import { Door, DoorState } from './game/door.js';
import { Item, ItemType, ITEM_DEFS } from './game/item.js';
import { WeaponSystem, WEAPON_DEFS } from './game/weapon.js';
import { Projectile } from './game/projectile.js';

// -- Enemy factories ----------------------------------------------------------
import { createGrunt } from './game/enemies/grunt.js';
import { createSoldier } from './game/enemies/soldier.js';
import { createScout } from './game/enemies/scout.js';
import { createBrute } from './game/enemies/brute.js';
import { createCommander } from './game/enemies/commander.js';

// -- Levels -------------------------------------------------------------------
import { LevelLoader } from './levels/level-loader.js';
import level1 from './levels/level1.js';
import level2 from './levels/level2.js';
import level3 from './levels/level3.js';
import level4 from './levels/level4.js';
import level5 from './levels/level5.js';

// -- UI -----------------------------------------------------------------------
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { MenuSystem } from './ui/menu.js';
import { ObjectiveSystem } from './ui/objectives.js';
import { TransitionSystem } from './ui/transitions.js';

// -- Multiplayer --------------------------------------------------------------
import { NetworkManager } from './net/network-manager.js';
import { MultiplayerState } from './net/mp-state.js';
import { LobbyScreen } from './ui/lobby.js';
import { KillFeed } from './ui/kill-feed.js';
import { ScoreboardDisplay } from './ui/scoreboard.js';
import { GUN_GAME_TIERS, TIER_NAMES } from './game/gun-game.js';
import arena from './levels/arena.js';

// -- Utils / Assets -----------------------------------------------------------
import { TextureManager } from './utils/textures.js';
import { AudioManager } from './audio/audio.js';
import input from './utils/input.js';

// =============================================================================
// Constants
// =============================================================================

const SCREEN_WIDTH  = 320;
const SCREEN_HEIGHT = 200;

/** All five level data modules, in order. */
const LEVEL_DATA = [level1, level2, level3, level4, level5];

/** Distance at which player can interact (doors, objectives). */
const INTERACT_RANGE = 1.5;

/** Distance at which exit trigger activates. */
const EXIT_RANGE = 1.0;

/** Hold-E duration for planting charges (level 4). */
const PLANT_HOLD_TIME = 2.0;

/** Weapon fire sound names keyed by weapon index. */
const WEAPON_SOUNDS = ['pistol_fire', 'shotgun_fire', 'machinegun_fire', 'rocket_fire', 'plasma_fire', 'sniper_fire', 'knife_swing'];

// =============================================================================
// Game States
// =============================================================================

const GameState = Object.freeze({
    LOADING:        0,
    TITLE:          1,
    LEVEL_INTRO:    2,
    PLAYING:        3,
    PAUSED:         4,
    DEATH:          5,
    LEVEL_COMPLETE: 6,
    VICTORY:        7,
    // Multiplayer states
    LOBBY:          8,
    MP_PLAYING:     9,
    MP_DEATH:       10,
    MP_VICTORY:     11,
});

// =============================================================================
// Canvas Setup
// =============================================================================

const displayCanvas = document.getElementById('game-canvas');
const displayCtx    = displayCanvas.getContext('2d');

// Off-screen buffer at retro internal resolution.
const buffer    = document.createElement('canvas');
buffer.width    = SCREEN_WIDTH;
buffer.height   = SCREEN_HEIGHT;
const bufferCtx = buffer.getContext('2d');

function resize() {
    const targetAspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const windowAspect = windowW / windowH;

    let width, height;
    if (windowAspect > targetAspect) {
        height = windowH;
        width  = Math.floor(height * targetAspect);
    } else {
        width  = windowW;
        height = Math.floor(width / targetAspect);
    }

    displayCanvas.width  = SCREEN_WIDTH;
    displayCanvas.height = SCREEN_HEIGHT;
    displayCanvas.style.width  = `${width}px`;
    displayCanvas.style.height = `${height}px`;

    displayCtx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
resize();

// =============================================================================
// System Initialization
// =============================================================================

// Input manager - singleton, must be initialized before anything else.
input.init(displayCanvas);

// Texture manager generates all procedural textures.
const textureManager = new TextureManager();
const textures       = textureManager.getAllAsObject();

// Audio manager - initialized lazily on first user interaction.
const audio = new AudioManager();

// Engine subsystems.
const camera         = new Camera(0, 0, 1, 0);
const raycaster      = new Raycaster(SCREEN_WIDTH);
const renderer       = new Renderer(bufferCtx, SCREEN_WIDTH, SCREEN_HEIGHT);
const spriteRenderer = new SpriteRenderer(512);

// UI subsystems.
const hud             = new HUD(SCREEN_WIDTH, SCREEN_HEIGHT);
const minimap         = new Minimap(SCREEN_WIDTH, SCREEN_HEIGHT);
const menuSystem      = new MenuSystem(SCREEN_WIDTH, SCREEN_HEIGHT);
const objectiveSystem = new ObjectiveSystem();
const transitionSystem = new TransitionSystem(SCREEN_WIDTH, SCREEN_HEIGHT);

// Level loader.
const levelLoader = new LevelLoader();

// Weapon system.
const weaponSystem = new WeaponSystem();

// Multiplayer subsystems.
const networkManager  = new NetworkManager();
const mpState         = new MultiplayerState();
const lobbyScreen     = new LobbyScreen(SCREEN_WIDTH, SCREEN_HEIGHT);
const killFeed        = new KillFeed();
const scoreboard      = new ScoreboardDisplay();

// =============================================================================
// Game State Variables
// =============================================================================

let gameState = GameState.LOADING;

// -- Level data (populated on level load) --
let currentLevelIndex = 0;
let levelData  = null;   // Parsed level data from loader.
let map        = null;   // { grid, width, height }
let player     = null;
let doors      = [];
let enemies    = [];
let items      = [];
let projectiles = [];
let palette    = { ceiling: '#1a1a1a', floor: '#2a2a2a' };

// -- Level intro --
let introCharIndex = 0;

// -- Per-level stats --
let levelTime       = 0;
let levelKills      = 0;
let totalEnemyCount = 0;

// -- Cumulative stats --
let totalKills = 0;
let totalTime  = 0;
let totalShots = 0;
let totalHits  = 0;

// -- Persistent player state between levels --
let persistWeapons    = [true, false, false, false, false, false, false];
let persistAmmo       = { bullets: Infinity, shells: 0, rockets: 0, cells: 0 };
let persistWeaponIdx  = 0;

// -- Plant mechanic (level 4) --
let plantTimer        = 0;
let plantTargetIndex  = -1;
let isPlanting        = false;

// -- Key tracking for edge detection --
let prevKeysDown = new Set();

// -- Death stats for the death screen --
let deathStats = { kills: 0, time: 0 };

// -- Level complete stats --
let completeStats = null;

// -- Victory total stats --
let victoryStats = null;

// -- Loading state --
let loadingDone = false;

// -- Multiplayer state --
/** @type {{ grid: number[][], width: number, height: number }|null} Arena map for MP. */
let mpMap = null;
let mpPalette = arena.palette;
/** @type {number} MP death respawn timer for death screen display. */
let mpDeathTimer = 0;
/** @type {string|null} MP death message ("YOU WERE KILLED BY ...") */
let mpDeathKillerWeapon = null;

// =============================================================================
// Key Edge Detection
// =============================================================================

function wasKeyJustPressed(code) {
    return input.isKeyDown(code) && !prevKeysDown.has(code);
}

function captureKeyState() {
    prevKeysDown = new Set();
    // Copy all currently down keys.
    // We need to track a few specific codes for edge detection.
    const codes = ['Enter', 'Escape', 'KeyE', 'KeyM', 'Tab', 'KeyR', 'KeyQ',
                   'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'Backspace',
                   'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyF', 'KeyG', 'KeyH',
                   'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyN', 'KeyO', 'KeyP',
                   'KeyT', 'KeyU', 'KeyV', 'KeyX', 'KeyY', 'KeyZ'];
    for (const code of codes) {
        if (input.isKeyDown(code)) {
            prevKeysDown.add(code);
        }
    }
}

// =============================================================================
// Enemy Factory
// =============================================================================

function spawnEnemy(type, x, y) {
    switch (type) {
        case 'grunt':     return createGrunt(x, y);
        case 'soldier':   return createSoldier(x, y);
        case 'scout':     return createScout(x, y);
        case 'brute':     return createBrute(x, y);
        case 'commander': return createCommander(x, y, {
            spawnPoints: levelData ? levelData.bossSpawnPoints : [],
            onSummon: (spawns) => {
                for (const s of spawns) {
                    const grunt = createGrunt(s.x, s.y);
                    enemies.push(grunt);
                    totalEnemyCount++;
                }
            },
            onMissile: (missiles) => {
                for (const m of missiles) {
                    projectiles.push(new Projectile(m));
                }
            },
        });
        default:
            console.warn(`Unknown enemy type: ${type}`);
            return createGrunt(x, y);
    }
}

// =============================================================================
// Level Loading
// =============================================================================

function loadLevel(index) {
    currentLevelIndex = index;
    const rawData = LEVEL_DATA[index];

    levelData = levelLoader.loadLevel(rawData);

    map     = levelData.map;
    palette = levelData.palette;

    // Create player.
    const ps = levelData.playerStart;
    player = new Player(ps.x, ps.y, ps.angle);

    // Restore persistent state from previous level.
    if (index > 0) {
        player.weapons       = [...persistWeapons];
        player.ammo          = { ...persistAmmo };
        player.currentWeapon = persistWeaponIdx;
        player.health        = 100; // Restore to 100 between levels.
    }

    // Create doors.
    doors = levelData.doors;

    // Create enemies.
    enemies = [];
    for (const e of levelData.enemies) {
        enemies.push(spawnEnemy(e.type, e.x, e.y));
    }
    totalEnemyCount = enemies.length;

    // Create items.
    items = [];
    for (const it of levelData.items) {
        items.push(new Item(it.x, it.y, it.type));
    }

    // Clear projectiles.
    projectiles = [];

    // Reset weapon system.
    weaponSystem.currentWeapon = player.currentWeapon;
    weaponSystem.state         = 0;
    weaponSystem.fireTimer     = 0;
    weaponSystem.animFrame     = 0;
    weaponSystem.bobPhase      = 0;

    // Reset camera to player position.
    syncCamera();

    // Reset per-level stats.
    levelTime  = 0;
    levelKills = 0;

    // Reset plant mechanic.
    plantTimer       = 0;
    plantTargetIndex = -1;
    isPlanting       = false;

    // Set up objectives.
    const objectiveList = (levelData.objectives || []).map(obj => ({
        description: obj.description,
        label: obj.type === 'boss' ? 'BOSS' : 'OBJECTIVE',
        hint: obj.description,
    }));
    objectiveSystem.setObjectives(objectiveList);

    // Clear minimap exploration.
    minimap.clearExplored();

    // Hide boss health bar.
    hud.hideBossHealth();

    // Check if this level has a boss and set up boss health tracking.
    const bossEnemy = enemies.find(e => e.type === 'commander');
    if (bossEnemy) {
        hud.showBossHealth(bossEnemy.health, bossEnemy.maxHealth);
    }
}

function restartLevel() {
    // On death, restart fresh (no persistent state carried).
    if (currentLevelIndex === 0) {
        persistWeapons   = [true, false, false, false, false, false, false];
        persistAmmo      = { bullets: Infinity, shells: 0, rockets: 0, cells: 0 };
        persistWeaponIdx = 0;
    }
    loadLevel(currentLevelIndex);
}

function syncCamera() {
    if (!player) return;
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    camera.pos.x   = player.pos.x;
    camera.pos.y   = player.pos.y;
    camera.dir.x   = cos;
    camera.dir.y   = sin;
    camera.plane.x = -sin * 0.66;
    camera.plane.y = cos * 0.66;
}

// =============================================================================
// Objective Checking
// =============================================================================

function checkObjectives() {
    if (!levelData || !levelData.objectives) return;

    for (let i = 0; i < levelData.objectives.length; i++) {
        if (objectiveSystem.objectives[i] && objectiveSystem.objectives[i].completed) continue;

        const obj = levelData.objectives[i];
        const dx = player.pos.x - obj.x;
        const dy = player.pos.y - obj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        switch (obj.type) {
            case 'reach_exit':
                // Completed when player reaches the exit location.
                // This is handled by the exit trigger check, so auto-complete
                // the objective when the player is near.
                if (dist < INTERACT_RANGE) {
                    objectiveSystem.completeObjective(i);
                    audio.play('objective_complete');
                }
                break;

            case 'collect':
                // Completed when the player has picked up the objective item
                // near this objective's location. No player proximity check is
                // needed because the item auto-pickup already requires the
                // player to walk over the item. We just check whether the
                // corresponding objective item has been deactivated.
                {
                    const found = items.find(it =>
                        it.type === ItemType.OBJECTIVE_ITEM && !it.active &&
                        Math.abs(it.x - obj.x) < 1.5 && Math.abs(it.y - obj.y) < 1.5
                    );
                    if (found) {
                        objectiveSystem.completeObjective(i);
                        audio.play('objective_complete');
                    }
                }
                break;

            case 'rescue':
                // Completed when the player picks up the objective item at
                // the rescue location (auto-pickup on proximity) or presses E.
                {
                    const rescueItem = items.find(it =>
                        it.type === ItemType.OBJECTIVE_ITEM && !it.active &&
                        Math.abs(it.x - obj.x) < 1.5 && Math.abs(it.y - obj.y) < 1.5
                    );
                    if (rescueItem || (dist < INTERACT_RANGE && wasKeyJustPressed('KeyE'))) {
                        objectiveSystem.completeObjective(i);
                        audio.play('objective_complete');
                        hud.showPickupMessage('PRISONER RESCUED!');
                    }
                }
                break;

            case 'plant':
                // Requires holding E for PLANT_HOLD_TIME seconds at the location.
                // Deactivate objective item at location to prevent misleading pickup message.
                if (dist < INTERACT_RANGE) {
                    if (input.isKeyDown('KeyE')) {
                        if (plantTargetIndex !== i) {
                            plantTargetIndex = i;
                            plantTimer = 0;
                        }
                        plantTimer += lastDt;
                        isPlanting = true;

                        // Show progress in HUD.
                        const pct = Math.min(plantTimer / PLANT_HOLD_TIME, 1.0);
                        hud.showPickupMessage(`PLANTING... ${Math.floor(pct * 100)}%`);

                        if (plantTimer >= PLANT_HOLD_TIME) {
                            objectiveSystem.completeObjective(i);
                            audio.play('objective_complete');
                            hud.showPickupMessage('CHARGE PLANTED!');
                            plantTimer = 0;
                            plantTargetIndex = -1;
                            isPlanting = false;
                            // Deactivate the objective item at this location.
                            for (const it of items) {
                                if (it.type === ItemType.OBJECTIVE_ITEM && it.active &&
                                    Math.abs(it.x - obj.x) < 1.5 && Math.abs(it.y - obj.y) < 1.5) {
                                    it.active = false;
                                }
                            }
                        }
                    } else {
                        if (plantTargetIndex === i) {
                            plantTimer = 0;
                            plantTargetIndex = -1;
                            isPlanting = false;
                        }
                    }
                } else if (plantTargetIndex === i) {
                    plantTimer = 0;
                    plantTargetIndex = -1;
                    isPlanting = false;
                }
                break;

            case 'boss':
                // Completed when the boss (commander) is dead.
                {
                    const boss = enemies.find(e => e.type === 'commander');
                    if (boss && !boss.alive) {
                        objectiveSystem.completeObjective(i);
                        audio.play('objective_complete');
                        hud.hideBossHealth();
                    }
                }
                break;
        }
    }
}

// =============================================================================
// Door Integration for Raycasting
// =============================================================================

/**
 * Before raycasting, temporarily restore door tiles into the map grid for
 * doors that are not fully open. After raycasting, restore them to 0.
 */
function setDoorTilesForRaycasting() {
    for (const door of doors) {
        if (door.isBlocking()) {
            map.grid[door.y][door.x] = door.textureId;
        }
    }
}

function clearDoorTiles() {
    for (const door of doors) {
        map.grid[door.y][door.x] = 0;
    }
}

// =============================================================================
// Sprite List Building
// =============================================================================

function buildSpriteList() {
    const sprites = [];

    // Enemies (alive and corpses).
    for (const enemy of enemies) {
        sprites.push({
            x: enemy.pos.x,
            y: enemy.pos.y,
            textureId: enemy.spriteId,
            frameIndex: enemy.animFrame,
            scaleX: enemy.scale || 1,
            scaleY: enemy.scale || 1,
        });
    }

    // Active items.
    for (const item of items) {
        if (!item.active) continue;
        sprites.push({
            x: item.x,
            y: item.y + item.bobOffset,
            textureId: item.spriteId,
            frameIndex: 0,
            scaleX: 1,
            scaleY: 1,
        });
    }

    // Projectiles.
    for (const proj of projectiles) {
        if (!proj.alive) continue;
        sprites.push({
            x: proj.x,
            y: proj.y,
            textureId: proj.spriteId,
            frameIndex: 0,
            scaleX: 0.4,
            scaleY: 0.4,
        });
    }

    return sprites;
}

// =============================================================================
// Weapon HUD Sprite Drawing
// =============================================================================

function drawWeaponSprite(ctx) {
    if (!player || !player.alive) return;

    const def = weaponSystem.getCurrentDef();
    if (!def) return;

    const spriteId = def.spriteId;
    const tex = textures[spriteId];
    if (!tex) return;

    const frameW = tex.height; // Each frame is square (height x height).
    const frameCount = Math.floor(tex.width / frameW) || 1;
    const frameIndex = weaponSystem.getAnimFrame() % frameCount;

    // Calculate weapon bob.
    const isMoving = input.isKeyDown('KeyW') || input.isKeyDown('KeyS') ||
                     input.isKeyDown('KeyA') || input.isKeyDown('KeyD');
    const bob = weaponSystem.getBobOffset(isMoving, lastDt);

    // Draw weapon sprite using temporary canvas to sample ImageData.
    const srcX = frameIndex * frameW;
    const srcW = frameW;
    const srcH = tex.height;

    // Create a temporary canvas to put the ImageData so we can drawImage.
    if (!drawWeaponSprite._tmpCanvas) {
        drawWeaponSprite._tmpCanvas = document.createElement('canvas');
        drawWeaponSprite._tmpCtx = drawWeaponSprite._tmpCanvas.getContext('2d');
    }
    const tmpCanvas = drawWeaponSprite._tmpCanvas;
    const tmpCtx = drawWeaponSprite._tmpCtx;

    // Ensure the temp canvas is the right size.
    if (tmpCanvas.width !== tex.width || tmpCanvas.height !== tex.height) {
        tmpCanvas.width = tex.width;
        tmpCanvas.height = tex.height;
    }

    tmpCtx.putImageData(tex, 0, 0);

    // Draw centered at bottom of screen with bob offset.
    const scale = SCREEN_WIDTH / (frameW * 2.5);
    const drawW = Math.floor(srcW * scale);
    const drawH = Math.floor(srcH * scale);
    const drawX = Math.floor((SCREEN_WIDTH - drawW) / 2 + bob.x * 2);
    const drawY = Math.floor(SCREEN_HEIGHT - drawH + bob.y * 2 + 10);

    ctx.drawImage(
        tmpCanvas,
        srcX, 0, srcW, srcH,
        drawX, drawY, drawW, drawH
    );
}

// =============================================================================
// Audio Helpers
// =============================================================================

function calcPan(entityX, entityY) {
    if (!player) return 0;
    // Calculate stereo pan based on entity position relative to player facing.
    const dx = entityX - player.pos.x;
    const dy = entityY - player.pos.y;
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    // Cross product gives left/right relative to facing.
    const cross = dx * (-sin) + dy * cos;
    // Clamp to [-1, 1].
    return Math.max(-1, Math.min(1, cross * 0.5));
}

function calcVolume(entityX, entityY) {
    if (!player) return 1;
    const dx = entityX - player.pos.x;
    const dy = entityY - player.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Full volume within 3 tiles, fading to 0 at 20 tiles.
    return Math.max(0, Math.min(1, 1.0 - (dist - 3) / 17));
}

// =============================================================================
// Main Update - PLAYING State
// =============================================================================

let lastDt = 0.016;
let prevPlayerHealth = 100;

function updatePlaying(dt) {
    lastDt = dt;
    levelTime += dt;

    // 1. Update input (input.update() is called at end of frame).

    // 2. Set door tiles into the map so that collision, hitscan, and LOS
    //    checks correctly treat closed/partially-open doors as solid walls.
    setDoorTilesForRaycasting();

    // 3. Update player movement and collision.
    player.update(dt, map, input);

    // 4. Handle player interactions (E key).
    handleInteractions();

    // 5. Update weapon system.
    const fireResult = weaponSystem.update(dt, input, player, enemies, map);

    // 6. Handle weapon fire results.
    if (fireResult && fireResult.empty) {
        audio.play('empty_click');
    } else if (fireResult) {
        // Play weapon fire sound.
        const soundName = WEAPON_SOUNDS[weaponSystem.currentWeapon];
        if (soundName) audio.play(soundName);

        totalShots++;

        if (fireResult.projectile) {
            // Projectile weapon - spawn the projectile.
            projectiles.push(new Projectile(fireResult.projectile));
        } else if (fireResult.hit) {
            // Hitscan weapon hit.
            totalHits++;
            if (fireResult.enemies) {
                for (const h of fireResult.enemies) {
                    // h.killed is set by the weapon system to track whether
                    // this specific shot killed the enemy.
                    if (h.enemy && h.killed) {
                        levelKills++;
                        audio.play('enemy_death', {
                            pan: calcPan(h.enemy.pos.x, h.enemy.pos.y),
                            volume: calcVolume(h.enemy.pos.x, h.enemy.pos.y),
                        });
                    } else if (h.enemy) {
                        audio.play('enemy_pain', {
                            pan: calcPan(h.enemy.pos.x, h.enemy.pos.y),
                            volume: calcVolume(h.enemy.pos.x, h.enemy.pos.y),
                        });
                    }
                }
            }
        }
    }

    // 7. Update all enemies.
    for (let i = 0; i < enemies.length; i++) {
        enemies[i].update(dt, player, map, enemies);
    }

    // Update boss health bar if present.
    const boss = enemies.find(e => e.type === 'commander');
    if (boss) {
        if (boss.alive || boss.isDying) {
            hud.showBossHealth(boss.health, boss.maxHealth);
        } else {
            hud.hideBossHealth();
        }
    }

    // 8. Update all projectiles (door tiles are still set so projectiles collide with doors).
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        proj.update(dt, map);

        if (proj.alive) {
            if (proj.owner === 'player') {
                // Check projectile-enemy collision. The method returns
                // both whether a hit occurred and how many enemies were
                // killed (from direct + splash damage).
                const result = proj.checkHitEnemy(enemies);
                if (result.hit) {
                    audio.play('explosion', {
                        pan: calcPan(proj.x, proj.y),
                        volume: calcVolume(proj.x, proj.y),
                    });
                    levelKills += result.kills;
                }
            } else if (proj.owner === 'enemy') {
                // Check projectile-player collision.
                if (proj.checkHitPlayer(player)) {
                    audio.play('explosion', {
                        pan: calcPan(proj.x, proj.y),
                        volume: 0.8,
                    });
                }
            }
        }

        // Remove dead projectiles.
        if (!proj.alive) {
            projectiles.splice(i, 1);
        }
    }

    // 9. Clear door tiles from the map grid now that weapon fire, enemy AI,
    //    and projectile collision are done. Door updates and item pickups
    //    below do not need door tiles in the grid.
    clearDoorTiles();

    // 10. Update all doors.
    for (const door of doors) {
        door.update(dt, player.pos);
    }

    // 11. Update items (bob animation) and auto-pickup.
    for (const item of items) {
        item.update(dt);

        if (item.active) {
            const result = item.tryPickup(player);
            if (result.picked) {
                hud.showPickupMessage(result.message);

                // Play appropriate pickup sound.
                const def = ITEM_DEFS[item.type];
                if (def) {
                    if (def.weaponIndex !== undefined) {
                        audio.play('weapon_pickup');
                        // Sync weapon system with player.
                        weaponSystem.currentWeapon = player.currentWeapon;
                    } else if (def.keycardColor) {
                        audio.play('keycard_pickup');
                    } else {
                        audio.play('item_pickup');
                    }
                }
            }
        }
    }

    // 12. Sync camera to player.
    syncCamera();

    // 13. Check objective completion.
    checkObjectives();

    // 14. Check exit trigger.
    if (levelData.exitTrigger && objectiveSystem.isComplete()) {
        const exit = levelData.exitTrigger;
        const dx = player.pos.x - exit.x;
        const dy = player.pos.y - exit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Also check required objectives count.
        const reqObj = exit.requiredObjectives || 0;
        if (dist < EXIT_RANGE && objectiveSystem.completedCount >= reqObj) {
            onLevelComplete();
            return;
        }
    } else if (levelData.exitTrigger) {
        // If not all objectives complete but exit requires 0, check proximity.
        const exit = levelData.exitTrigger;
        const reqObj = exit.requiredObjectives || 0;
        if (reqObj === 0) {
            const dx = player.pos.x - exit.x;
            const dy = player.pos.y - exit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < EXIT_RANGE) {
                onLevelComplete();
                return;
            }
        }
    }

    // 15. Check player death.
    if (!player.alive) {
        deathStats = { kills: levelKills, time: levelTime };
        audio.play('player_death');
        gameState = GameState.DEATH;
        return;
    }

    // Detect player taking damage.
    if (player.health < prevPlayerHealth) {
        hud.triggerDamageFlash();
        audio.play('player_hurt');
    }
    prevPlayerHealth = player.health;

    // 16. Update HUD.
    // (HUD renders in the render phase, but we update timers.)

    // 17. Update minimap explored tiles.
    minimap.updateExplored(player.pos.x, player.pos.y);

    // 18. Update objective/hint system.
    objectiveSystem.update(dt);
    objectiveSystem.setTabHeld(input.isKeyDown('Tab'));

    // Toggle minimap with M key.
    if (wasKeyJustPressed('KeyM')) {
        minimap.toggle();
    }

    // Pause on Escape.
    if (wasKeyJustPressed('Escape')) {
        gameState = GameState.PAUSED;
        // Exit pointer lock.
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
}

// =============================================================================
// Player Interactions
// =============================================================================

function handleInteractions() {
    if (!wasKeyJustPressed('KeyE') && !isPlanting) return;

    const justPressedE = wasKeyJustPressed('KeyE');

    // Check nearby doors.
    if (justPressedE) {
        for (const door of doors) {
            const dx = player.pos.x - (door.x + 0.5);
            const dy = player.pos.y - (door.y + 0.5);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < INTERACT_RANGE) {
                const result = door.tryOpen(player);
                if (result.success) {
                    audio.play('door_open');
                    if (result.message) {
                        hud.showPickupMessage(result.message);
                    }
                } else if (result.message) {
                    hud.showPickupMessage(result.message);
                    audio.play('empty_click');
                }
            }
        }
    }
}

// =============================================================================
// Level Completion
// =============================================================================

function onLevelComplete() {
    audio.play('level_complete');

    // Save stats.
    completeStats = {
        kills: levelKills,
        totalEnemies: totalEnemyCount,
        time: levelTime,
        parTime: levelData.parTime,
        levelName: levelData.name,
        levelNumber: currentLevelIndex + 1,
    };

    // Accumulate totals.
    totalKills += levelKills;
    totalTime  += levelTime;

    // Persist player state for next level.
    persistWeapons   = [...player.weapons];
    persistAmmo      = { ...player.ammo };
    persistWeaponIdx = player.currentWeapon;

    gameState = GameState.LEVEL_COMPLETE;
}

// =============================================================================
// Render - PLAYING State
// =============================================================================

function renderPlaying(dt) {
    // 1. Clear the frame buffer.
    renderer.clear();

    // 2. Draw ceiling and floor (with vertical look offset).
    const horizonOffset = Math.round(player.pitch);
    renderer.drawCeilingAndFloor(palette, horizonOffset);

    // 3. Set door tiles for raycasting, cast rays, then clear door tiles.
    setDoorTilesForRaycasting();
    const depthBuffer = raycaster.castRays(camera, map.grid, SCREEN_WIDTH);
    renderer.drawWalls(raycaster.results, textures, SCREEN_WIDTH, SCREEN_HEIGHT, horizonOffset);
    clearDoorTiles();

    // 4. Build sprite list and render sprites.
    const sprites = buildSpriteList();
    spriteRenderer.render(
        sprites, camera, depthBuffer, bufferCtx,
        textures, SCREEN_WIDTH, SCREEN_HEIGHT,
        renderer.pixels, horizonOffset
    );

    // 5. Flush the frame buffer to the offscreen canvas.
    renderer.present();

    // 6. Draw weapon sprite (on top of the 3D view, before HUD).
    drawWeaponSprite(bufferCtx);

    // 7. HUD.
    const objState = objectiveSystem.getDisplayState();
    hud.render(bufferCtx, player, weaponSystem, objState, dt);

    // 8. Minimap.
    const objPositions = (levelData.objectives || []).filter((_, i) => {
        return !objectiveSystem.objectives[i] || !objectiveSystem.objectives[i].completed;
    });
    minimap.render(
        bufferCtx, map, player, enemies, objPositions,
        levelData.exitTrigger, minimap.getExploredTiles()
    );

    // 9. Objective hints.
    objectiveSystem.render(bufferCtx, SCREEN_WIDTH);
    objectiveSystem.renderHint(bufferCtx, SCREEN_WIDTH);

    // Show planting progress bar.
    if (isPlanting) {
        const pct = Math.min(plantTimer / PLANT_HOLD_TIME, 1.0);
        const barW = 50;
        const barH = 4;
        const barX = (SCREEN_WIDTH - barW) / 2;
        const barY = SCREEN_HEIGHT / 2 + 12;
        bufferCtx.fillStyle = 'rgba(0,0,0,0.6)';
        bufferCtx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
        bufferCtx.fillStyle = '#FFCC00';
        bufferCtx.fillRect(barX, barY, Math.floor(barW * pct), barH);
        bufferCtx.strokeStyle = '#FFCC00';
        bufferCtx.lineWidth = 1;
        bufferCtx.strokeRect(barX, barY, barW, barH);
    }
}

// =============================================================================
// Multiplayer: Network Message Handler
// =============================================================================

function setupNetworkHandlers() {
    networkManager.onMessage((msg) => {
        switch (msg.type) {
            case 'room_created':
                lobbyScreen.setRoomCode(msg.roomCode);
                if (msg.playerId !== undefined && msg.playerId !== null) {
                    mpState.localPlayerId = msg.playerId;
                }
                break;

            case 'player_joined':
                // Joiner receives their own playerId in this message.
                // Host already learns theirs from room_created.
                if (
                    mpState.localPlayerId === null &&
                    lobbyScreen.roomCode === '' &&
                    msg.playerId !== undefined &&
                    msg.playerId !== null
                ) {
                    mpState.localPlayerId = msg.playerId;
                }
                lobbyScreen.opponentJoined();
                break;

            case 'player_ready':
                if (
                    mpState.localPlayerId !== null &&
                    msg.playerId !== mpState.localPlayerId
                ) {
                    lobbyScreen.opponentReady();
                }
                break;

            case 'game_start':
                onMultiplayerGameStart(msg);
                break;

            case 'state':
                mpState.applyServerState(msg);
                // Reconcile local player with server state using interpolation
                // to avoid jarring snaps while still staying authoritative.
                if (msg.players && player) {
                    for (const p of msg.players) {
                        if (p.id === mpState.localPlayerId) {
                            // Lerp toward server position for smooth correction.
                            const dx = p.x - player.pos.x;
                            const dy = p.y - player.pos.y;
                            const distSq = dx * dx + dy * dy;
                            // If too far off (>2 tiles), snap immediately.
                            if (distSq > 4) {
                                player.pos.x = p.x;
                                player.pos.y = p.y;
                                player.angle = p.angle;
                            } else {
                                // Blend toward server position.
                                const blend = 0.3;
                                player.pos.x += dx * blend;
                                player.pos.y += dy * blend;
                                player.angle = p.angle;
                            }
                            player.health = p.health;
                            player.alive = p.alive;
                        }
                    }
                }
                break;

            case 'hit':
                if (msg.shooterId === mpState.localPlayerId) {
                    mpState.triggerHitConfirm();
                }
                if (msg.shooterId === mpState.remotePlayerId) {
                    mpState.remotePlayer.triggerFire();
                }
                if (msg.targetId === mpState.localPlayerId && player) {
                    player.health = msg.targetHealth;
                    hud.triggerDamageFlash();
                    audio.play('player_hurt');
                }
                break;

            case 'kill': {
                const prevLocalTier = mpState.localTier;
                const killResult = mpState.handleKill(msg);
                killFeed.addKill(
                    msg.killerId === mpState.localPlayerId ? 'YOU' : 'OPP',
                    msg.victimId === mpState.localPlayerId ? 'YOU' : 'OPP',
                    msg.weapon
                );

                if (killResult.isLocalKill) {
                    audio.play('enemy_death');
                    // Weapon promotion.
                    const newTier = msg.killerNewTier;
                    if (newTier !== undefined && newTier > prevLocalTier) {
                        const weaponIdx = GUN_GAME_TIERS[newTier];
                        player.weapons = Array(7).fill(false);
                        player.weapons[weaponIdx] = true;
                        player.currentWeapon = weaponIdx;
                        weaponSystem.currentWeapon = weaponIdx;
                        mpState.triggerPromotion(TIER_NAMES[newTier]);
                    }
                }

                if (killResult.isLocalDeath) {
                    audio.play('player_death');
                    mpDeathKillerWeapon = msg.weapon;
                    mpDeathTimer = 3.0;
                    gameState = GameState.MP_DEATH;
                }
                break;
            }

            case 'respawn':
                if (msg.playerId === mpState.localPlayerId) {
                    // Local player respawned.
                    player.pos.x = msg.x;
                    player.pos.y = msg.y;
                    player.angle = msg.angle || 0;
                    player.health = 100;
                    player.alive = true;
                    syncCamera();
                    gameState = GameState.MP_PLAYING;
                } else {
                    // Remote player respawned - snap to position.
                    mpState.remotePlayer.snapTo(msg.x, msg.y);
                }
                break;

            case 'victory':
                mpState.setWinner(msg.winnerId);
                gameState = GameState.MP_VICTORY;
                break;

            case 'opponent_disconnected':
                // Return to title with a message.
                networkManager.disconnect();
                mpState.reset();
                mpMap = null;
                gameState = GameState.TITLE;
                break;

            case 'error':
                lobbyScreen.showError(msg.message || 'Unknown error');
                break;
        }
    });

    networkManager.onDisconnect(() => {
        if (gameState === GameState.MP_PLAYING || gameState === GameState.MP_DEATH) {
            mpState.reset();
            mpMap = null;
            gameState = GameState.TITLE;
        }
    });
}

// =============================================================================
// Multiplayer: Game Start
// =============================================================================

function onMultiplayerGameStart(msg) {
    const localId = msg.yourId;
    const playerIds = msg.players;
    const remoteId = playerIds.find(id => id !== localId);

    mpState.initMatch(localId, remoteId);

    // Set up the arena map (deep copy to prevent mutation of module data).
    mpMap = {
        grid: arena.map.map(row => [...row]),
        width: arena.map[0].length,
        height: arena.map.length,
    };
    map = mpMap;
    palette = arena.palette;

    // Create local player at assigned spawn.
    const spawn = msg.spawnPoints[localId];
    player = new Player(spawn.x, spawn.y, spawn.angle || 0);

    // In gun game, start with pistol only and infinite ammo.
    player.weapons = Array(7).fill(false);
    player.weapons[0] = true;
    player.currentWeapon = 0;
    player.ammo = { bullets: Infinity, shells: Infinity, rockets: Infinity, cells: Infinity };

    weaponSystem.currentWeapon = 0;
    weaponSystem.state = 0;
    weaponSystem.fireTimer = 0;
    weaponSystem.animFrame = 0;
    weaponSystem.bobPhase = 0;

    // Snap remote player to their spawn.
    const remoteSpawn = msg.spawnPoints[remoteId];
    mpState.remotePlayer.snapTo(remoteSpawn.x, remoteSpawn.y);

    // Initialize UI.
    scoreboard.setTiers(0, 0);
    killFeed.clear();

    // Reset enemies/items/doors/projectiles (none in arena).
    enemies = [];
    items = [];
    doors = [];
    projectiles = [];

    // Sync camera.
    syncCamera();
    prevPlayerHealth = player.health;

    gameState = GameState.MP_PLAYING;
}

// =============================================================================
// Multiplayer: Update - MP_PLAYING State
// =============================================================================

function updateMultiplayer(dt) {
    lastDt = dt;

    // Send input to server.
    const keys = [];
    if (input.isKeyDown('KeyW')) keys.push('KeyW');
    if (input.isKeyDown('KeyS')) keys.push('KeyS');
    if (input.isKeyDown('KeyA')) keys.push('KeyA');
    if (input.isKeyDown('KeyD')) keys.push('KeyD');

    networkManager.send({
        type: 'input',
        keys,
        mouseDX: input.getMouseDeltaX(),
        mouseDY: input.getMouseDeltaY(),
        fire: input.isMouseDown(),
        dt,
    });

    // Client-side prediction: apply local movement immediately for responsive feel.
    // The server will reconcile position, but local movement gives 60fps feedback.
    if (player && player.alive && mpMap) {
        player.update(dt, mpMap, input);
    }

    // Update weapon system animation (fire animation, bob) for visual feedback.
    // Hit detection is server-side, so we pass empty enemies to skip local damage.
    const mpFireResult = weaponSystem.update(dt, input, player, [], mpMap || { grid: [], width: 0, height: 0 });
    if (mpFireResult) {
        // Play weapon fire sound locally.
        const mpSoundMap = { 0: 'pistol_fire', 1: 'shotgun_fire', 2: 'machinegun_fire', 5: 'sniper_fire', 6: 'knife_swing' };
        const soundName = mpSoundMap[weaponSystem.currentWeapon];
        if (soundName) audio.play(soundName);
    }

    // Update multiplayer state (timers, remote player interpolation).
    mpState.update(dt);
    killFeed.update(dt);
    scoreboard.setTiers(mpState.localTier, mpState.remoteTier);

    // Sync camera to player position (locally predicted).
    if (player && player.alive) {
        syncCamera();
    }

    // Detect player taking damage.
    if (player && player.health < prevPlayerHealth) {
        hud.triggerDamageFlash();
    }
    if (player) prevPlayerHealth = player.health;

    // Pause on Escape.
    if (wasKeyJustPressed('Escape')) {
        gameState = GameState.PAUSED;
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
}

// =============================================================================
// Multiplayer: Render - MP_PLAYING State
// =============================================================================

function renderMultiplayer(dt) {
    if (!player || !mpMap) return;

    // 1. Clear.
    renderer.clear();

    // 2. Ceiling and floor.
    const horizonOffset = Math.round(player.pitch);
    renderer.drawCeilingAndFloor(mpPalette, horizonOffset);

    // 3. Raycast and draw walls.
    const depthBuffer = raycaster.castRays(camera, mpMap.grid, SCREEN_WIDTH);
    renderer.drawWalls(raycaster.results, textures, SCREEN_WIDTH, SCREEN_HEIGHT, horizonOffset);

    // 4. Build sprite list (remote player only in MP).
    const sprites = [];
    const remoteSprite = mpState.remotePlayer.toWorldSprite();
    if (remoteSprite) {
        sprites.push(remoteSprite);
    }

    spriteRenderer.render(
        sprites, camera, depthBuffer, bufferCtx,
        textures, SCREEN_WIDTH, SCREEN_HEIGHT,
        renderer.pixels, horizonOffset
    );

    // 5. Present.
    renderer.present();

    // 6. Weapon sprite.
    drawWeaponSprite(bufferCtx);

    // 7. HUD (health, weapon info).
    const objState = { objectives: [], tabHeld: false };
    hud.render(bufferCtx, player, weaponSystem, objState, dt);

    // 8. Kill feed.
    killFeed.render(bufferCtx);

    // 9. Scoreboard.
    scoreboard.render(bufferCtx, SCREEN_WIDTH);

    // 10. Tab overlay for detailed scoreboard.
    if (input.isKeyDown('Tab')) {
        scoreboard.renderOverlay(bufferCtx, SCREEN_WIDTH, SCREEN_HEIGHT);
    }

    // 11. Hit confirm flash.
    if (mpState.hitConfirmTimer > 0) {
        bufferCtx.save();
        bufferCtx.globalAlpha = Math.min(mpState.hitConfirmTimer / 0.15, 1.0) * 0.3;
        bufferCtx.fillStyle = '#FFFFFF';
        bufferCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        bufferCtx.restore();
    }

    // 12. Promotion flash.
    if (mpState.promotionTimer > 0 && mpState.promotionWeaponName) {
        bufferCtx.save();
        const alpha = Math.min(mpState.promotionTimer / 2.0, 1.0);
        bufferCtx.globalAlpha = alpha;
        bufferCtx.font = 'bold 12px "Courier New", Courier, monospace';
        bufferCtx.fillStyle = '#FFCC00';
        bufferCtx.textAlign = 'center';
        bufferCtx.textBaseline = 'middle';
        bufferCtx.fillText(`PROMOTED: ${mpState.promotionWeaponName}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);
        bufferCtx.restore();
    }

    // Prompt users to click so the browser can grant pointer lock.
    if (!input.isPointerLocked()) {
        bufferCtx.save();
        bufferCtx.font = 'bold 14px "Courier New"';
        bufferCtx.fillStyle = '#FFCC00';
        bufferCtx.textAlign = 'center';
        bufferCtx.textBaseline = 'middle';
        bufferCtx.fillText('CLICK TO PLAY', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        bufferCtx.restore();
    }
}

// =============================================================================
// Multiplayer: Lobby Update
// =============================================================================

function updateLobby(dt) {
    lobbyScreen.update(dt);
    lobbyScreen.render(bufferCtx);

    // Handle lobby key input.
    const lobbyCodes = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Backspace',
                        'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH',
                        'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyO', 'KeyP',
                        'KeyQ', 'KeyR', 'KeyT', 'KeyU', 'KeyV', 'KeyX', 'KeyY', 'KeyZ'];

    for (const code of lobbyCodes) {
        if (wasKeyJustPressed(code)) {
            const result = lobbyScreen.handleKey(code);
            if (result) {
                handleLobbyAction(result);
            }
        }
    }
}

async function handleLobbyAction(result) {
    switch (result.action) {
        case 'host':
            try {
                await networkManager.connect();
                setupNetworkHandlers();
                networkManager.send({ type: 'create_room' });
            } catch {
                lobbyScreen.showError('FAILED TO CONNECT TO SERVER');
                lobbyScreen.state = 0; // Back to CHOOSE.
            }
            break;

        case 'join':
            try {
                if (!networkManager.isConnected()) {
                    await networkManager.connect();
                    setupNetworkHandlers();
                }
                networkManager.send({ type: 'join_room', roomCode: result.data });
            } catch {
                lobbyScreen.showError('FAILED TO CONNECT TO SERVER');
                lobbyScreen.state = 0; // Back to CHOOSE.
            }
            break;

        case 'ready':
            networkManager.send({ type: 'ready' });
            break;

        case 'back':
            networkManager.disconnect();
            gameState = GameState.TITLE;
            break;
    }
}

// =============================================================================
// Multiplayer: MP_DEATH Update
// =============================================================================

function updateMpDeath(dt) {
    mpDeathTimer -= dt;

    // Keep rendering the game world behind the death overlay.
    renderMultiplayer(dt);

    // Death overlay.
    bufferCtx.save();
    bufferCtx.fillStyle = 'rgba(100, 0, 0, 0.5)';
    bufferCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    bufferCtx.font = 'bold 16px "Courier New", Courier, monospace';
    bufferCtx.fillStyle = '#FF0000';
    bufferCtx.textAlign = 'center';
    bufferCtx.textBaseline = 'middle';
    bufferCtx.fillText('KILLED!', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 10);

    if (mpDeathKillerWeapon) {
        bufferCtx.font = 'bold 8px "Courier New", Courier, monospace';
        bufferCtx.fillStyle = '#FF6666';
        bufferCtx.fillText(`WEAPON: ${mpDeathKillerWeapon}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);
    }

    const respawnSec = Math.max(0, Math.ceil(mpDeathTimer));
    bufferCtx.font = 'bold 8px "Courier New", Courier, monospace';
    bufferCtx.fillStyle = '#AAAAAA';
    bufferCtx.fillText(`RESPAWNING IN ${respawnSec}...`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 30);

    bufferCtx.restore();

    // Continue processing network messages (state/respawn) via the handler.
    mpState.update(dt);
    killFeed.update(dt);
}

// =============================================================================
// Multiplayer: MP_VICTORY Update
// =============================================================================

function updateMpVictory(dt) {
    bufferCtx.save();

    bufferCtx.fillStyle = '#000000';
    bufferCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2;
    const won = mpState.didLocalWin();

    if (won) {
        // Victory glow.
        const glow = bufferCtx.createRadialGradient(cx, cy - 20, 20, cx, cy - 20, SCREEN_WIDTH * 0.5);
        glow.addColorStop(0, 'rgba(255, 200, 0, 0.1)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        bufferCtx.fillStyle = glow;
        bufferCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        bufferCtx.font = 'bold 22px "Courier New", Courier, monospace';
        bufferCtx.textAlign = 'center';
        bufferCtx.textBaseline = 'middle';
        bufferCtx.fillStyle = '#332200';
        bufferCtx.fillText('VICTORY!', cx + 2, cy - 20 + 2);
        bufferCtx.fillStyle = '#FFD700';
        bufferCtx.fillText('VICTORY!', cx, cy - 20);

        bufferCtx.font = 'bold 8px "Courier New", Courier, monospace';
        bufferCtx.fillStyle = '#CCAA44';
        bufferCtx.textBaseline = 'top';
        bufferCtx.fillText('YOU COMPLETED THE GUN GAME!', cx, cy + 10);
    } else {
        bufferCtx.font = 'bold 22px "Courier New", Courier, monospace';
        bufferCtx.textAlign = 'center';
        bufferCtx.textBaseline = 'middle';
        bufferCtx.fillStyle = '#330000';
        bufferCtx.fillText('DEFEAT', cx + 2, cy - 20 + 2);
        bufferCtx.fillStyle = '#FF4444';
        bufferCtx.fillText('DEFEAT', cx, cy - 20);

        bufferCtx.font = 'bold 8px "Courier New", Courier, monospace';
        bufferCtx.fillStyle = '#CC4444';
        bufferCtx.textBaseline = 'top';
        bufferCtx.fillText('YOUR OPPONENT COMPLETED THE GUN GAME', cx, cy + 10);
    }

    // Blinking prompt.
    if (menuSystem.isBlinkOn()) {
        bufferCtx.font = 'bold 10px "Courier New", Courier, monospace';
        bufferCtx.fillStyle = won ? '#FFD700' : '#FF4444';
        bufferCtx.textAlign = 'center';
        bufferCtx.textBaseline = 'top';
        bufferCtx.fillText('PRESS ENTER TO RETURN', cx, cy + 40);
    }

    bufferCtx.restore();

    if (wasKeyJustPressed('Enter')) {
        networkManager.disconnect();
        mpState.reset();
        mpMap = null;
        gameState = GameState.TITLE;
    }
}

// =============================================================================
// Main Game Loop
// =============================================================================

let lastTimestamp = 0;

function gameLoop(timestamp) {
    // Calculate delta time in seconds, capped at 1/30 to prevent physics glitches.
    let dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    if (dt > 1 / 30) dt = 1 / 30;
    if (dt <= 0) dt = 0.016;

    // Ensure audio is initialized on first user interaction.
    if (!audio.initialized && (input.isKeyDown('Enter') || input.isMouseDown() || input.isPointerLocked())) {
        audio.init();
    }

    // Update UI systems that run always.
    menuSystem.update(dt);
    transitionSystem.update(dt);

    // Clear the display context.
    bufferCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // State machine.
    switch (gameState) {
        case GameState.LOADING:
            updateLoading(dt);
            break;
        case GameState.TITLE:
            updateTitle(dt);
            break;
        case GameState.LEVEL_INTRO:
            updateLevelIntro(dt);
            break;
        case GameState.PLAYING:
            updatePlaying(dt);
            renderPlaying(dt);
            break;
        case GameState.PAUSED:
            if (mpMap) {
                renderMultiplayer(dt);
            } else {
                renderPlaying(dt);
            }
            menuSystem.renderPause(bufferCtx, { isMultiplayer: mpMap !== null });
            updatePaused();
            break;
        case GameState.DEATH:
            updateDeath(dt);
            break;
        case GameState.LEVEL_COMPLETE:
            updateLevelComplete(dt);
            break;
        case GameState.VICTORY:
            updateVictory(dt);
            break;
        case GameState.LOBBY:
            updateLobby(dt);
            break;
        case GameState.MP_PLAYING:
            updateMultiplayer(dt);
            renderMultiplayer(dt);
            break;
        case GameState.MP_DEATH:
            updateMpDeath(dt);
            break;
        case GameState.MP_VICTORY:
            updateMpVictory(dt);
            break;
    }

    // Blit the off-screen buffer onto the display canvas.
    displayCtx.drawImage(buffer, 0, 0);

    // Post-frame: capture key state for edge detection, then reset input deltas.
    captureKeyState();
    input.update();

    requestAnimationFrame(gameLoop);
}

// =============================================================================
// State Update Functions
// =============================================================================

function updateLoading(dt) {
    bufferCtx.fillStyle = '#000000';
    bufferCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    bufferCtx.font = 'bold 12px "Courier New", Courier, monospace';
    bufferCtx.fillStyle = '#FF6622';
    bufferCtx.textAlign = 'center';
    bufferCtx.textBaseline = 'middle';
    bufferCtx.fillText('LOADING...', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

    // Textures are generated synchronously in the constructor, so we can
    // transition immediately on the next frame.
    if (!loadingDone) {
        loadingDone = true;
    } else {
        gameState = GameState.TITLE;
    }
}

function updateTitle(dt) {
    menuSystem.renderTitle(bufferCtx);

    // Handle mode selection keys (W/S to navigate, Enter to confirm).
    const keyCodes = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'Enter'];
    for (const code of keyCodes) {
        if (wasKeyJustPressed(code)) {
            const result = menuSystem.handleTitleKey(code);
            if (result === 'singleplayer') {
                // Start single player from level 1.
                currentLevelIndex = 0;
                totalKills = 0;
                totalTime  = 0;
                totalShots = 0;
                totalHits  = 0;
                persistWeapons   = [true, false, false, false, false, false, false];
                persistAmmo      = { bullets: Infinity, shells: 0, rockets: 0, cells: 0 };
                persistWeaponIdx = 0;

                loadLevel(0);

                introCharIndex = 0;
                transitionSystem.resetElapsed();
                gameState = GameState.LEVEL_INTRO;
            } else if (result === 'multiplayer') {
                // Enter multiplayer lobby.
                lobbyScreen.reset();
                gameState = GameState.LOBBY;
            }
        }
    }
}

function updateLevelIntro(dt) {
    // Advance typewriter effect.
    const speed = TransitionSystem.getTypewriterSpeed();
    introCharIndex += speed * dt;

    const briefingLen = levelData ? levelData.briefing.length : 0;

    transitionSystem.renderLevelIntro(bufferCtx, {
        name: levelData ? levelData.name : 'UNKNOWN',
        briefing: levelData ? levelData.briefing : '',
        levelNumber: currentLevelIndex + 1,
    }, introCharIndex);

    // Press Enter to skip typewriter or begin (after text is fully revealed).
    if (wasKeyJustPressed('Enter') && introCharIndex < briefingLen) {
        introCharIndex = briefingLen; // Skip to full text.
    } else if (introCharIndex >= briefingLen && wasKeyJustPressed('Enter')) {
        prevPlayerHealth = player ? player.health : 100;
        gameState = GameState.PLAYING;

        // Request pointer lock for gameplay.
        if (displayCanvas && !input.isPointerLocked()) {
            displayCanvas.requestPointerLock();
        }
    }
}

function updatePaused() {
    const isMP = mpMap !== null;

    // Resume on Escape.
    if (wasKeyJustPressed('Escape')) {
        gameState = isMP ? GameState.MP_PLAYING : GameState.PLAYING;
        if (displayCanvas && !input.isPointerLocked()) {
            displayCanvas.requestPointerLock();
        }
        return;
    }

    // Restart on R (single player only).
    if (!isMP && wasKeyJustPressed('KeyR')) {
        restartLevel();
        prevPlayerHealth = player ? player.health : 100;
        gameState = GameState.PLAYING;
        if (displayCanvas && !input.isPointerLocked()) {
            displayCanvas.requestPointerLock();
        }
        return;
    }

    // Quit to title on Q.
    if (wasKeyJustPressed('KeyQ')) {
        if (isMP) {
            networkManager.disconnect();
            mpState.reset();
            mpMap = null;
        }
        gameState = GameState.TITLE;
        return;
    }
}

function updateDeath(dt) {
    menuSystem.renderDeath(bufferCtx, deathStats);

    if (wasKeyJustPressed('Enter') || wasKeyJustPressed('KeyR')) {
        restartLevel();
        prevPlayerHealth = player ? player.health : 100;
        gameState = GameState.PLAYING;
        if (displayCanvas && !input.isPointerLocked()) {
            displayCanvas.requestPointerLock();
        }
    }
}

function updateLevelComplete(dt) {
    transitionSystem.renderLevelComplete(bufferCtx, completeStats);

    if (wasKeyJustPressed('Enter')) {
        if (currentLevelIndex >= LEVEL_DATA.length - 1) {
            // All levels completed - victory!
            victoryStats = {
                totalKills,
                totalTime,
                accuracy: totalShots > 0 ? (totalHits / totalShots) * 100 : 0,
            };
            gameState = GameState.VICTORY;
        } else {
            // Advance to next level.
            loadLevel(currentLevelIndex + 1);
            introCharIndex = 0;
            transitionSystem.resetElapsed();
            gameState = GameState.LEVEL_INTRO;
        }
    }
}

function updateVictory(dt) {
    menuSystem.renderVictory(bufferCtx, victoryStats);

    if (wasKeyJustPressed('Enter')) {
        gameState = GameState.TITLE;
    }
}

// =============================================================================
// Start the Game
// =============================================================================

requestAnimationFrame(gameLoop);
