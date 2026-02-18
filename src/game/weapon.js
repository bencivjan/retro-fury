// =============================================================================
// weapon.js - Weapon system for RETRO FURY
// =============================================================================
// Manages weapon firing, switching, animation, and hit detection. Supports
// both hitscan weapons (pistol, shotgun, machine gun) and projectile weapons
// (rocket launcher, plasma rifle). Hitscan weapons resolve hits immediately
// via raycasting; projectile weapons spawn Projectile entities.
// =============================================================================

import { clamp, randomRange, normalizeAngle } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Weapon State Enum
// -----------------------------------------------------------------------------

/** @enum {number} */
export const WeaponState = Object.freeze({
    IDLE:     0,
    FIRING:   1,
    COOLDOWN: 2,
});

// -----------------------------------------------------------------------------
// Weapon Definitions
// -----------------------------------------------------------------------------
// Index 0-6 matching the player's weapons[] array.

/**
 * @typedef {Object} WeaponDef
 * @property {string} name
 * @property {number} damage        - Per-hit damage (per-pellet for shotgun).
 * @property {number} fireRate      - Shots per second.
 * @property {string} ammoType      - Key into player.ammo.
 * @property {number} ammoPerShot   - Ammo consumed per shot (0 = infinite).
 * @property {number} [spread]      - Spread angle in radians per pellet.
 * @property {number} [pellets]     - Number of pellets per shot (shotgun).
 * @property {boolean} isProjectile - Whether this weapon spawns a projectile.
 * @property {number} [projSpeed]   - Projectile speed (tiles/sec).
 * @property {number} [splashDamage]
 * @property {number} [splashRadius]
 * @property {number} spriteId      - Base sprite ID for the weapon view model.
 * @property {number} [maxRange]    - Maximum hit range (tiles). Hitscan only.
 */

/** @type {WeaponDef[]} */
export const WEAPON_DEFS = [
    // 0: Pistol
    {
        name:        'Pistol',
        damage:      10,
        fireRate:    3,
        ammoType:    'bullets',
        ammoPerShot: 0,       // Infinite ammo.
        spread:      0,
        isProjectile: false,
        spriteId:    300,
    },
    // 1: Shotgun
    {
        name:        'Shotgun',
        damage:      8,
        fireRate:    1.2,
        ammoType:    'shells',
        ammoPerShot: 1,
        spread:      0.15,
        pellets:     5,
        isProjectile: false,
        spriteId:    301,
    },
    // 2: Machine Gun
    {
        name:        'Machine Gun',
        damage:      8,
        fireRate:    10,
        ammoType:    'bullets',
        ammoPerShot: 1,
        spread:      0.03,
        isProjectile: false,
        spriteId:    302,
    },
    // 3: Rocket Launcher
    {
        name:        'Rocket Launcher',
        damage:      80,
        fireRate:    1,
        ammoType:    'rockets',
        ammoPerShot: 1,
        spread:      0,
        isProjectile: true,
        projSpeed:   8,
        splashDamage: 40,
        splashRadius: 2.0,
        spriteId:    303,
    },
    // 4: Plasma Rifle
    {
        name:        'Plasma Rifle',
        damage:      25,
        fireRate:    6,
        ammoType:    'cells',
        ammoPerShot: 1,
        spread:      0,
        isProjectile: true,
        projSpeed:   12,
        spriteId:    304,
    },
    // 5: Sniper Rifle
    {
        name:        'Sniper Rifle',
        damage:      100,
        fireRate:    0.8,
        ammoType:    'sniper',
        ammoPerShot: 0,       // Infinite ammo.
        spread:      0,
        isProjectile: false,
        spriteId:    305,
    },
    // 6: Knife
    {
        name:        'Knife',
        damage:      200,
        fireRate:    2,
        ammoType:    'none',
        ammoPerShot: 0,       // Infinite ammo.
        spread:      0,
        isProjectile: false,
        spriteId:    306,
        maxRange:    1.2,
    },
];

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Duration of the fire animation in seconds. */
const FIRE_ANIM_DURATION = 0.12;

/** Number of animation frames in a fire cycle (idle, fire1, fire2). */
const FIRE_ANIM_FRAMES = 3;

/** Weapon bob amplitude while moving (pixels of offset). */
const BOB_AMPLITUDE_X = 4.0;
const BOB_AMPLITUDE_Y = 3.0;

/** Weapon bob speed (radians per second). */
const BOB_SPEED = 10.0;

/** Maximum raycast distance for hitscan weapons. */
const MAX_HITSCAN_RANGE = 32.0;

/** Step size for hitscan raycasting (tiles). */
const HITSCAN_STEP = 0.1;

// =============================================================================
// WeaponSystem Class
// =============================================================================

export class WeaponSystem {
    constructor() {
        /** @type {number} Index of the current weapon (0-6). */
        this.currentWeapon = 0;

        /** @type {number} Cooldown timer until next shot is allowed. */
        this.fireTimer = 0;

        /** @type {number} Current weapon state. */
        this.state = WeaponState.IDLE;

        /** @type {number} Current animation frame (0=idle, 1=fire1, 2=fire2). */
        this.animFrame = 0;

        /** @type {number} Phase accumulator for weapon bob. */
        this.bobPhase = 0;

        /**
         * @type {number} Internal timer for fire animation playback.
         * @private
         */
        this._animTimer = 0;
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    /**
     * Process fire input and manage weapon state each frame.
     *
     * @param {number} dt - Delta time in seconds.
     * @param {import('../utils/input.js').default} input - Input manager.
     * @param {import('./player.js').Player} player - The player entity.
     * @param {Array} enemies - Array of enemy entities for hitscan checks.
     * @param {{ grid: number[][], width: number, height: number }} map - Tile map.
     * @returns {Object|null} Fire result. For hitscan: { hit, enemy, damage } or
     *   null. For projectile: { projectile: { x, y, dx, dy, speed, damage, ... } }.
     */
    update(dt, input, player, enemies, map) {
        if (!player.alive) return null;

        // Sync weapon index from player in case it changed externally.
        this.currentWeapon = player.currentWeapon;

        // ---- Weapon switching via number keys ----
        for (let i = 0; i < 7; i++) {
            if (input.isKeyDown(`Digit${i + 1}`)) {
                this.switchWeapon(i, player);
            }
        }

        // ---- Fire timer cooldown ----
        if (this.fireTimer > 0) {
            this.fireTimer -= dt;
        }

        // ---- Fire animation ----
        if (this.state === WeaponState.FIRING) {
            this._animTimer += dt;

            // Progress through fire animation frames.
            const frameDuration = FIRE_ANIM_DURATION / (FIRE_ANIM_FRAMES - 1);
            this.animFrame = Math.min(
                Math.floor(this._animTimer / frameDuration) + 1,
                FIRE_ANIM_FRAMES - 1
            );

            if (this._animTimer >= FIRE_ANIM_DURATION) {
                this.state = WeaponState.COOLDOWN;
                this.animFrame = 0;
                this._animTimer = 0;
            }
        }

        if (this.state === WeaponState.COOLDOWN) {
            if (this.fireTimer <= 0) {
                this.state = WeaponState.IDLE;
            }
        }

        // ---- Fire input ----
        let result = null;

        if (input.isMouseDown() && this.fireTimer <= 0 && this.state === WeaponState.IDLE) {
            result = this.fire(player, enemies, map);
        }

        return result;
    }

    // -------------------------------------------------------------------------
    // Weapon Switching
    // -------------------------------------------------------------------------

    /**
     * Switch to a weapon by index if the player has it.
     *
     * @param {number} index - Weapon index (0-6).
     * @param {import('./player.js').Player} player
     * @returns {boolean} True if the switch was successful.
     */
    switchWeapon(index, player) {
        if (index < 0 || index >= WEAPON_DEFS.length) return false;
        if (!player.weapons[index]) return false;
        if (index === this.currentWeapon) return false;

        this.currentWeapon = index;
        player.currentWeapon = index;

        // Reset fire state on switch.
        this.state = WeaponState.IDLE;
        this.animFrame = 0;
        this.fireTimer = 0;
        this._animTimer = 0;

        return true;
    }

    // -------------------------------------------------------------------------
    // Firing
    // -------------------------------------------------------------------------

    /**
     * Fire the current weapon. Consumes ammo, starts the fire animation, and
     * resolves hits for hitscan weapons or spawns a projectile.
     *
     * @param {import('./player.js').Player} player
     * @param {Array} enemies - Enemy entities to check for hitscan hits.
     * @param {{ grid: number[][], width: number, height: number }} map
     * @returns {Object|null} Result of the shot.
     */
    fire(player, enemies, map) {
        const def = WEAPON_DEFS[this.currentWeapon];
        if (!def) return null;

        // ---- Ammo check ----
        if (def.ammoPerShot > 0) {
            if (player.ammo[def.ammoType] < def.ammoPerShot) {
                return null; // Not enough ammo.
            }
            player.ammo[def.ammoType] -= def.ammoPerShot;
        }

        // ---- Set fire state ----
        this.state = WeaponState.FIRING;
        this.fireTimer = 1.0 / def.fireRate;
        this._animTimer = 0;
        this.animFrame = 1;

        // ---- Resolve shot ----
        if (def.isProjectile) {
            return this._fireProjectile(player, def);
        }

        return this._fireHitscan(player, enemies, map, def);
    }

    // -------------------------------------------------------------------------
    // Hitscan Weapons
    // -------------------------------------------------------------------------

    /**
     * Cast a ray from the player and check for enemy hits.
     * For multi-pellet weapons (shotgun), each pellet is an independent ray.
     *
     * @param {import('./player.js').Player} player
     * @param {Array} enemies
     * @param {{ grid: number[][], width: number, height: number }} map
     * @param {WeaponDef} def
     * @returns {{ hit: boolean, enemies: Array<{ enemy: Object, damage: number }> }}
     * @private
     */
    _fireHitscan(player, enemies, map, def) {
        const pellets = def.pellets || 1;
        const spread  = def.spread || 0;
        const hits    = [];

        for (let p = 0; p < pellets; p++) {
            // Apply random spread offset to the base angle.
            const spreadOffset = spread > 0
                ? randomRange(-spread, spread)
                : 0;
            const angle = player.angle + spreadOffset;

            const rayDirX = Math.cos(angle);
            const rayDirY = Math.sin(angle);

            const result = this._castHitscanRay(
                player.pos.x, player.pos.y,
                rayDirX, rayDirY,
                enemies, map,
                def.maxRange
            );

            if (result && result.enemy) {
                // Check if this enemy was already hit by another pellet.
                const existing = hits.find(h => h.enemy === result.enemy);
                if (existing) {
                    existing.damage += def.damage;
                } else {
                    hits.push({ enemy: result.enemy, damage: def.damage });
                }
            }
        }

        // Apply damage to all hit enemies and track kills.
        for (const h of hits) {
            if (h.enemy.takeDamage) {
                h.killed = h.enemy.takeDamage(h.damage);
            } else {
                h.killed = false;
            }
        }

        return {
            hit: hits.length > 0,
            enemies: hits,
        };
    }

    /**
     * Step along a ray and check for wall or enemy collisions.
     *
     * @param {number} startX - Ray origin X.
     * @param {number} startY - Ray origin Y.
     * @param {number} dirX   - Ray direction X (unit length).
     * @param {number} dirY   - Ray direction Y (unit length).
     * @param {Array} enemies
     * @param {{ grid: number[][], width: number, height: number }} map
     * @param {number} [maxRange] - Override for maximum ray distance (tiles).
     * @returns {{ enemy: Object, dist: number }|null}
     * @private
     */
    _castHitscanRay(startX, startY, dirX, dirY, enemies, map, maxRange) {
        const grid = map.grid;
        const mapW = map.width;
        const mapH = map.height;
        const range = maxRange !== undefined ? maxRange : MAX_HITSCAN_RANGE;

        let closestHit = null;
        let closestDist = range;

        // First find the wall hit distance using DDA for accuracy.
        const wallDist = this._dda(startX, startY, dirX, dirY, grid, mapW, mapH);
        if (wallDist < closestDist) {
            closestDist = wallDist;
        }

        // Check each enemy to see if the ray passes near them.
        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                // Skip dead enemies and those in dying animation (health 0
                // but alive flag still true during death anim).
                if (!enemy.alive || enemy.health <= 0) continue;

                // Vector from ray origin to enemy.
                const toX = enemy.pos.x - startX;
                const toY = enemy.pos.y - startY;

                // Project onto ray direction to find the closest approach.
                const dot = toX * dirX + toY * dirY;

                // Enemy is behind the ray origin or beyond the closest wall.
                if (dot < 0 || dot > closestDist) continue;

                // Perpendicular distance from the ray to the enemy center.
                const perpX = toX - dirX * dot;
                const perpY = toY - dirY * dot;
                const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

                // Hit radius check (enemy treated as circle with radius 0.4).
                const hitRadius = enemy.radius !== undefined ? enemy.radius : 0.4;
                if (perpDist < hitRadius) {
                    if (dot < closestDist) {
                        closestDist = dot;
                        closestHit = { enemy, dist: dot };
                    }
                }
            }
        }

        return closestHit;
    }

    /**
     * Simple DDA to find the distance to the first solid wall tile along a ray.
     *
     * @param {number} posX
     * @param {number} posY
     * @param {number} rayDirX
     * @param {number} rayDirY
     * @param {number[][]} grid
     * @param {number} mapW
     * @param {number} mapH
     * @returns {number} Distance to wall hit, or MAX_HITSCAN_RANGE if none.
     * @private
     */
    _dda(posX, posY, rayDirX, rayDirY, grid, mapW, mapH) {
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

            // Out of bounds.
            if (mapX < 0 || mapX >= mapW || mapY < 0 || mapY >= mapH) {
                break;
            }

            if (grid[mapY][mapX] > 0) {
                // Calculate perpendicular distance.
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
    // Projectile Weapons
    // -------------------------------------------------------------------------

    /**
     * Spawn a projectile from the player's position in the facing direction.
     *
     * @param {import('./player.js').Player} player
     * @param {WeaponDef} def
     * @returns {{ projectile: Object }}
     * @private
     */
    _fireProjectile(player, def) {
        const dirX = Math.cos(player.angle);
        const dirY = Math.sin(player.angle);

        // Spawn the projectile slightly ahead of the player to avoid self-hit.
        const spawnOffset = 0.5;

        return {
            projectile: {
                x:           player.pos.x + dirX * spawnOffset,
                y:           player.pos.y + dirY * spawnOffset,
                dx:          dirX,
                dy:          dirY,
                speed:       def.projSpeed || 8,
                damage:      def.damage,
                splashDamage: def.splashDamage || 0,
                splashRadius: def.splashRadius || 0,
                owner:       'player',
                spriteId:    def.name === 'Rocket Launcher' ? 401 : 402,
            },
        };
    }

    // -------------------------------------------------------------------------
    // Weapon Bob (View Model Animation)
    // -------------------------------------------------------------------------

    /**
     * Calculate the weapon bob offset for the view model based on whether
     * the player is moving.
     *
     * @param {boolean} isMoving - Whether the player is currently walking.
     * @param {number} dt - Delta time in seconds.
     * @returns {{ x: number, y: number }} Pixel offset for the weapon sprite.
     */
    getBobOffset(isMoving, dt) {
        if (isMoving) {
            this.bobPhase += BOB_SPEED * dt;
        } else {
            // Smoothly return to center when stationary.
            this.bobPhase = 0;
        }

        const x = Math.sin(this.bobPhase) * BOB_AMPLITUDE_X;
        const y = Math.abs(Math.cos(this.bobPhase)) * BOB_AMPLITUDE_Y;

        return { x, y };
    }

    // -------------------------------------------------------------------------
    // Animation Query
    // -------------------------------------------------------------------------

    /**
     * Get the current sprite animation frame index.
     *
     * @returns {number} 0 = idle, 1 = fire frame 1, 2 = fire frame 2.
     */
    getAnimFrame() {
        return this.animFrame;
    }

    /**
     * Get the weapon definition for the currently equipped weapon.
     *
     * @returns {WeaponDef}
     */
    getCurrentDef() {
        return WEAPON_DEFS[this.currentWeapon];
    }
}
