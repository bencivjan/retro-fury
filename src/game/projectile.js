// =============================================================================
// projectile.js - Projectile entity for RETRO FURY
// =============================================================================
// Projectiles are spawned by projectile-type weapons (rocket launcher, plasma
// rifle) and by certain enemy attacks. They travel in a straight line, check
// for collisions against walls, enemies, and the player, and apply damage
// on impact. Rockets additionally deal splash damage to all entities within
// their blast radius.
// =============================================================================

import { vec2Distance } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum time a projectile can exist before self-destructing. */
const MAX_LIFETIME = 5.0;

/** Collision radius for hitting an enemy. */
const ENEMY_HIT_RADIUS = 0.3;

/** Collision radius for hitting the player. */
const PLAYER_HIT_RADIUS = 0.3;

// =============================================================================
// Projectile Class
// =============================================================================

export class Projectile {
    /**
     * Create a projectile from spawn data (typically produced by WeaponSystem.fire).
     *
     * @param {Object} data - Projectile spawn parameters.
     * @param {number} data.x           - Starting X position.
     * @param {number} data.y           - Starting Y position.
     * @param {number} data.dx          - Direction X (unit vector component).
     * @param {number} data.dy          - Direction Y (unit vector component).
     * @param {number} data.speed       - Movement speed in tiles per second.
     * @param {number} data.damage      - Direct hit damage.
     * @param {number} [data.splashDamage=0] - Splash/area damage on impact.
     * @param {number} [data.splashRadius=0] - Radius of splash damage in tiles.
     * @param {string} [data.owner='player'] - 'player' or 'enemy'.
     * @param {number} [data.spriteId=401]   - Sprite ID for rendering.
     */
    constructor(data) {
        /** @type {number} World X position. */
        this.x = data.x;

        /** @type {number} World Y position. */
        this.y = data.y;

        /** @type {number} Direction X (unit). */
        this.dx = data.dx;

        /** @type {number} Direction Y (unit). */
        this.dy = data.dy;

        /** @type {number} Speed in tiles per second. */
        this.speed = data.speed;

        /** @type {number} Direct hit damage. */
        this.damage = data.damage;

        /** @type {number} Splash damage amount (0 if none). */
        this.splashDamage = data.splashDamage || 0;

        /** @type {number} Splash damage radius in tiles (0 if none). */
        this.splashRadius = data.splashRadius || 0;

        /** @type {string} Who fired this projectile: 'player' or 'enemy'. */
        this.owner = data.owner || 'player';

        /** @type {number} Sprite ID for rendering. */
        this.spriteId = data.spriteId || 401;

        /** @type {boolean} Whether this projectile is still active. */
        this.alive = true;

        /** @type {number} Remaining lifetime in seconds. */
        this.lifetime = MAX_LIFETIME;
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    /**
     * Move the projectile forward, check for wall collisions, and decrement
     * the lifetime. If the projectile hits a wall or its lifetime expires,
     * it is marked dead.
     *
     * @param {number} dt - Delta time in seconds.
     * @param {{ grid: number[][], width: number, height: number }} map - Tile map.
     */
    update(dt, map) {
        if (!this.alive) return;

        // Decrement lifetime.
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.alive = false;
            return;
        }

        // Move along direction.
        const moveX = this.dx * this.speed * dt;
        const moveY = this.dy * this.speed * dt;

        this.x += moveX;
        this.y += moveY;

        // ---- Wall collision ----
        const grid = map.grid;
        const tileX = Math.floor(this.x);
        const tileY = Math.floor(this.y);

        // Out of bounds check.
        if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
            this.alive = false;
            return;
        }

        // Solid tile check.
        if (grid[tileY][tileX] > 0) {
            this.alive = false;
            return;
        }
    }

    // -------------------------------------------------------------------------
    // Entity Collision
    // -------------------------------------------------------------------------

    /**
     * Check whether this projectile has hit any enemy in the provided array.
     * If a direct hit occurs, applies direct damage. If the projectile has
     * splash damage, applies splash damage to all enemies within range.
     *
     * This method marks the projectile as dead on hit.
     *
     * @param {Array} enemies - Array of enemy entities. Each must have
     *   { pos: { x, y }, alive: boolean, health: number, takeDamage(amount) }.
     * @returns {{ hit: boolean, kills: number }} Whether the projectile hit
     *   and how many enemies were killed by this impact.
     */
    checkHitEnemy(enemies) {
        if (!this.alive || !enemies) return { hit: false, kills: 0 };

        // Only player-owned projectiles hit enemies.
        // (Enemy projectiles targeting other enemies would be friendly fire.)
        // But we still check -- the caller can filter by owner if desired.

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            // Skip dead enemies and enemies already in their dying animation
            // (health <= 0 but alive flag still true during death anim).
            if (!enemy.alive || enemy.health <= 0) continue;

            const dx = this.x - enemy.pos.x;
            const dy = this.y - enemy.pos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < ENEMY_HIT_RADIUS * ENEMY_HIT_RADIUS) {
                let kills = 0;

                // Direct hit.
                if (enemy.takeDamage) {
                    if (enemy.takeDamage(this.damage)) kills++;
                }

                // Apply splash damage to nearby enemies (and potentially
                // the player for self-damage from their own rockets).
                kills += this._applySplashDamage(enemies, null);

                this.alive = false;
                return { hit: true, kills };
            }
        }

        return { hit: false, kills: 0 };
    }

    /**
     * Check whether this projectile has hit the player.
     * Only applies if the projectile was fired by an enemy.
     *
     * @param {import('./player.js').Player} player
     * @returns {boolean} True if the projectile hit the player.
     */
    checkHitPlayer(player) {
        if (!this.alive) return false;
        if (this.owner !== 'enemy') return false;
        if (!player.alive) return false;

        const dx = this.x - player.pos.x;
        const dy = this.y - player.pos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS) {
            // Direct hit.
            player.takeDamage(this.damage);

            // Splash does NOT re-damage the direct-hit target.
            this.alive = false;
            return true;
        }

        return false;
    }

    // -------------------------------------------------------------------------
    // Splash Damage (Private)
    // -------------------------------------------------------------------------

    /**
     * Apply area-of-effect damage to all entities within the splash radius.
     * Damage falls off linearly with distance from the impact point.
     *
     * @param {Array|null} enemies - Enemy entities (may be null).
     * @param {import('./player.js').Player|null} player - Player entity (may be null).
     * @returns {number} Number of enemies killed by the splash damage.
     * @private
     */
    _applySplashDamage(enemies, player) {
        if (this.splashRadius <= 0 || this.splashDamage <= 0) return 0;

        const radiusSq = this.splashRadius * this.splashRadius;
        let kills = 0;

        // Splash damage to enemies.
        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                if (!enemy.alive || enemy.health <= 0) continue;

                const dx = this.x - enemy.pos.x;
                const dy = this.y - enemy.pos.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < radiusSq) {
                    const dist = Math.sqrt(distSq);
                    // Linear falloff: full damage at center, zero at edge.
                    const falloff = 1.0 - (dist / this.splashRadius);
                    const splashDmg = Math.floor(this.splashDamage * falloff);

                    if (splashDmg > 0 && enemy.takeDamage) {
                        if (enemy.takeDamage(splashDmg)) kills++;
                    }
                }
            }
        }

        // Splash damage to player (e.g., from enemy rockets, or self-damage).
        if (player && player.alive) {
            const dx = this.x - player.pos.x;
            const dy = this.y - player.pos.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < radiusSq) {
                const dist = Math.sqrt(distSq);
                const falloff = 1.0 - (dist / this.splashRadius);
                const splashDmg = Math.floor(this.splashDamage * falloff);

                if (splashDmg > 0) {
                    player.takeDamage(splashDmg);
                }
            }
        }

        return kills;
    }
}

// Export constants for tests and external configuration.
export { MAX_LIFETIME, ENEMY_HIT_RADIUS, PLAYER_HIT_RADIUS };
