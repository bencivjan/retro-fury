// =============================================================================
// renderer.js - Canvas rendering orchestrator for RETRO FURY
// =============================================================================
// Owns the ImageData frame buffer and draws the scene (ceiling, floor, walls,
// sprites) into it every frame.  All pixel writes go through the ImageData
// buffer and are flushed to the canvas with a single putImageData call,
// which is significantly faster than per-pixel fillRect calls.
// =============================================================================

import { clamp } from '../utils/math.js';
import {
    FIELDS_PER_COLUMN,
    OFF_PERP_DIST,
    OFF_TEX_ID,
    OFF_TEX_X,
    OFF_SIDE,
} from './raycaster.js';

/**
 * Standard texture size assumed by the wall renderer.
 * All wall textures are expected to be 64x64 pixels.
 */
const TEX_SIZE = 64;

/**
 * Maximum distance at which walls fade to full black.
 * Walls at this distance or further receive zero light.
 */
const MAX_LIGHT_DIST = 16.0;

/**
 * Darkening factor applied to East/West (side=1) wall faces to simulate
 * directional lighting.  1.0 = no extra darkening, lower = darker.
 */
const EW_SHADE = 0.7;

export class Renderer {
    /**
     * @param {CanvasRenderingContext2D} ctx - The offscreen buffer context.
     * @param {number} screenWidth  - Internal resolution width (e.g. 320).
     * @param {number} screenHeight - Internal resolution height (e.g. 200).
     */
    constructor(ctx, screenWidth, screenHeight) {
        /** @type {CanvasRenderingContext2D} */
        this.ctx = ctx;

        /** @type {number} */
        this.screenWidth = screenWidth;

        /** @type {number} */
        this.screenHeight = screenHeight;

        /**
         * The ImageData buffer that the renderer writes pixels into.
         * This is created once and reused every frame.
         * @type {ImageData}
         */
        this.imageData = ctx.createImageData(screenWidth, screenHeight);

        /**
         * Uint8ClampedArray view of the pixel data (RGBA, 4 bytes per pixel).
         * @type {Uint8ClampedArray}
         */
        this.pixels = this.imageData.data;

        /**
         * Uint32Array view of the same underlying buffer for fast whole-pixel
         * writes (one 32-bit write instead of four 8-bit writes).
         * The byte order is platform-endian; on little-endian systems a pixel
         * is stored as 0xAABBGGRR.
         * @type {Uint32Array}
         */
        this.pixels32 = new Uint32Array(this.imageData.data.buffer);

        /**
         * Detect endianness so we can pack RGBA into a Uint32 correctly.
         * Almost all consumer hardware is little-endian, but we handle both.
         * @type {boolean}
         */
        this._littleEndian = this._detectEndianness();
    }

    // -------------------------------------------------------------------------
    // Frame Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Clear the frame buffer to solid black (fully opaque).
     */
    clear() {
        this.pixels32.fill(this._packColor(0, 0, 0, 255));
    }

    /**
     * Flush the ImageData buffer to the canvas.  Call once at the end of
     * each frame after all draw calls have completed.
     */
    present() {
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    // -------------------------------------------------------------------------
    // Scene Drawing
    // -------------------------------------------------------------------------

    /**
     * Draw a flat-colored ceiling (top half) and floor (bottom half).
     *
     * @param {{ ceiling: string, floor: string }} palette
     *   CSS color strings (e.g. '#333' for ceiling, '#555' for floor).
     *   Internally converted to packed RGBA once per call.
     */
    drawCeilingAndFloor(palette, horizonOffset = 0) {
        const w  = this.screenWidth;
        const h  = this.screenHeight;
        const p  = this.pixels32;
        const mid = (h >> 1) + horizonOffset;

        // Parse base colors into components for gradient blending.
        const ceilRGB  = this._cssToRGB(palette.ceiling);
        const floorRGB = this._cssToRGB(palette.floor);

        // Clamp mid to valid range.
        const clampedMid = mid < 0 ? 0 : (mid > h ? h : mid);
        const halfH = h >> 1;

        // Top half: ceiling - darkens toward the top (farther away).
        for (let y = 0; y < clampedMid; y++) {
            const distFromHorizon = clampedMid - y;
            const shade = Math.max(0.25, 1.0 - (distFromHorizon / halfH) * 0.65);
            const color = this._packColor(
                (ceilRGB.r * shade) | 0,
                (ceilRGB.g * shade) | 0,
                (ceilRGB.b * shade) | 0,
                255
            );
            const rowStart = y * w;
            for (let x = 0; x < w; x++) {
                p[rowStart + x] = color;
            }
        }

        // Bottom half: floor - darkens toward the bottom (farther away).
        for (let y = clampedMid; y < h; y++) {
            const distFromHorizon = y - clampedMid;
            const shade = Math.max(0.25, 1.0 - (distFromHorizon / halfH) * 0.65);
            const color = this._packColor(
                (floorRGB.r * shade) | 0,
                (floorRGB.g * shade) | 0,
                (floorRGB.b * shade) | 0,
                255
            );
            const rowStart = y * w;
            for (let x = 0; x < w; x++) {
                p[rowStart + x] = color;
            }
        }
    }

    /**
     * Render wall columns from raycaster results.
     *
     * For each screen column the renderer calculates the projected wall strip
     * height, samples the appropriate wall texture column, applies distance-
     * based darkening and side-based shading, and writes the pixels directly
     * into the ImageData buffer.
     *
     * @param {Float64Array} rayResults - Flat raycaster results buffer.
     * @param {Map<number, ImageData>|Object} textures
     *   Texture map keyed by texture ID.  Each value must have a `data`
     *   Uint8ClampedArray (RGBA) and be TEX_SIZE x TEX_SIZE.
     * @param {number} screenWidth
     * @param {number} screenHeight
     */
    drawWalls(rayResults, textures, screenWidth, screenHeight, horizonOffset = 0) {
        const pixels  = this.pixels;
        const halfH   = (screenHeight >> 1) + horizonOffset;
        const sw4     = screenWidth << 2; // screenWidth * 4 (bytes per row in pixels[])

        for (let x = 0; x < screenWidth; x++) {
            const base     = x * FIELDS_PER_COLUMN;
            const perpDist = rayResults[base + OFF_PERP_DIST];
            const texId    = rayResults[base + OFF_TEX_ID];
            const texX     = rayResults[base + OFF_TEX_X];
            const side     = rayResults[base + OFF_SIDE];

            // ---- Projected wall height ----
            const lineHeight = Math.floor(screenHeight / perpDist);
            let drawStart = halfH - (lineHeight >> 1);
            let drawEnd   = drawStart + lineHeight;

            // Clamp to screen bounds.
            const clampedStart = drawStart < 0 ? 0 : drawStart;
            const clampedEnd   = drawEnd > screenHeight ? screenHeight : drawEnd;

            // ---- Texture sampling setup ----
            // texColumn: which column of the texture to sample.
            let texColumn = (texX * TEX_SIZE) | 0;
            if (texColumn >= TEX_SIZE) texColumn = TEX_SIZE - 1;

            // Retrieve the texture pixel data.
            const texture = textures[texId] || textures[1]; // fallback to texture 1
            const texData = texture ? texture.data : null;

            // ---- Brightness factor ----
            // Distance-based darkening: 1.0 at distance 0, 0.0 at MAX_LIGHT_DIST.
            let brightness = 1.0 - (perpDist / MAX_LIGHT_DIST);
            if (brightness < 0.0) brightness = 0.0;
            if (brightness > 1.0) brightness = 1.0;

            // East/West faces are slightly darker to give a sense of directional light.
            if (side === 1) brightness *= EW_SHADE;

            // ---- Draw the vertical strip ----
            if (texData) {
                // step: how much to advance in texture-Y per screen pixel.
                const step = TEX_SIZE / lineHeight;
                // texPos: starting texture Y coordinate, accounting for the
                // clipped portion if drawStart is above the screen.
                let texPos = (clampedStart - drawStart) * step;

                for (let y = clampedStart; y < clampedEnd; y++) {
                    // Texture Y coordinate (clamped to valid range).
                    let texY = texPos | 0;
                    if (texY >= TEX_SIZE) texY = TEX_SIZE - 1;
                    texPos += step;

                    // Sample the texture (RGBA layout, row-major).
                    const texIdx = (texY * TEX_SIZE + texColumn) << 2;
                    const r = texData[texIdx];
                    const g = texData[texIdx + 1];
                    const b = texData[texIdx + 2];

                    // Apply brightness.
                    const litR = (r * brightness) | 0;
                    const litG = (g * brightness) | 0;
                    const litB = (b * brightness) | 0;

                    // Write to the ImageData pixel buffer.
                    const pixIdx = (y * screenWidth + x) << 2;
                    pixels[pixIdx]     = litR;
                    pixels[pixIdx + 1] = litG;
                    pixels[pixIdx + 2] = litB;
                    pixels[pixIdx + 3] = 255;
                }
            } else {
                // No texture available: draw a solid magenta strip (debug color).
                const fallbackR = (255 * brightness) | 0;
                const fallbackB = (255 * brightness) | 0;
                for (let y = clampedStart; y < clampedEnd; y++) {
                    const pixIdx = (y * screenWidth + x) << 2;
                    pixels[pixIdx]     = fallbackR;
                    pixels[pixIdx + 1] = 0;
                    pixels[pixIdx + 2] = fallbackB;
                    pixels[pixIdx + 3] = 255;
                }
            }
        }
    }

    /**
     * Placeholder for sprite rendering.  The actual implementation lives in
     * sprite.js (SpriteRenderer); this method exists so calling code can
     * treat the renderer as a single facade.
     *
     * @param {Array} sprites        - World sprite objects.
     * @param {import('./camera.js').Camera} camera
     * @param {Float64Array} depthBuffer
     * @param {Object} textures
     * @param {number} screenWidth
     * @param {number} screenHeight
     */
    drawSprites(sprites, camera, depthBuffer, textures, screenWidth, screenHeight) {
        // Implemented by SpriteRenderer.render() -- see sprite.js.
        // This placeholder is intentionally empty.
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    /**
     * Detect platform byte order.
     * @returns {boolean} True if the system is little-endian.
     * @private
     */
    _detectEndianness() {
        const buf = new ArrayBuffer(4);
        new Uint32Array(buf)[0] = 0x01020304;
        return new Uint8Array(buf)[0] === 0x04;
    }

    /**
     * Pack RGBA into a single Uint32 value, respecting platform endianness.
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @param {number} a
     * @returns {number}
     * @private
     */
    _packColor(r, g, b, a) {
        if (this._littleEndian) {
            // ABGR layout in memory
            return (a << 24) | (b << 16) | (g << 8) | r;
        }
        // RGBA layout in memory (big-endian)
        return (r << 24) | (g << 16) | (b << 8) | a;
    }

    /**
     * Parse a CSS hex color string and return a packed Uint32 color.
     * Supports '#RGB', '#RRGGBB', and '#RRGGBBAA' formats.
     *
     * @param {string} css - CSS hex color string.
     * @returns {number} Packed Uint32 color.
     * @private
     */
    _cssToPackedColor(css) {
        let hex = css.replace('#', '');

        // Expand shorthand (#RGB -> #RRGGBB).
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        const val = parseInt(hex, 16);
        let r, g, b, a;

        if (hex.length === 8) {
            r = (val >>> 24) & 0xFF;
            g = (val >>> 16) & 0xFF;
            b = (val >>> 8)  & 0xFF;
            a = val & 0xFF;
        } else {
            r = (val >>> 16) & 0xFF;
            g = (val >>> 8)  & 0xFF;
            b = val & 0xFF;
            a = 255;
        }

        return this._packColor(r, g, b, a);
    }

    /**
     * Parse a CSS hex color string and return an {r, g, b} object.
     *
     * @param {string} css - CSS hex color string.
     * @returns {{ r: number, g: number, b: number }}
     * @private
     */
    _cssToRGB(css) {
        let hex = css.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const val = parseInt(hex, 16);
        return {
            r: (val >>> 16) & 0xFF,
            g: (val >>> 8) & 0xFF,
            b: val & 0xFF,
        };
    }
}
