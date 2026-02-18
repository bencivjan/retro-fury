// =============================================================================
// game-loop.js - Server-side game loop for RETRO FURY multiplayer
// =============================================================================
// Runs at 20 ticks per second. Each tick processes player inputs, runs physics
// (collision detection), validates hitscan shots, manages gun game progression,
// handles respawns, and broadcasts authoritative state to all clients.
// =============================================================================

// Gun game tier definitions (inlined to avoid CJS/ESM import issues with client modules).
const GUN_GAME_TIERS = [0, 1, 2, 5, 6];
const TIER_NAMES = ['PISTOL', 'SHOTGUN', 'MACHINE GUN', 'SNIPER RIFLE', 'KNIFE'];

// Arena map data (inlined from src/levels/arena.js to avoid cross-module issues).
const arena = {
    map: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,0,0,0,0,1],
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
        [1,0,0,0,0,0,1,0,0,0,0,0,2,2,0,0,0,0,2,2,0,0,0,0,0,1,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,5,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,5,1],
        [1,1,1,0,0,0,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,2,0,0,0,1,1,1],
        [1,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,2,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,0,0,1],
        [1,0,0,0,2,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,1],
        [1,0,0,2,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,2,0,1],
        [1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,1],
        [1,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,1],
        [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1],
        [1,0,2,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,2,0,1],
        [1,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,1],
        [1,0,0,2,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1],
        [1,1,1,0,0,0,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,2,0,0,0,1,1,1],
        [1,5,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,5,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,1,0,0,0,0,0,2,2,0,0,0,0,2,2,0,0,0,0,0,1,0,0,0,0,0,1],
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
        [1,0,0,0,0,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
    spawnPoints: [
        { x: 3.5, y: 2.5, angle: Math.PI / 4 },
        { x: 28.5, y: 2.5, angle: 3 * Math.PI / 4 },
        { x: 3.5, y: 29.5, angle: -Math.PI / 4 },
        { x: 28.5, y: 29.5, angle: -3 * Math.PI / 4 },
    ],
};
import { serialize, STATE, HIT, KILL, RESPAWN, VICTORY } from './protocol.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TICK_RATE = 20;
const TICK_INTERVAL = 1000 / TICK_RATE;

const MOVE_SPEED = 3.0;
const COLLISION_RADIUS = 0.25;
const PLAYER_HEALTH = 100;
const RESPAWN_TIME = 3.0;
const PLAYER_HIT_RADIUS = 0.4;
const MOUSE_SENSITIVITY = 0.003;
const MAX_HITSCAN_RANGE = 32.0;

/**
 * Server-side weapon stats per gun game tier (indexed 0-4).
 * Matches client WEAPON_DEFS indices via GUN_GAME_TIERS: [0,1,2,5,6].
 */
const TIER_WEAPON_STATS = [
    // Tier 0: Pistol
    { damage: 10, fireRate: 3, spread: 0, pellets: 1, maxRange: MAX_HITSCAN_RANGE },
    // Tier 1: Shotgun
    { damage: 8, fireRate: 1.2, spread: 0.15, pellets: 5, maxRange: MAX_HITSCAN_RANGE },
    // Tier 2: Machine Gun
    { damage: 8, fireRate: 10, spread: 0.03, pellets: 1, maxRange: MAX_HITSCAN_RANGE },
    // Tier 3: Sniper Rifle
    { damage: 100, fireRate: 0.8, spread: 0, pellets: 1, maxRange: MAX_HITSCAN_RANGE },
    // Tier 4: Knife
    { damage: 200, fireRate: 2, spread: 0, pellets: 1, maxRange: 1.2 },
];

// =============================================================================
// GameLoop Class
// =============================================================================

export class GameLoop {
    /**
     * @param {import('./room.js').Room} room - The room this game loop manages.
     */
    constructor(room) {
        this.room = room;

        /** @type {Map<number, Object>} Per-player authoritative state. */
        this.players = new Map();

        /** @type {Map<number, number>} Per-player gun game tier (0-4). */
        this.gunGameTiers = new Map();

        this.map = arena.map;
        this.mapWidth = arena.map[0].length;
        this.mapHeight = arena.map.length;
        this.spawnPoints = arena.spawnPoints;

        /** @type {ReturnType<typeof setInterval>|null} */
        this._interval = null;

        /** @type {number} Last tick timestamp in ms. */
        this._lastTick = Date.now();
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Start the game loop with the given players and spawn assignments.
     *
     * @param {number[]} playerIds
     * @param {Object<number, { x: number, y: number, angle?: number }>} spawnAssignments
     */
    start(playerIds, spawnAssignments) {
        for (const id of playerIds) {
            const spawn = spawnAssignments[id];
            this.players.set(id, {
                x: spawn.x,
                y: spawn.y,
                angle: spawn.angle || 0,
                health: PLAYER_HEALTH,
                alive: true,
                fireCooldown: 0,
                respawnTimer: 0,
            });
            this.gunGameTiers.set(id, 0);
        }

        this._lastTick = Date.now();
        this._interval = setInterval(() => this._tick(), TICK_INTERVAL);
    }

    /**
     * Stop the game loop.
     */
    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    // -------------------------------------------------------------------------
    // Main Tick
    // -------------------------------------------------------------------------

    /** @private */
    _tick() {
        const now = Date.now();
        const dt = Math.min((now - this._lastTick) / 1000, 0.1);
        this._lastTick = now;

        const inputs = this.room.pendingInputs || new Map();

        for (const [playerId, pState] of this.players) {
            // Respawn timer for dead players.
            if (!pState.alive) {
                pState.respawnTimer -= dt;
                if (pState.respawnTimer <= 0) {
                    this._respawnPlayer(playerId);
                }
                continue;
            }

            // Fire cooldown.
            if (pState.fireCooldown > 0) {
                pState.fireCooldown -= dt;
            }

            const inp = inputs.get(playerId);
            if (!inp) continue;

            // Process movement.
            this._processMovement(pState, inp, dt);

            // Process firing.
            if (inp.fire && pState.fireCooldown <= 0) {
                this._processFire(playerId, pState);
            }
        }

        // Clear consumed inputs.
        if (this.room.pendingInputs) {
            this.room.pendingInputs.clear();
        }

        // Broadcast authoritative state.
        this._broadcastState();
    }

    // -------------------------------------------------------------------------
    // Movement & Collision
    // -------------------------------------------------------------------------

    /**
     * @param {Object} pState - Player state.
     * @param {Object} inp    - Input data.
     * @param {number} dt
     * @private
     */
    _processMovement(pState, inp, dt) {
        // Apply mouse look (clamp to prevent spoofed large values).
        if (inp.mouseDX) {
            const clampedDX = Math.max(-500, Math.min(500, inp.mouseDX));
            pState.angle += clampedDX * MOUSE_SENSITIVITY;
        }

        // Build movement vector.
        const cos = Math.cos(pState.angle);
        const sin = Math.sin(pState.angle);
        const strafeX = -sin;
        const strafeY = cos;

        let moveX = 0;
        let moveY = 0;
        const keys = inp.keys || [];

        if (keys.includes('KeyW')) { moveX += cos; moveY += sin; }
        if (keys.includes('KeyS')) { moveX -= cos; moveY -= sin; }
        if (keys.includes('KeyA')) { moveX -= strafeX; moveY -= strafeY; }
        if (keys.includes('KeyD')) { moveX += strafeX; moveY += strafeY; }

        // Normalize diagonal movement.
        const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
        if (moveLen > 0) {
            const inv = 1.0 / moveLen;
            moveX = moveX * inv * MOVE_SPEED * dt;
            moveY = moveY * inv * MOVE_SPEED * dt;
        } else {
            return; // No movement.
        }

        // Collision detection with wall sliding (try each axis independently).
        const newX = pState.x + moveX;
        const newY = pState.y + moveY;

        if (!this._collidesWithMap(newX, pState.y)) {
            pState.x = newX;
        }
        if (!this._collidesWithMap(pState.x, newY)) {
            pState.y = newY;
        }

        // Clamp to map bounds.
        pState.x = Math.max(COLLISION_RADIUS, Math.min(this.mapWidth - COLLISION_RADIUS, pState.x));
        pState.y = Math.max(COLLISION_RADIUS, Math.min(this.mapHeight - COLLISION_RADIUS, pState.y));
    }

    /**
     * Circle-vs-grid collision test (same logic as client player.js).
     * @private
     */
    _collidesWithMap(cx, cy) {
        const tileX = Math.floor(cx);
        const tileY = Math.floor(cy);

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const tx = tileX + dx;
                const ty = tileY + dy;

                if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) {
                    if (this._circleAABB(cx, cy, COLLISION_RADIUS, tx, ty, tx + 1, ty + 1)) {
                        return true;
                    }
                    continue;
                }

                if (this.map[ty][tx] <= 0) continue;

                if (this._circleAABB(cx, cy, COLLISION_RADIUS, tx, ty, tx + 1, ty + 1)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** @private */
    _circleAABB(cx, cy, r, minX, minY, maxX, maxY) {
        const closestX = Math.max(minX, Math.min(maxX, cx));
        const closestY = Math.max(minY, Math.min(maxY, cy));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) < (r * r);
    }

    // -------------------------------------------------------------------------
    // Weapon Fire & Hit Detection
    // -------------------------------------------------------------------------

    /**
     * Process a fire action for the given player.
     * @private
     */
    _processFire(shooterId, shooterState) {
        const tier = this.gunGameTiers.get(shooterId) || 0;
        const stats = TIER_WEAPON_STATS[tier];

        shooterState.fireCooldown = 1.0 / stats.fireRate;

        const pellets = stats.pellets || 1;
        let hitTargetId = null;
        let totalDamage = 0;

        for (let p = 0; p < pellets; p++) {
            const spreadOffset = stats.spread > 0
                ? (Math.random() * 2 - 1) * stats.spread
                : 0;
            const angle = shooterState.angle + spreadOffset;
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);

            // Find wall distance via DDA.
            const wallDist = this._dda(shooterState.x, shooterState.y, dirX, dirY);
            const maxDist = Math.min(wallDist, stats.maxRange);

            // Check for player hits.
            for (const [targetId, targetState] of this.players) {
                if (targetId === shooterId || !targetState.alive) continue;

                const toX = targetState.x - shooterState.x;
                const toY = targetState.y - shooterState.y;
                const dot = toX * dirX + toY * dirY;

                if (dot < 0 || dot > maxDist) continue;

                const perpX = toX - dirX * dot;
                const perpY = toY - dirY * dot;
                const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

                if (perpDist < PLAYER_HIT_RADIUS) {
                    hitTargetId = targetId;
                    totalDamage += stats.damage;
                }
            }
        }

        if (hitTargetId !== null && totalDamage > 0) {
            const targetState = this.players.get(hitTargetId);
            targetState.health -= totalDamage;

            // Broadcast hit.
            this.room.broadcast({
                type: HIT,
                shooterId,
                targetId: hitTargetId,
                damage: totalDamage,
                targetHealth: Math.max(0, targetState.health),
            });

            // Check for kill.
            if (targetState.health <= 0) {
                targetState.health = 0;
                targetState.alive = false;
                targetState.respawnTimer = RESPAWN_TIME;

                // Gun game promotion.
                const currentTier = this.gunGameTiers.get(shooterId);
                const isKnifeTier = currentTier >= GUN_GAME_TIERS.length - 1;
                let newTier = currentTier;
                if (!isKnifeTier) {
                    newTier = currentTier + 1;
                    this.gunGameTiers.set(shooterId, newTier);
                }

                // Broadcast kill event.
                this.room.broadcast({
                    type: KILL,
                    killerId: shooterId,
                    victimId: hitTargetId,
                    weapon: TIER_NAMES[currentTier],
                    killerNewTier: newTier,
                });

                // Check victory (knife kill).
                if (isKnifeTier) {
                    this.room.broadcast({
                        type: VICTORY,
                        winnerId: shooterId,
                    });
                    this.stop();
                    this.room.state = 'ended';
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // DDA Raycasting (Wall Distance)
    // -------------------------------------------------------------------------

    /**
     * Find distance to first solid wall tile along a ray (DDA algorithm).
     * @private
     */
    _dda(posX, posY, rayDirX, rayDirY) {
        let mapX = Math.floor(posX);
        let mapY = Math.floor(posY);

        const absDirX = Math.abs(rayDirX);
        const absDirY = Math.abs(rayDirY);
        const deltaDistX = absDirX < 1e-12 ? 1e30 : 1.0 / absDirX;
        const deltaDistY = absDirY < 1e-12 ? 1e30 : 1.0 / absDirY;

        let stepX, sideDistX;
        let stepY, sideDistY;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (posX - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1.0 - posX) * deltaDistX;
        }

        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (posY - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1.0 - posY) * deltaDistY;
        }

        let side = 0;
        const maxSteps = Math.ceil(MAX_HITSCAN_RANGE * 2);

        for (let i = 0; i < maxSteps; i++) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }

            if (mapX < 0 || mapX >= this.mapWidth || mapY < 0 || mapY >= this.mapHeight) {
                break;
            }

            if (this.map[mapY][mapX] > 0) {
                let perpDist;
                if (side === 0) {
                    perpDist = (mapX - posX + (1 - stepX) * 0.5) / rayDirX;
                } else {
                    perpDist = (mapY - posY + (1 - stepY) * 0.5) / rayDirY;
                }
                return Math.max(perpDist, 0);
            }
        }

        return MAX_HITSCAN_RANGE;
    }

    // -------------------------------------------------------------------------
    // Respawn
    // -------------------------------------------------------------------------

    /**
     * Respawn a dead player at the spawn point furthest from other live players.
     * @private
     */
    _respawnPlayer(playerId) {
        const pState = this.players.get(playerId);

        // Pick spawn point furthest from all alive opponents.
        let bestSpawn = this.spawnPoints[0];
        let bestDist = -1;

        for (const sp of this.spawnPoints) {
            let minDistToOther = Infinity;

            for (const [otherId, otherState] of this.players) {
                if (otherId === playerId || !otherState.alive) continue;
                const dx = sp.x - otherState.x;
                const dy = sp.y - otherState.y;
                minDistToOther = Math.min(minDistToOther, Math.sqrt(dx * dx + dy * dy));
            }

            if (minDistToOther > bestDist) {
                bestDist = minDistToOther;
                bestSpawn = sp;
            }
        }

        pState.x = bestSpawn.x;
        pState.y = bestSpawn.y;
        pState.angle = bestSpawn.angle || 0;
        pState.health = PLAYER_HEALTH;
        pState.alive = true;
        pState.fireCooldown = 0;

        // Broadcast respawn event.
        this.room.broadcast({
            type: RESPAWN,
            playerId,
            x: pState.x,
            y: pState.y,
            angle: pState.angle,
        });
    }

    // -------------------------------------------------------------------------
    // State Broadcast
    // -------------------------------------------------------------------------

    /** @private */
    _broadcastState() {
        const players = [];
        for (const [id, state] of this.players) {
            players.push({
                id,
                x: state.x,
                y: state.y,
                angle: state.angle,
                health: state.health,
                alive: state.alive,
                weaponTier: this.gunGameTiers.get(id) || 0,
            });
        }

        this.room.broadcast({
            type: STATE,
            players,
        });
    }
}
