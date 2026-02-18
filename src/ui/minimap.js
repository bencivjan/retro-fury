// =============================================================================
// minimap.js - Toggleable Minimap for RETRO FURY
// =============================================================================
// Renders a fog-of-war minimap in the top-right corner of the screen. Only
// tiles the player has explored (been within ~6 tiles of) are revealed. Shows
// the player as a green arrow, enemies as red dots, objectives as yellow
// diamonds, and the level exit as a green square.
// =============================================================================

import { clamp } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Minimap size in pixels. */
const MAP_SIZE = 64;

/** How many map tiles are visible in the minimap viewport. */
const VIEW_RANGE = 15;

/** Exploration reveal radius in tiles around the player. */
const EXPLORE_RADIUS = 6;

/** Pixel size of each tile on the minimap. */
const TILE_PX = MAP_SIZE / VIEW_RANGE;

/** Padding from the screen edge. */
const EDGE_PADDING = 10;

// =============================================================================
// Minimap Class
// =============================================================================

export class Minimap {
    /**
     * @param {number} screenWidth  - Canvas width in pixels.
     * @param {number} screenHeight - Canvas height in pixels.
     */
    constructor(screenWidth, screenHeight) {
        /** @type {number} */
        this.screenWidth = screenWidth;

        /** @type {number} */
        this.screenHeight = screenHeight;

        /** @type {boolean} Whether the minimap is currently visible. */
        this.visible = true;

        /**
         * @type {Set<string>} Set of explored tile keys ("x,y").
         * Tracks every tile the player has been near enough to reveal.
         */
        this._exploredTiles = new Set();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Render the minimap overlay.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ grid: number[][], width: number, height: number }} map
     * @param {import('../game/player.js').Player} player
     * @param {Array<{ pos: { x: number, y: number }, alive: boolean }>} enemies
     * @param {Array<{ x: number, y: number }>} objectives - Objective marker positions.
     * @param {{ x: number, y: number }|null} exitTrigger  - Exit position or null.
     * @param {Set<string>} [exploredTiles] - External explored tiles (overrides internal if provided).
     */
    render(ctx, map, player, enemies, objectives, exitTrigger, exploredTiles) {
        if (!this.visible) return;

        const explored = exploredTiles || this._exploredTiles;

        ctx.save();

        // -- Minimap position (top-right corner) --
        const originX = this.screenWidth - MAP_SIZE - EDGE_PADDING;
        const originY = EDGE_PADDING;

        // -- Semi-transparent background --
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(originX - 2, originY - 2, MAP_SIZE + 4, MAP_SIZE + 4);

        // Border.
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.strokeRect(originX - 2, originY - 2, MAP_SIZE + 4, MAP_SIZE + 4);

        // -- Clip to minimap area --
        ctx.beginPath();
        ctx.rect(originX, originY, MAP_SIZE, MAP_SIZE);
        ctx.clip();

        // Calculate the tile offset to center the map on the player.
        const halfView = VIEW_RANGE / 2;
        const camTileX = player.pos.x - halfView;
        const camTileY = player.pos.y - halfView;

        // -- Render tiles --
        const startTileX = Math.floor(camTileX);
        const startTileY = Math.floor(camTileY);
        const endTileX = startTileX + VIEW_RANGE + 2;
        const endTileY = startTileY + VIEW_RANGE + 2;

        for (let ty = startTileY; ty < endTileY; ty++) {
            for (let tx = startTileX; tx < endTileX; tx++) {
                // Fog of war: only render explored tiles.
                const key = `${tx},${ty}`;
                if (!explored.has(key)) continue;

                // Pixel position on the minimap.
                const px = originX + (tx - camTileX) * TILE_PX;
                const py = originY + (ty - camTileY) * TILE_PX;

                // Bounds check.
                if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) {
                    ctx.fillStyle = '#111111';
                    ctx.fillRect(px, py, TILE_PX + 0.5, TILE_PX + 0.5);
                    continue;
                }

                const tileVal = map.grid[ty][tx];

                if (tileVal > 0) {
                    // Wall tile - white/light grey.
                    ctx.fillStyle = '#AAAAAA';
                } else {
                    // Empty tile - dark grey.
                    ctx.fillStyle = '#222222';
                }

                ctx.fillRect(px, py, TILE_PX + 0.5, TILE_PX + 0.5);
            }
        }

        // -- Render exit trigger as green square --
        if (exitTrigger) {
            const exitKey = `${Math.floor(exitTrigger.x)},${Math.floor(exitTrigger.y)}`;
            if (explored.has(exitKey)) {
                const epx = originX + (exitTrigger.x - camTileX) * TILE_PX;
                const epy = originY + (exitTrigger.y - camTileY) * TILE_PX;

                ctx.fillStyle = '#00FF00';
                ctx.fillRect(
                    epx - TILE_PX * 0.5,
                    epy - TILE_PX * 0.5,
                    TILE_PX,
                    TILE_PX
                );
            }
        }

        // -- Render objective markers as yellow diamonds --
        if (objectives && objectives.length > 0) {
            for (const obj of objectives) {
                const objKey = `${Math.floor(obj.x)},${Math.floor(obj.y)}`;
                if (!explored.has(objKey)) continue;

                const opx = originX + (obj.x - camTileX) * TILE_PX;
                const opy = originY + (obj.y - camTileY) * TILE_PX;
                const ds = TILE_PX * 0.7;

                ctx.fillStyle = '#FFDD00';
                ctx.beginPath();
                ctx.moveTo(opx, opy - ds);
                ctx.lineTo(opx + ds, opy);
                ctx.lineTo(opx, opy + ds);
                ctx.lineTo(opx - ds, opy);
                ctx.closePath();
                ctx.fill();
            }
        }

        // -- Render enemy positions as red dots --
        if (enemies && enemies.length > 0) {
            for (const enemy of enemies) {
                // Skip dead enemies and those in their dying animation
                // (health <= 0 but alive flag still true during death anim).
                if (!enemy.alive || enemy.health <= 0) continue;

                // Only show enemies in explored areas.
                const eKey = `${Math.floor(enemy.pos.x)},${Math.floor(enemy.pos.y)}`;
                if (!explored.has(eKey)) continue;

                const epx = originX + (enemy.pos.x - camTileX) * TILE_PX;
                const epy = originY + (enemy.pos.y - camTileY) * TILE_PX;

                ctx.fillStyle = '#FF2222';
                ctx.beginPath();
                ctx.arc(epx, epy, TILE_PX * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // -- Render player as green arrow pointing in facing direction --
        this._renderPlayerArrow(ctx, originX, originY, camTileX, camTileY, player);

        ctx.restore();

        // -- "MAP" label below minimap (outside clip) --
        ctx.save();
        ctx.font = 'bold 7px "Courier New", Courier, monospace';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('MAP', originX + MAP_SIZE / 2, originY + MAP_SIZE + 4);
        ctx.restore();
    }

    /**
     * Toggle minimap visibility.
     */
    toggle() {
        this.visible = !this.visible;
    }

    /**
     * Mark tiles near the player's current position as explored.
     * Should be called every frame during gameplay.
     *
     * @param {number} playerX - Player X position in tile coordinates.
     * @param {number} playerY - Player Y position in tile coordinates.
     */
    updateExplored(playerX, playerY) {
        const cx = Math.floor(playerX);
        const cy = Math.floor(playerY);
        const r = EXPLORE_RADIUS;
        const rSq = r * r;

        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                // Circular reveal rather than square.
                if (dx * dx + dy * dy <= rSq) {
                    this._exploredTiles.add(`${cx + dx},${cy + dy}`);
                }
            }
        }
    }

    /**
     * Clear exploration data (for level transitions).
     */
    clearExplored() {
        this._exploredTiles.clear();
    }

    /**
     * Get the internal explored tiles set.
     * @returns {Set<string>}
     */
    getExploredTiles() {
        return this._exploredTiles;
    }

    /**
     * Update screen dimensions if the canvas is resized.
     *
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
    }

    // -------------------------------------------------------------------------
    // Internal: Player Arrow
    // -------------------------------------------------------------------------

    /**
     * Draw the player as a green arrow pointing in the facing direction.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} originX - Minimap origin X in screen pixels.
     * @param {number} originY - Minimap origin Y in screen pixels.
     * @param {number} camTileX - Camera tile X (top-left of minimap view).
     * @param {number} camTileY - Camera tile Y (top-left of minimap view).
     * @param {import('../game/player.js').Player} player
     * @private
     */
    _renderPlayerArrow(ctx, originX, originY, camTileX, camTileY, player) {
        const px = originX + (player.pos.x - camTileX) * TILE_PX;
        const py = originY + (player.pos.y - camTileY) * TILE_PX;
        const angle = player.angle;
        const arrowLen = TILE_PX * 1.2;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);

        // Arrow shape pointing right (angle 0 = east).
        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.moveTo(arrowLen, 0);                          // Tip.
        ctx.lineTo(-arrowLen * 0.5, -arrowLen * 0.5);     // Top-left.
        ctx.lineTo(-arrowLen * 0.2, 0);                   // Notch.
        ctx.lineTo(-arrowLen * 0.5, arrowLen * 0.5);      // Bottom-left.
        ctx.closePath();
        ctx.fill();

        // Arrow border.
        ctx.strokeStyle = '#00AA00';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}
