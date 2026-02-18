// =============================================================================
// camera.js - Player camera / viewpoint for RETRO FURY raycaster
// =============================================================================
// Represents the player's eye in the 2D map.  Stores position, a unit-length
// direction vector, and a camera plane vector perpendicular to the direction.
// The plane's magnitude controls the field of view (~0.66 for ~66 degrees).
// =============================================================================

import { vec2, vec2Rotate } from '../utils/math.js';

/**
 * @typedef {{ x: number, y: number }} Vec2
 */

export class Camera {
    /**
     * @param {number} x      - Starting X position in map coordinates.
     * @param {number} y      - Starting Y position in map coordinates.
     * @param {number} dirX   - Initial direction vector X component.
     * @param {number} dirY   - Initial direction vector Y component.
     * @param {number} [fov=0.66] - Camera plane magnitude (FOV factor).
     */
    constructor(x, y, dirX, dirY, fov = 0.66) {
        /** @type {Vec2} World position (fractional map units). */
        this.pos = vec2(x, y);

        /** @type {Vec2} Unit-length direction the camera faces. */
        this.dir = vec2(dirX, dirY);

        /**
         * @type {Vec2} Camera plane vector, perpendicular to dir.
         * Its magnitude controls the FOV.  For a unit-length dir and a plane
         * magnitude of 0.66 the horizontal FOV is approximately 66 degrees
         * (2 * atan(0.66/1)).
         */
        this.plane = vec2(-dirY * fov, dirX * fov);
    }

    // -------------------------------------------------------------------------
    // Rotation
    // -------------------------------------------------------------------------

    /**
     * Rotate the camera by the given angle (radians, positive = counter-clockwise).
     * Both the direction and plane vectors are rotated by the same amount so
     * they stay perpendicular.
     *
     * @param {number} angle - Rotation angle in radians.
     */
    rotate(angle) {
        this.dir   = vec2Rotate(this.dir, angle);
        this.plane = vec2Rotate(this.plane, angle);
    }

    // -------------------------------------------------------------------------
    // Ray Generation
    // -------------------------------------------------------------------------

    /**
     * Compute the world-space ray direction for a given screen column.
     *
     * The camera coordinate runs from -1 (left edge) to +1 (right edge).
     * The ray direction is:  dir + plane * cameraX
     *
     * Returns the result as an {x, y} object.  This is *not* normalised;
     * the DDA algorithm works correctly with un-normalised directions.
     *
     * @param {number} screenX     - Pixel column (0 .. screenWidth-1).
     * @param {number} screenWidth - Total screen width in pixels.
     * @returns {Vec2} Ray direction vector (not normalised).
     */
    getRayDir(screenX, screenWidth) {
        // cameraX: -1.0 at left edge, 0.0 at center, +1.0 at right edge
        const cameraX = (2.0 * screenX) / screenWidth - 1.0;
        return {
            x: this.dir.x + this.plane.x * cameraX,
            y: this.dir.y + this.plane.y * cameraX,
        };
    }
}
