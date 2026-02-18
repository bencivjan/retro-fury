// =============================================================================
// raycaster.js - DDA raycasting engine for RETRO FURY
// =============================================================================
// Casts one ray per screen column through a 2D tile map using the Digital
// Differential Analyser (DDA) algorithm.  Returns per-column hit data
// (perpendicular distance, texture coordinates, wall ID, etc.) packed into
// pre-allocated typed arrays for zero-GC performance in the hot loop.
// =============================================================================

/**
 * Number of per-column fields stored in the results buffer.
 * Layout per column (stride = FIELDS_PER_COLUMN):
 *   [0] perpDistance   - perpendicular distance to the wall hit
 *   [1] wallTextureId  - map tile value at the hit cell (wall type)
 *   [2] textureX       - horizontal texture coordinate (0..1)
 *   [3] side           - 0 = North/South face hit, 1 = East/West face hit
 *   [4] mapX           - integer X coordinate of the hit cell
 *   [5] mapY           - integer Y coordinate of the hit cell
 */
const FIELDS_PER_COLUMN = 6;

// Field offsets within a column's slice of the buffer.
const OFF_PERP_DIST   = 0;
const OFF_TEX_ID      = 1;
const OFF_TEX_X       = 2;
const OFF_SIDE        = 3;
const OFF_MAP_X       = 4;
const OFF_MAP_Y       = 5;

export { FIELDS_PER_COLUMN, OFF_PERP_DIST, OFF_TEX_ID, OFF_TEX_X, OFF_SIDE, OFF_MAP_X, OFF_MAP_Y };

export class Raycaster {
    /**
     * @param {number} screenWidth - Number of screen columns (e.g. 320).
     */
    constructor(screenWidth) {
        /** @type {number} */
        this.screenWidth = screenWidth;

        /**
         * Flat typed array holding all per-column ray results.
         * Access column c, field f as: results[c * FIELDS_PER_COLUMN + f]
         * @type {Float64Array}
         */
        this.results = new Float64Array(screenWidth * FIELDS_PER_COLUMN);

        /**
         * Depth buffer (perpendicular distances only) for fast sprite clipping.
         * This is a separate view so the sprite renderer does not need to know
         * the stride of the full results buffer.
         * @type {Float64Array}
         */
        this.depthBuffer = new Float64Array(screenWidth);
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Cast rays for every screen column and populate the results buffer.
     *
     * @param {import('./camera.js').Camera} camera - The player camera.
     * @param {number[][]} map   - 2D map array. 0 = empty, >0 = wall texture ID.
     * @param {number} screenWidth - Number of columns to cast (should match
     *                               the value passed to the constructor).
     * @returns {Float64Array} The depth buffer (perpendicular distances).
     */
    castRays(camera, map, screenWidth) {
        const results     = this.results;
        const depthBuffer = this.depthBuffer;

        const posX   = camera.pos.x;
        const posY   = camera.pos.y;
        const dirX   = camera.dir.x;
        const dirY   = camera.dir.y;
        const planeX = camera.plane.x;
        const planeY = camera.plane.y;

        const mapHeight = map.length;
        const mapWidth  = mapHeight > 0 ? map[0].length : 0;

        for (let x = 0; x < screenWidth; x++) {
            // ---- Ray direction for this column ----
            const cameraX = (2.0 * x) / screenWidth - 1.0;
            const rayDirX = dirX + planeX * cameraX;
            const rayDirY = dirY + planeY * cameraX;

            // ---- Map cell the ray is currently in ----
            let mapX = Math.floor(posX) | 0;
            let mapY = Math.floor(posY) | 0;

            // ---- Delta distances ----
            // How far along the ray we must travel to cross one full grid cell
            // in the X or Y direction.  Absolute value avoids sign issues.
            // Guard against division by zero by using a very large number.
            const absDirX = Math.abs(rayDirX);
            const absDirY = Math.abs(rayDirY);
            const deltaDistX = absDirX < 1e-12 ? 1e30 : 1.0 / absDirX;
            const deltaDistY = absDirY < 1e-12 ? 1e30 : 1.0 / absDirY;

            // ---- Step and initial sideDistX / sideDistY ----
            // stepX/Y: +1 or -1 in map coords depending on ray direction.
            // sideDistX/Y: distance from the ray origin to the *first* X / Y
            //              grid boundary in the ray's direction.
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

            // ---- DDA walk ----
            let hit  = 0;
            let side = 0; // 0 = NS wall (stepped in X), 1 = EW wall (stepped in Y)
            const maxSteps = mapWidth + mapHeight;
            let steps = 0;

            while (hit === 0 && steps < maxSteps) {
                steps++;
                // Advance to the next grid boundary (whichever is closer).
                if (sideDistX < sideDistY) {
                    sideDistX += deltaDistX;
                    mapX += stepX;
                    side = 0;
                } else {
                    sideDistY += deltaDistY;
                    mapY += stepY;
                    side = 1;
                }

                // Safety: stop if we leave the map bounds.
                if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
                    hit = 1; // treat out-of-bounds as a wall to avoid infinite loop
                    break;
                }

                // Check map cell.
                if (map[mapY][mapX] > 0) {
                    hit = 1;
                }
            }

            // ---- Perpendicular distance ----
            // Using perpendicular distance (not Euclidean) eliminates fisheye.
            let perpDist;
            if (side === 0) {
                perpDist = (mapX - posX + (1 - stepX) * 0.5) / rayDirX;
            } else {
                perpDist = (mapY - posY + (1 - stepY) * 0.5) / rayDirY;
            }

            // Clamp to a small positive value to avoid division by zero later.
            if (perpDist < 1e-4) perpDist = 1e-4;

            // ---- Texture X coordinate ----
            // Where exactly the ray hit the wall surface (0..1).
            let wallX; // fractional part along the wall
            if (side === 0) {
                wallX = posY + perpDist * rayDirY;
            } else {
                wallX = posX + perpDist * rayDirX;
            }
            wallX -= Math.floor(wallX); // keep fractional part only

            // Flip texture X so it is consistent regardless of ray direction.
            if (side === 0 && rayDirX > 0) wallX = 1.0 - wallX;
            if (side === 1 && rayDirY < 0) wallX = 1.0 - wallX;

            // ---- Wall texture ID ----
            // If we went out of bounds, default to texture 1.
            const texId = (mapX >= 0 && mapX < mapWidth && mapY >= 0 && mapY < mapHeight)
                ? map[mapY][mapX]
                : 1;

            // ---- Store results ----
            const base = x * FIELDS_PER_COLUMN;
            results[base + OFF_PERP_DIST] = perpDist;
            results[base + OFF_TEX_ID]    = texId;
            results[base + OFF_TEX_X]     = wallX;
            results[base + OFF_SIDE]      = side;
            results[base + OFF_MAP_X]     = mapX;
            results[base + OFF_MAP_Y]     = mapY;

            // Also store into the separate depth buffer.
            depthBuffer[x] = perpDist;
        }

        return depthBuffer;
    }

    // -------------------------------------------------------------------------
    // Accessors (convenience for reading individual column results)
    // -------------------------------------------------------------------------

    /**
     * Return the base index into the results buffer for column `x`.
     * @param {number} x
     * @returns {number}
     */
    columnOffset(x) {
        return x * FIELDS_PER_COLUMN;
    }
}
