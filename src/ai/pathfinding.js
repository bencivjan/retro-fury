// =============================================================================
// pathfinding.js - Simple tile-based movement for RETRO FURY
// =============================================================================
// Provides direct-to-target movement with wall sliding and enemy separation,
// plus a DDA-based line-of-sight check. No complex A* here -- the retro feel
// comes from enemies moving straight at the player and getting hung up on
// corners, just like the originals.
// =============================================================================

import { clamp } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default collision radius for enemies. */
const DEFAULT_RADIUS = 0.3;

/** How long an enemy must be stuck before trying a random escape direction. */
const STUCK_THRESHOLD = 1.0;

/** Minimum movement per second to not be considered stuck. */
const STUCK_MIN_PROGRESS = 0.05;

/** How far apart enemies push each other (minimum separation distance). */
const SEPARATION_RADIUS = 0.6;

/** Strength of the separation push per frame. */
const SEPARATION_FORCE = 2.0;

// =============================================================================
// moveToward
// =============================================================================

/**
 * Move an entity toward a target position with wall collision and enemy
 * separation. The entity must have pos {x, y} and optionally stuckTimer and
 * lastPos properties (both will be created if missing).
 *
 * Movement uses the same circle-vs-tile-AABB technique as the player, resolving
 * X and Y independently to allow wall sliding.
 *
 * @param {Object} entity - Entity to move. Must have pos {x, y}. May also have
 *   radius (default 0.3), stuckTimer, lastPos, and escapeAngle.
 * @param {number} targetX - Target world X coordinate.
 * @param {number} targetY - Target world Y coordinate.
 * @param {number} speed - Movement speed in tiles per second.
 * @param {number} dt - Delta time in seconds.
 * @param {{ grid: number[][], width: number, height: number }} map - Tile map.
 * @param {Array} enemies - All enemy entities (for separation).
 */
export function moveToward(entity, targetX, targetY, speed, dt, map, enemies) {
    const radius = entity.radius || DEFAULT_RADIUS;

    // Initialize stuck-detection state if not present.
    if (entity.lastPos === undefined) {
        entity.lastPos = { x: entity.pos.x, y: entity.pos.y };
    }
    if (entity.stuckTimer === undefined) {
        entity.stuckTimer = 0;
    }

    // ---- Calculate direction to target ----
    let dx = targetX - entity.pos.x;
    let dy = targetY - entity.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) return; // Close enough, no movement needed.

    dx /= dist;
    dy /= dist;

    // ---- Stuck detection: try perpendicular escape ----
    // Measure progress since last frame.
    const progressX = entity.pos.x - entity.lastPos.x;
    const progressY = entity.pos.y - entity.lastPos.y;
    const progressDist = Math.sqrt(progressX * progressX + progressY * progressY);

    if (progressDist < STUCK_MIN_PROGRESS * dt) {
        entity.stuckTimer += dt;
    } else {
        entity.stuckTimer = 0;
        entity.escapeAngle = undefined;
    }

    // If stuck for long enough, pick a random perpendicular direction to try.
    if (entity.stuckTimer >= STUCK_THRESHOLD) {
        if (entity.escapeAngle === undefined) {
            // Pick left or right perpendicular, with a random bias.
            entity.escapeAngle = Math.random() < 0.5 ? 1 : -1;
        }
        // Rotate the desired direction 90 degrees in the chosen direction.
        const perpX = -dy * entity.escapeAngle;
        const perpY = dx * entity.escapeAngle;

        // Blend perpendicular with forward direction (70% perpendicular).
        dx = dx * 0.3 + perpX * 0.7;
        dy = dy * 0.3 + perpY * 0.7;

        // Re-normalize.
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }

        // Reset stuck timer periodically to re-evaluate.
        if (entity.stuckTimer > STUCK_THRESHOLD + 1.5) {
            entity.stuckTimer = 0;
            entity.escapeAngle = undefined;
        }
    }

    // Store position before movement for next frame's stuck check.
    entity.lastPos.x = entity.pos.x;
    entity.lastPos.y = entity.pos.y;

    // ---- Apply movement with wall sliding ----
    const velX = dx * speed * dt;
    const velY = dy * speed * dt;

    const newX = entity.pos.x + velX;
    const newY = entity.pos.y + velY;

    // Resolve X and Y independently for wall-sliding behavior.
    if (!_collidesWithMap(newX, entity.pos.y, radius, map)) {
        entity.pos.x = newX;
    }

    if (!_collidesWithMap(entity.pos.x, newY, radius, map)) {
        entity.pos.y = newY;
    }

    // Clamp to map bounds.
    entity.pos.x = clamp(entity.pos.x, radius, map.width - radius);
    entity.pos.y = clamp(entity.pos.y, radius, map.height - radius);

    // ---- Enemy-enemy separation ----
    if (enemies) {
        _separateFromOthers(entity, enemies, radius, dt);
    }
}

// =============================================================================
// lineOfSight
// =============================================================================

/**
 * Check whether there is a clear line of sight between two points using DDA
 * raycasting. Returns true if the ray reaches (x2, y2) without hitting a wall.
 *
 * @param {number} x1 - Start X.
 * @param {number} y1 - Start Y.
 * @param {number} x2 - End X.
 * @param {number} y2 - End Y.
 * @param {{ grid: number[][], width: number, height: number }} map - Tile map.
 * @returns {boolean} True if there is unobstructed line of sight.
 */
export function lineOfSight(x1, y1, x2, y2, map) {
    const grid = map.grid;
    const mapW = map.width;
    const mapH = map.height;

    let dx = x2 - x1;
    let dy = y2 - y1;
    const totalDist = Math.sqrt(dx * dx + dy * dy);

    // Trivially visible if in the same spot.
    if (totalDist < 0.001) return true;

    // Normalize ray direction.
    const rayDirX = dx / totalDist;
    const rayDirY = dy / totalDist;

    // ---- DDA setup ----
    let mapX = Math.floor(x1);
    let mapY = Math.floor(y1);

    const endMapX = Math.floor(x2);
    const endMapY = Math.floor(y2);

    const absDirX = Math.abs(rayDirX);
    const absDirY = Math.abs(rayDirY);
    const deltaDistX = absDirX < 1e-12 ? 1e30 : 1.0 / absDirX;
    const deltaDistY = absDirY < 1e-12 ? 1e30 : 1.0 / absDirY;

    let stepX, sideDistX;
    let stepY, sideDistY;

    if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (x1 - mapX) * deltaDistX;
    } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - x1) * deltaDistX;
    }

    if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (y1 - mapY) * deltaDistY;
    } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - y1) * deltaDistY;
    }

    // ---- DDA traversal ----
    // Limit iterations to prevent infinite loops on degenerate input.
    const maxSteps = Math.ceil(totalDist) * 3 + 10;

    for (let i = 0; i < maxSteps; i++) {
        // Check if we've reached the target tile.
        if (mapX === endMapX && mapY === endMapY) {
            return true;
        }

        // Step to the next tile boundary.
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
        }

        // Out of bounds -> blocked.
        if (mapX < 0 || mapX >= mapW || mapY < 0 || mapY >= mapH) {
            return false;
        }

        // Wall tile -> blocked.
        if (grid[mapY][mapX] > 0) {
            return false;
        }
    }

    // Ran out of steps without reaching target -- assume blocked.
    return false;
}

// =============================================================================
// Private Helpers
// =============================================================================

/**
 * Test whether a circle at (cx, cy) with the given radius overlaps any solid
 * tile in the map. Checks the 3x3 grid neighborhood around the position.
 *
 * @param {number} cx - Circle center X.
 * @param {number} cy - Circle center Y.
 * @param {number} radius - Circle radius.
 * @param {{ grid: number[][], width: number, height: number }} map
 * @returns {boolean} True if there is a collision.
 * @private
 */
function _collidesWithMap(cx, cy, radius, map) {
    const grid = map.grid;
    const mapW = map.width;
    const mapH = map.height;

    const tileX = Math.floor(cx);
    const tileY = Math.floor(cy);

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const tx = tileX + dx;
            const ty = tileY + dy;

            // Out-of-bounds tiles are treated as solid.
            if (tx < 0 || tx >= mapW || ty < 0 || ty >= mapH) {
                if (_circleIntersectsAABB(cx, cy, radius, tx, ty, tx + 1, ty + 1)) {
                    return true;
                }
                continue;
            }

            // Only check solid tiles (grid value > 0).
            if (grid[ty][tx] <= 0) continue;

            if (_circleIntersectsAABB(cx, cy, radius, tx, ty, tx + 1, ty + 1)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Test whether a circle intersects an axis-aligned bounding box using the
 * "closest point on AABB" method.
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
function _circleIntersectsAABB(cx, cy, r, minX, minY, maxX, maxY) {
    const closestX = clamp(cx, minX, maxX);
    const closestY = clamp(cy, minY, maxY);

    const dx = cx - closestX;
    const dy = cy - closestY;

    return (dx * dx + dy * dy) < (r * r);
}

/**
 * Push the entity away from any overlapping enemies. Uses simple circle-circle
 * separation to keep enemies from stacking on top of each other.
 *
 * @param {Object} entity - The entity being separated.
 * @param {Array} enemies - All enemy entities.
 * @param {number} radius - The entity's collision radius.
 * @param {number} dt - Delta time in seconds.
 * @private
 */
function _separateFromOthers(entity, enemies, radius, dt) {
    for (let i = 0; i < enemies.length; i++) {
        const other = enemies[i];

        // Don't separate from self or dead enemies.
        if (other === entity || !other.alive) continue;

        const otherRadius = other.radius || DEFAULT_RADIUS;
        const minSep = radius + otherRadius;

        const dx = entity.pos.x - other.pos.x;
        const dy = entity.pos.y - other.pos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minSep * minSep && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const overlap = minSep - dist;

            // Normalize the separation vector and push apart.
            const nx = dx / dist;
            const ny = dy / dist;

            const pushAmount = overlap * SEPARATION_FORCE * dt;
            entity.pos.x += nx * pushAmount;
            entity.pos.y += ny * pushAmount;
        }
    }
}
