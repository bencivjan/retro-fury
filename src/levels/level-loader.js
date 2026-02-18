// =============================================================================
// level-loader.js - Level data parser and initializer for RETRO FURY
// =============================================================================
// The LevelLoader reads a level data object (exported by each level module) and
// produces structured runtime objects: the tile map, door list, enemy spawn
// list, item spawn list, objective list, exit trigger, and palette config.
//
// Door tiles (9-12) are extracted from the map and replaced with 0 (empty) so
// the raycaster does not render them as walls -- doors are rendered separately
// by the door system.
//
// Level Data Format
// -----------------
// {
//     name:           string,
//     briefing:       string,
//     map:            number[][] (2D tile IDs),
//     playerStart:    { x: number, y: number, angle: number },
//     enemies:        [{ type: string, x: number, y: number }],
//     items:          [{ type: string|number, x: number, y: number }],
//     objectives:     [{ type: string, x: number, y: number, description: string }],
//     exitTrigger:    { x: number, y: number, requiredObjectives: number },
//     palette:        { ceiling: string, floor: string, fog: string },
//     parTime:        number (seconds),
//     hints:          [{ trigger: string, delay: number, text: string }],
//     bossSpawnPoints?: [{ x: number, y: number }],
// }
// =============================================================================

import { Door } from '../game/door.js';
import { ItemType } from '../game/item.js';

// -----------------------------------------------------------------------------
// Tile ID Constants
// -----------------------------------------------------------------------------

/** Tile IDs 1-8 are wall textures. */
const WALL_MIN = 1;
const WALL_MAX = 8;

/** Door tile IDs. */
const TILE_DOOR          = 9;
const TILE_LOCKED_BLUE   = 10;
const TILE_LOCKED_RED    = 11;
const TILE_LOCKED_YELLOW = 12;

// Mapping from door tile IDs to lock colors.
const DOOR_LOCK_COLORS = {
    [TILE_DOOR]:          null,
    [TILE_LOCKED_BLUE]:   'blue',
    [TILE_LOCKED_RED]:    'red',
    [TILE_LOCKED_YELLOW]: 'yellow',
};

// Mapping from door tile IDs to texture IDs for rendering.
const DOOR_TEXTURE_IDS = {
    [TILE_DOOR]:          7,   // Standard door texture.
    [TILE_LOCKED_BLUE]:   8,   // Blue-locked door texture.
    [TILE_LOCKED_RED]:    8,   // Red-locked door texture.
    [TILE_LOCKED_YELLOW]: 8,   // Yellow-locked door texture.
};

// Mapping from item type strings to ItemType enum values.
const ITEM_TYPE_MAP = {
    'HEALTH_SMALL':       ItemType.HEALTH_SMALL,
    'HEALTH_LARGE':       ItemType.HEALTH_LARGE,
    'ARMOR':              ItemType.ARMOR,
    'AMMO_BULLETS':       ItemType.AMMO_BULLETS,
    'AMMO_SHELLS':        ItemType.AMMO_SHELLS,
    'AMMO_ROCKETS':       ItemType.AMMO_ROCKETS,
    'AMMO_CELLS':         ItemType.AMMO_CELLS,
    'KEYCARD_BLUE':       ItemType.KEYCARD_BLUE,
    'KEYCARD_RED':        ItemType.KEYCARD_RED,
    'KEYCARD_YELLOW':     ItemType.KEYCARD_YELLOW,
    'WEAPON_SHOTGUN':     ItemType.WEAPON_SHOTGUN,
    'WEAPON_MACHINEGUN':  ItemType.WEAPON_MACHINEGUN,
    'WEAPON_ROCKET':      ItemType.WEAPON_ROCKET,
    'WEAPON_PLASMA':      ItemType.WEAPON_PLASMA,
    'OBJECTIVE_ITEM':     ItemType.OBJECTIVE_ITEM,
};

// =============================================================================
// LevelLoader Class
// =============================================================================

export class LevelLoader {
    // -------------------------------------------------------------------------
    // Load Level
    // -------------------------------------------------------------------------

    /**
     * Parse a level data object into structured runtime objects.
     *
     * @param {Object} levelData - The raw level data object exported by a level module.
     * @returns {{
     *   name: string,
     *   briefing: string,
     *   map: { grid: number[][], width: number, height: number },
     *   playerStart: { x: number, y: number, angle: number },
     *   enemies: Array<{ type: string, x: number, y: number }>,
     *   items: Array<{ type: number, x: number, y: number }>,
     *   doors: Door[],
     *   objectives: Array<{ type: string, x: number, y: number, description: string }>,
     *   exitTrigger: { x: number, y: number, requiredObjectives: number },
     *   palette: { ceiling: string, floor: string, fog: string },
     *   parTime: number,
     *   hints: Array<{ trigger: string, delay: number, text: string }>,
     *   bossSpawnPoints: Array<{ x: number, y: number }>,
     * }}
     * @throws {Error} If required fields are missing from the level data.
     */
    loadLevel(levelData) {
        this._validate(levelData);

        // Deep-copy the map grid so we can mutate it (replace door tiles).
        const grid = levelData.map.map(row => [...row]);
        const height = grid.length;
        const width = grid[0].length;

        // Extract doors from the map. Door tiles are replaced with 0 (empty).
        const doors = this._getDoors(grid, width, height);

        // Build the map object.
        const map = { grid, width, height };

        // Resolve item types from strings to ItemType enum values.
        const items = (levelData.items || []).map(item => ({
            type: this._resolveItemType(item.type),
            x: item.x,
            y: item.y,
        }));

        // Copy enemy spawn list.
        const enemies = (levelData.enemies || []).map(e => ({
            type: e.type,
            x: e.x,
            y: e.y,
        }));

        // Copy objectives.
        const objectives = (levelData.objectives || []).map(obj => ({
            type: obj.type,
            x: obj.x,
            y: obj.y,
            description: obj.description || '',
        }));

        // Copy exit trigger.
        const exitTrigger = levelData.exitTrigger
            ? { ...levelData.exitTrigger }
            : null;

        // Copy palette with defaults.
        const palette = {
            ceiling: '#1a1a1a',
            floor:   '#2a2a2a',
            fog:     '#000000',
            ...(levelData.palette || {}),
        };

        // Copy hints.
        const hints = (levelData.hints || []).map(h => ({ ...h }));

        // Boss spawn points (level 5).
        const bossSpawnPoints = (levelData.bossSpawnPoints || []).map(p => ({ ...p }));

        return {
            name: levelData.name,
            briefing: levelData.briefing || '',
            map,
            playerStart: { ...levelData.playerStart },
            enemies,
            items,
            doors,
            objectives,
            exitTrigger,
            palette,
            parTime: levelData.parTime || 300,
            hints,
            bossSpawnPoints,
        };
    }

    // -------------------------------------------------------------------------
    // Door Extraction
    // -------------------------------------------------------------------------

    /**
     * Scan the map grid for door tiles (IDs 9-12). For each door tile found,
     * create a Door object and replace the tile with 0 in the grid so the
     * raycaster does not treat it as a wall.
     *
     * @param {number[][]} grid - The mutable 2D map grid.
     * @param {number} width    - Map width in tiles.
     * @param {number} height   - Map height in tiles.
     * @returns {Door[]} Array of Door objects.
     */
    _getDoors(grid, width, height) {
        const doors = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = grid[y][x];

                if (tile >= TILE_DOOR && tile <= TILE_LOCKED_YELLOW) {
                    const lockColor = DOOR_LOCK_COLORS[tile] || null;
                    const textureId = DOOR_TEXTURE_IDS[tile] || 7;

                    doors.push(new Door(x, y, textureId, lockColor));

                    // Replace the door tile with empty so the raycaster skips it.
                    grid[y][x] = 0;
                }
            }
        }

        return doors;
    }

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    /**
     * Validate that the level data object has all required fields.
     *
     * @param {Object} data - The raw level data.
     * @throws {Error} If a required field is missing or invalid.
     * @private
     */
    _validate(data) {
        if (!data) {
            throw new Error('LevelLoader: level data is null or undefined.');
        }

        if (!data.name || typeof data.name !== 'string') {
            throw new Error('LevelLoader: level data must have a "name" string.');
        }

        if (!Array.isArray(data.map) || data.map.length === 0) {
            throw new Error('LevelLoader: level data must have a non-empty "map" 2D array.');
        }

        // Verify the map is a rectangular 2D array.
        const expectedWidth = data.map[0].length;
        for (let y = 0; y < data.map.length; y++) {
            if (!Array.isArray(data.map[y])) {
                throw new Error(`LevelLoader: map row ${y} is not an array.`);
            }
            if (data.map[y].length !== expectedWidth) {
                throw new Error(
                    `LevelLoader: map row ${y} has width ${data.map[y].length}, ` +
                    `expected ${expectedWidth}.`
                );
            }
        }

        if (!data.playerStart || typeof data.playerStart.x !== 'number' || typeof data.playerStart.y !== 'number') {
            throw new Error('LevelLoader: level data must have a "playerStart" with x and y.');
        }

        if (!data.exitTrigger || typeof data.exitTrigger.x !== 'number' || typeof data.exitTrigger.y !== 'number') {
            throw new Error('LevelLoader: level data must have an "exitTrigger" with x and y.');
        }
    }

    // -------------------------------------------------------------------------
    // Item Type Resolution
    // -------------------------------------------------------------------------

    /**
     * Resolve an item type from a string name or numeric value to an ItemType
     * enum value.
     *
     * @param {string|number} type - Item type string (e.g. 'HEALTH_SMALL') or
     *   numeric ItemType value.
     * @returns {number} ItemType enum value.
     * @private
     */
    _resolveItemType(type) {
        if (typeof type === 'number') return type;

        if (typeof type === 'string') {
            const resolved = ITEM_TYPE_MAP[type];
            if (resolved !== undefined) return resolved;

            console.warn(`LevelLoader: unknown item type string "${type}". Defaulting to HEALTH_SMALL.`);
            return ItemType.HEALTH_SMALL;
        }

        return ItemType.HEALTH_SMALL;
    }
}

// Export tile constants for external use (e.g., minimap, editor).
export {
    TILE_DOOR,
    TILE_LOCKED_BLUE,
    TILE_LOCKED_RED,
    TILE_LOCKED_YELLOW,
    WALL_MIN,
    WALL_MAX,
    ITEM_TYPE_MAP,
};
