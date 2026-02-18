// =============================================================================
// sprite.js - Billboard sprite rendering for RETRO FURY
// =============================================================================
// Renders 2D billboard sprites (enemies, pickups, decorations) into the scene.
// Sprites are transformed into camera space, sorted back-to-front, and drawn
// column-by-column with depth-buffer clipping so they correctly appear behind
// walls.  Supports sprite sheets (horizontally tiled frames) and per-pixel
// transparency (alpha = 0 pixels are skipped).
// =============================================================================

import { clamp } from '../utils/math.js';

/**
 * @typedef {Object} WorldSprite
 * @property {number} x          - World X position.
 * @property {number} y          - World Y position.
 * @property {number} textureId  - Key into the texture map.
 * @property {number} [frameIndex=0] - Horizontal frame index for sprite sheets.
 * @property {number} [scaleX=1] - Horizontal scale multiplier.
 * @property {number} [scaleY=1] - Vertical scale multiplier.
 */

/**
 * Internal working entry used during sorting and rendering.
 * Pre-allocated pool to avoid per-frame object creation.
 * @typedef {Object} SpriteEntry
 * @property {number} dist       - Squared distance to camera (for sorting).
 * @property {number} screenX    - Projected screen X center.
 * @property {number} transformY - Depth in camera space (positive = in front).
 * @property {number} spriteWidth  - Projected width on screen.
 * @property {number} spriteHeight - Projected height on screen.
 * @property {number} textureId
 * @property {number} frameIndex
 * @property {number} scaleX
 * @property {number} scaleY
 */

export class SpriteRenderer {
    /**
     * @param {number} maxSprites - Maximum number of sprites that can be on
     *                              screen at once.  Used to size the internal pool.
     */
    constructor(maxSprites = 256) {
        /**
         * Pre-allocated pool of sprite work entries.
         * @type {SpriteEntry[]}
         */
        this._pool = [];
        for (let i = 0; i < maxSprites; i++) {
            this._pool.push({
                dist: 0,
                screenX: 0,
                transformY: 0,
                spriteWidth: 0,
                spriteHeight: 0,
                textureId: 0,
                frameIndex: 0,
                scaleX: 1,
                scaleY: 1,
                worldX: 0,
                worldY: 0,
            });
        }

        /**
         * Scratch array holding references to pool entries that are active
         * this frame, used for sorting.
         * @type {SpriteEntry[]}
         */
        this._active = [];
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Render all visible sprites into the frame buffer.
     *
     * @param {WorldSprite[]} sprites - Array of world sprite objects.
     * @param {import('./camera.js').Camera} camera
     * @param {Float64Array} depthBuffer - Per-column wall distances for clipping.
     * @param {CanvasRenderingContext2D} ctx - The offscreen buffer context (unused
     *   directly; pixels are written through the renderer's ImageData).
     * @param {Object} textures - Texture map keyed by texture ID.  Each value
     *   must expose `.data` (Uint8ClampedArray, RGBA), `.width`, `.height`.
     * @param {number} screenWidth
     * @param {number} screenHeight
     * @param {Uint8ClampedArray} pixels - The renderer's ImageData pixel buffer.
     */
    render(sprites, camera, depthBuffer, ctx, textures, screenWidth, screenHeight, pixels, horizonOffset = 0) {
        if (!sprites || sprites.length === 0) return;

        const active = this._active;
        active.length = 0;

        const posX   = camera.pos.x;
        const posY   = camera.pos.y;
        const dirX   = camera.dir.x;
        const dirY   = camera.dir.y;
        const planeX = camera.plane.x;
        const planeY = camera.plane.y;

        // Inverse of the camera matrix [planeX, dirX; planeY, dirY].
        // Used to transform sprite positions from world space to camera space.
        const invDet = 1.0 / (planeX * dirY - dirX * planeY);

        const halfH = (screenHeight >> 1) + horizonOffset;
        let poolIdx = 0;

        // ---- Transform and cull ----
        for (let i = 0; i < sprites.length && poolIdx < this._pool.length; i++) {
            const spr = sprites[i];

            // Relative position to camera.
            const relX = spr.x - posX;
            const relY = spr.y - posY;

            // Transform into camera space.
            // transformX = horizontal position on the "screen line" in camera space.
            // transformY = depth (distance along the camera direction).
            const transformX = invDet * (dirY * relX - dirX * relY);
            const transformY = invDet * (-planeY * relX + planeX * relY);

            // Cull sprites behind the camera.
            if (transformY <= 0.1) continue;

            // ---- Screen projection ----
            const spriteScreenX = Math.floor((screenWidth * 0.5) * (1 + transformX / transformY));

            const scaleX = spr.scaleX !== undefined ? spr.scaleX : 1;
            const scaleY = spr.scaleY !== undefined ? spr.scaleY : 1;

            const spriteHeight = Math.abs(Math.floor(screenHeight / transformY * scaleY));
            const spriteWidth  = Math.abs(Math.floor(screenHeight / transformY * scaleX));

            // Cull sprites that are entirely off screen.
            const halfW = spriteWidth >> 1;
            if (spriteScreenX + halfW < 0 || spriteScreenX - halfW >= screenWidth) continue;

            // Populate a pool entry.
            const entry = this._pool[poolIdx++];
            entry.dist         = relX * relX + relY * relY; // squared distance for sort
            entry.screenX      = spriteScreenX;
            entry.transformY   = transformY;
            entry.spriteWidth  = spriteWidth;
            entry.spriteHeight = spriteHeight;
            entry.textureId    = spr.textureId;
            entry.frameIndex   = spr.frameIndex || 0;
            entry.scaleX       = scaleX;
            entry.scaleY       = scaleY;

            active.push(entry);
        }

        // ---- Sort back-to-front (farthest first) ----
        active.sort((a, b) => b.dist - a.dist);

        // ---- Draw each sprite column by column ----
        for (let s = 0; s < active.length; s++) {
            const entry = active[s];

            const texture = textures[entry.textureId];
            if (!texture) continue;

            const texW    = texture.width;
            const texH    = texture.height;
            const texData = texture.data;

            // Sprite sheet: each frame occupies (texH x texH) pixels within
            // the texture, tiled horizontally.
            const frameW      = texH; // frames are square (height x height)
            const frameCount  = Math.floor(texW / frameW) || 1;
            const frameIndex  = entry.frameIndex % frameCount;
            const frameOffsetX = frameIndex * frameW;

            const sprW = entry.spriteWidth;
            const sprH = entry.spriteHeight;

            // Screen Y range.
            const drawStartY = halfH - (sprH >> 1);
            const drawEndY   = drawStartY + sprH;
            const clampStartY = drawStartY < 0 ? 0 : drawStartY;
            const clampEndY   = drawEndY > screenHeight ? screenHeight : drawEndY;

            // Screen X range.
            const drawStartX = entry.screenX - (sprW >> 1);
            const drawEndX   = drawStartX + sprW;
            const clampStartX = drawStartX < 0 ? 0 : drawStartX;
            const clampEndX   = drawEndX > screenWidth ? screenWidth : drawEndX;

            // Texture step sizes.
            const texStepX = frameW / sprW;
            const texStepY = texH / sprH;

            for (let x = clampStartX; x < clampEndX; x++) {
                // Depth test: skip this column if a wall is closer.
                if (entry.transformY >= depthBuffer[x]) continue;

                // Texture X within the frame.
                let tX = ((x - drawStartX) * texStepX) | 0;
                if (tX < 0) tX = 0;
                if (tX >= frameW) tX = frameW - 1;
                tX += frameOffsetX;

                // Starting texture Y, accounting for vertical clipping.
                let texPosY = (clampStartY - drawStartY) * texStepY;

                for (let y = clampStartY; y < clampEndY; y++) {
                    let tY = texPosY | 0;
                    if (tY >= texH) tY = texH - 1;
                    texPosY += texStepY;

                    // Sample the sprite texture.
                    const texIdx = (tY * texW + tX) << 2;
                    const a = texData[texIdx + 3];

                    // Skip fully transparent pixels.
                    if (a === 0) continue;

                    const r = texData[texIdx];
                    const g = texData[texIdx + 1];
                    const b = texData[texIdx + 2];

                    // Optional: apply distance darkening consistent with walls.
                    const brightness = clamp(1.0 - entry.transformY / 16.0, 0.0, 1.0);
                    const litR = (r * brightness) | 0;
                    const litG = (g * brightness) | 0;
                    const litB = (b * brightness) | 0;

                    // Write pixel.
                    const pixIdx = (y * screenWidth + x) << 2;
                    if (a === 255) {
                        // Fully opaque: overwrite directly.
                        pixels[pixIdx]     = litR;
                        pixels[pixIdx + 1] = litG;
                        pixels[pixIdx + 2] = litB;
                        pixels[pixIdx + 3] = 255;
                    } else {
                        // Semi-transparent: alpha blend with existing pixel.
                        const invA = 255 - a;
                        pixels[pixIdx]     = ((litR * a + pixels[pixIdx]     * invA) >> 8);
                        pixels[pixIdx + 1] = ((litG * a + pixels[pixIdx + 1] * invA) >> 8);
                        pixels[pixIdx + 2] = ((litB * a + pixels[pixIdx + 2] * invA) >> 8);
                        pixels[pixIdx + 3] = 255;
                    }
                }
            }
        }
    }
}
