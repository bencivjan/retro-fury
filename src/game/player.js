// =============================================================================
// player.js - Player entity for RETRO FURY
// =============================================================================
// Manages player state (position, health, armor, ammo, weapons, keycards),
// processes WASD + mouse-look input, and handles collision detection against
// the tile map using a circle-vs-grid approach with wall sliding.
// =============================================================================

import { clamp, normalizeAngle } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Movement speed in tiles per second. */
const MOVE_SPEED = 3.0;

/** Player collision radius in tile units. */
const COLLISION_RADIUS = 0.25;

/** Mouse look sensitivity (radians per pixel of mouse delta). */
const MOUSE_SENSITIVITY = 0.003;

/** Vertical look sensitivity (pixels of horizon offset per pixel of mouse delta). */
const PITCH_SENSITIVITY = 0.5;

/** Maximum vertical look offset in pixels. */
const MAX_PITCH = 80;

/** Maximum values for player stats and ammo. */
const MAX_HEALTH = 200;
const MAX_ARMOR  = 100;
const MAX_AMMO   = {
    bullets: 200,
    shells:  50,
    rockets: 25,
    cells:   100,
};

/** Default starting state for a fresh player. */
const DEFAULT_STATE = Object.freeze({
    health:        100,
    armor:         0,
    currentWeapon: 0,
});

// =============================================================================
// Player Class
// =============================================================================

export class Player {
    /**
     * @param {number} x - Starting X position in map coordinates.
     * @param {number} y - Starting Y position in map coordinates.
     * @param {number} [angle=0] - Starting facing angle in radians.
     */
    constructor(x, y, angle = 0) {
        /** @type {{ x: number, y: number }} World position (fractional map units). */
        this.pos = { x, y };

        /** @type {number} Facing angle in radians. 0 = east, PI/2 = south. */
        this.angle = angle;

        /** @type {number} Current health (0-200). Starts at 100. */
        this.health = DEFAULT_STATE.health;

        /** @type {number} Current armor (0-100). */
        this.armor = DEFAULT_STATE.armor;

        /**
         * @type {{ bullets: number, shells: number, rockets: number, cells: number }}
         * Ammunition counts per ammo type. Pistol uses infinite ammo (ammoPerShot=0).
         */
        this.ammo = {
            bullets: Infinity,
            shells:  0,
            rockets: 0,
            cells:   0,
        };

        /**
         * @type {boolean[]} Which weapons the player has (indexed 0-6).
         * 0=Pistol, 1=Shotgun, 2=MachineGun, 3=RocketLauncher, 4=PlasmaRifle,
         * 5=SniperRifle (MP), 6=Knife (MP)
         */
        this.weapons = [true, false, false, false, false, false, false];

        /** @type {number} Index of the currently selected weapon (0-6). */
        this.currentWeapon = DEFAULT_STATE.currentWeapon;

        /** @type {Set<string>} Set of keycard colors the player holds. */
        this.keycards = new Set();

        /** @type {number} Vertical look offset in pixels (positive = looking up). */
        this.pitch = 0;

        /** @type {boolean} Whether the player is alive. */
        this.alive = true;

        // Store spawn point for reset.
        this._spawnX = x;
        this._spawnY = y;
        this._spawnAngle = angle;
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    /**
     * Process input and update player state for one frame.
     *
     * Movement is relative to the player's current facing direction.
     * Collision detection uses a circle (radius 0.25) against the 3x3 grid of
     * tiles surrounding the player, with wall-sliding so the player does not
     * stop abruptly on contact but instead slides along the wall surface.
     *
     * @param {number} dt - Delta time in seconds.
     * @param {{ grid: number[][], width: number, height: number }} map
     *   The tile map. grid[y][x] > 0 indicates a solid wall tile.
     * @param {import('../utils/input.js').default} input - The input manager.
     */
    update(dt, map, input) {
        if (!this.alive) return;

        // ---- Mouse look (horizontal) ----
        const mouseDX = input.getMouseDeltaX();
        this.angle = normalizeAngle(this.angle + mouseDX * MOUSE_SENSITIVITY);

        // ---- Mouse look (vertical / pitch) ----
        const mouseDY = input.getMouseDeltaY();
        this.pitch = clamp(this.pitch - mouseDY * PITCH_SENSITIVITY, -MAX_PITCH, MAX_PITCH);

        // ---- Build movement vector from WASD ----
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        // Forward/backward direction (along the facing angle).
        const dirX = cos;
        const dirY = sin;

        // Strafe direction (perpendicular to facing, 90 degrees clockwise).
        const strafeX = -sin;
        const strafeY = cos;

        let moveX = 0;
        let moveY = 0;

        if (input.isKeyDown('KeyW')) { moveX += dirX; moveY += dirY; }
        if (input.isKeyDown('KeyS')) { moveX -= dirX; moveY -= dirY; }
        if (input.isKeyDown('KeyA')) { moveX -= strafeX; moveY -= strafeY; }
        if (input.isKeyDown('KeyD')) { moveX += strafeX; moveY += strafeY; }

        // Normalize diagonal movement so it is not faster than cardinal.
        const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
        if (moveLen > 0) {
            const invLen = 1.0 / moveLen;
            moveX *= invLen;
            moveY *= invLen;
        }

        // Apply speed and delta time.
        const velX = moveX * MOVE_SPEED * dt;
        const velY = moveY * MOVE_SPEED * dt;

        // ---- Collision detection with wall sliding ----
        // Try X and Y axes independently so the player slides along walls
        // rather than stopping dead on contact.
        const newX = this.pos.x + velX;
        const newY = this.pos.y + velY;

        if (!this._collidesWithMap(newX, this.pos.y, map)) {
            this.pos.x = newX;
        }

        if (!this._collidesWithMap(this.pos.x, newY, map)) {
            this.pos.y = newY;
        }

        // ---- Clamp to map bounds ----
        this.pos.x = clamp(this.pos.x, COLLISION_RADIUS, map.width - COLLISION_RADIUS);
        this.pos.y = clamp(this.pos.y, COLLISION_RADIUS, map.height - COLLISION_RADIUS);
    }

    // -------------------------------------------------------------------------
    // Damage & Healing
    // -------------------------------------------------------------------------

    /**
     * Apply damage to the player. Armor absorbs 50% of damage first.
     *
     * @param {number} amount - Raw damage amount.
     * @returns {boolean} True if the player died from this damage.
     */
    takeDamage(amount) {
        if (!this.alive || amount <= 0) return false;

        // Armor absorbs 50% of incoming damage.
        if (this.armor > 0) {
            const armorAbsorb = Math.min(this.armor, Math.floor(amount * 0.5));
            this.armor -= armorAbsorb;
            amount -= armorAbsorb;
        }

        this.health -= amount;

        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            return true;
        }

        return false;
    }

    /**
     * Restore health, capped at MAX_HEALTH.
     *
     * @param {number} amount - Health to restore.
     */
    heal(amount) {
        this.health = Math.min(this.health + amount, MAX_HEALTH);
    }

    /**
     * Add armor, capped at MAX_ARMOR.
     *
     * @param {number} amount - Armor to add.
     */
    addArmor(amount) {
        this.armor = Math.min(this.armor + amount, MAX_ARMOR);
    }

    // -------------------------------------------------------------------------
    // Ammo
    // -------------------------------------------------------------------------

    /**
     * Add ammunition of a given type, capped at its maximum.
     *
     * @param {string} type - One of 'bullets', 'shells', 'rockets', 'cells'.
     * @param {number} amount - Amount to add.
     */
    addAmmo(type, amount) {
        if (!(type in this.ammo)) return;
        if (this.ammo[type] === Infinity) return; // Cannot add to infinite ammo.

        const max = MAX_AMMO[type];
        this.ammo[type] = Math.min(this.ammo[type] + amount, max);
    }

    /**
     * Check whether the player is at maximum ammo for a given type.
     *
     * @param {string} type - Ammo type key.
     * @returns {boolean}
     */
    isAmmoFull(type) {
        if (this.ammo[type] === Infinity) return false;
        return this.ammo[type] >= MAX_AMMO[type];
    }

    // -------------------------------------------------------------------------
    // Keycards
    // -------------------------------------------------------------------------

    /**
     * Check whether the player has a keycard of the given color.
     *
     * @param {string} color - Keycard color (e.g. 'blue', 'red', 'yellow').
     * @returns {boolean}
     */
    hasKeycard(color) {
        return this.keycards.has(color);
    }

    /**
     * Give the player a keycard.
     *
     * @param {string} color - Keycard color.
     */
    addKeycard(color) {
        this.keycards.add(color);
    }

    // -------------------------------------------------------------------------
    // Weapons
    // -------------------------------------------------------------------------

    /**
     * Give the player a weapon by index.
     *
     * @param {number} index - Weapon index (0-6).
     */
    giveWeapon(index) {
        if (index >= 0 && index < 7) {
            this.weapons[index] = true;
        }
    }

    // -------------------------------------------------------------------------
    // State Reset
    // -------------------------------------------------------------------------

    /**
     * Reset all player state to defaults for a level restart.
     * Restores position to original spawn point.
     */
    reset() {
        this.pos.x = this._spawnX;
        this.pos.y = this._spawnY;
        this.angle = this._spawnAngle;

        this.health = DEFAULT_STATE.health;
        this.armor  = DEFAULT_STATE.armor;

        this.ammo = {
            bullets: Infinity,
            shells:  0,
            rockets: 0,
            cells:   0,
        };

        this.weapons = [true, false, false, false, false, false, false];
        this.currentWeapon = DEFAULT_STATE.currentWeapon;
        this.keycards.clear();
        this.pitch = 0;
        this.alive = true;
    }

    // -------------------------------------------------------------------------
    // Collision Detection (Private)
    // -------------------------------------------------------------------------

    /**
     * Test whether a circle at (cx, cy) with COLLISION_RADIUS overlaps any
     * solid tile in the map. Checks the 3x3 grid of tiles around the position.
     *
     * @param {number} cx - Circle center X.
     * @param {number} cy - Circle center Y.
     * @param {{ grid: number[][], width: number, height: number }} map
     * @returns {boolean} True if there is a collision.
     * @private
     */
    _collidesWithMap(cx, cy, map) {
        const grid    = map.grid;
        const mapW    = map.width;
        const mapH    = map.height;
        const radius  = COLLISION_RADIUS;

        // Tile the player center is in.
        const tileX = Math.floor(cx);
        const tileY = Math.floor(cy);

        // Check a 3x3 neighborhood of tiles around the player.
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const tx = tileX + dx;
                const ty = tileY + dy;

                // Out-of-bounds tiles are treated as solid walls.
                if (tx < 0 || tx >= mapW || ty < 0 || ty >= mapH) {
                    if (this._circleIntersectsAABB(cx, cy, radius, tx, ty, tx + 1, ty + 1)) {
                        return true;
                    }
                    continue;
                }

                // Only check solid tiles (grid value > 0).
                if (grid[ty][tx] <= 0) continue;

                // AABB for this tile: [tx, ty] to [tx+1, ty+1].
                if (this._circleIntersectsAABB(cx, cy, radius, tx, ty, tx + 1, ty + 1)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Test whether a circle intersects an axis-aligned bounding box.
     * Uses the "closest point on AABB" method.
     *
     * @param {number} cx - Circle center X.
     * @param {number} cy - Circle center Y.
     * @param {number} r  - Circle radius.
     * @param {number} minX - AABB left edge.
     * @param {number} minY - AABB top edge.
     * @param {number} maxX - AABB right edge.
     * @param {number} maxY - AABB bottom edge.
     * @returns {boolean}
     * @private
     */
    _circleIntersectsAABB(cx, cy, r, minX, minY, maxX, maxY) {
        // Find the closest point on the AABB to the circle center.
        const closestX = clamp(cx, minX, maxX);
        const closestY = clamp(cy, minY, maxY);

        const dx = cx - closestX;
        const dy = cy - closestY;

        return (dx * dx + dy * dy) < (r * r);
    }
}

// Export constants for external use (e.g., HUD display, tests).
export { MAX_HEALTH, MAX_ARMOR, MAX_AMMO, COLLISION_RADIUS, MOVE_SPEED };
