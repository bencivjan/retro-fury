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
        audio.loadMusic('goldeneye_64.mp3');
    }

    // Background music: play during gameplay, stop otherwise.
    const shouldPlayMusic = (
        gameState === GameState.PLAYING ||
        gameState === GameState.PAUSED
    );
    if (shouldPlayMusic && !audio.isMusicPlaying) {
        audio.startMusic();
    } else if (!shouldPlayMusic && audio.isMusicPlaying) {
        audio.stopMusic();
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
            renderPlaying(dt);
            menuSystem.renderPause(bufferCtx);
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
    // Resume on Escape.
    if (wasKeyJustPressed('Escape')) {
        gameState = GameState.PLAYING;
        if (displayCanvas && !input.isPointerLocked()) {
            displayCanvas.requestPointerLock();
        }
        return;
    }

    // Restart on R.
    if (wasKeyJustPressed('KeyR')) {
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
