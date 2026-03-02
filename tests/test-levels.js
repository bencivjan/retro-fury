// =============================================================================
// test-levels.js - Tests for src/levels/level-loader.js and level1.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import {
    LevelLoader,
    TILE_DOOR,
    TILE_LOCKED_BLUE,
    TILE_LOCKED_RED,
    TILE_LOCKED_YELLOW,
    WALL_MIN,
    WALL_MAX,
    ITEM_TYPE_MAP,
} from '../src/levels/level-loader.js';
import level1 from '../src/levels/level1.js';
import { DoorState } from '../src/game/door.js';
import { ItemType } from '../src/game/item.js';

// =============================================================================
// level1 data structure
// =============================================================================

describe('level1 - required fields', () => {
    it('has a name string', () => {
        assert.ok(typeof level1.name === 'string');
        assert.ok(level1.name.length > 0);
    });

    it('name is "Infiltration"', () => {
        assert.equal(level1.name, 'Infiltration');
    });

    it('has a briefing string', () => {
        assert.ok(typeof level1.briefing === 'string');
        assert.ok(level1.briefing.length > 0);
    });

    it('has a 2D map array', () => {
        assert.ok(Array.isArray(level1.map));
        assert.ok(level1.map.length > 0);
        assert.ok(Array.isArray(level1.map[0]));
    });

    it('map is 32x32', () => {
        assert.equal(level1.map.length, 32);
        for (let y = 0; y < 32; y++) {
            assert.equal(level1.map[y].length, 32, `row ${y} should have 32 columns`);
        }
    });

    it('has playerStart with x, y, and angle', () => {
        assert.ok(level1.playerStart);
        assert.ok(typeof level1.playerStart.x === 'number');
        assert.ok(typeof level1.playerStart.y === 'number');
        assert.ok(typeof level1.playerStart.angle === 'number');
    });

    it('has an enemies array', () => {
        assert.ok(Array.isArray(level1.enemies));
        assert.ok(level1.enemies.length > 0);
    });

    it('has an items array', () => {
        assert.ok(Array.isArray(level1.items));
        assert.ok(level1.items.length > 0);
    });

    it('has an objectives array', () => {
        assert.ok(Array.isArray(level1.objectives));
        assert.ok(level1.objectives.length > 0);
    });

    it('has an exitTrigger with x and y', () => {
        assert.ok(level1.exitTrigger);
        assert.ok(typeof level1.exitTrigger.x === 'number');
        assert.ok(typeof level1.exitTrigger.y === 'number');
    });

    it('has a palette with ceiling, floor, and fog', () => {
        assert.ok(level1.palette);
        assert.ok(typeof level1.palette.ceiling === 'string');
        assert.ok(typeof level1.palette.floor === 'string');
        assert.ok(typeof level1.palette.fog === 'string');
    });

    it('has a parTime', () => {
        assert.ok(typeof level1.parTime === 'number');
        assert.equal(level1.parTime, 180);
    });

    it('has a hints array', () => {
        assert.ok(Array.isArray(level1.hints));
        assert.ok(level1.hints.length > 0);
    });
});

describe('level1 - enemy data', () => {
    it('all enemies have type, x, and y', () => {
        for (const e of level1.enemies) {
            assert.ok(typeof e.type === 'string', 'enemy type should be string');
            assert.ok(typeof e.x === 'number', 'enemy x should be number');
            assert.ok(typeof e.y === 'number', 'enemy y should be number');
        }
    });

    it('level1 has 10 grunts', () => {
        const grunts = level1.enemies.filter(e => e.type === 'grunt');
        assert.equal(grunts.length, 10);
    });
});

describe('level1 - item data', () => {
    it('all items have type, x, and y', () => {
        for (const item of level1.items) {
            assert.ok(item.type !== undefined, 'item type should be defined');
            assert.ok(typeof item.x === 'number', 'item x should be number');
            assert.ok(typeof item.y === 'number', 'item y should be number');
        }
    });

    it('includes a blue keycard', () => {
        const keycards = level1.items.filter(i => i.type === 'KEYCARD_BLUE');
        assert.ok(keycards.length >= 1);
    });

    it('includes a shotgun pickup', () => {
        const shotguns = level1.items.filter(i => i.type === 'WEAPON_SHOTGUN');
        assert.ok(shotguns.length >= 1);
    });
});

describe('level1 - map contains door tiles', () => {
    it('has at least one unlocked door tile (9)', () => {
        let found = false;
        for (const row of level1.map) {
            if (row.includes(TILE_DOOR)) { found = true; break; }
        }
        assert.ok(found, 'should have at least one tile value 9 (unlocked door)');
    });

    it('has at least one blue-locked door tile (10)', () => {
        let found = false;
        for (const row of level1.map) {
            if (row.includes(TILE_LOCKED_BLUE)) { found = true; break; }
        }
        assert.ok(found, 'should have at least one tile value 10 (blue-locked door)');
    });
});

// =============================================================================
// LevelLoader - loadLevel
// =============================================================================

describe('LevelLoader - loadLevel returns correct structure', () => {
    const loader = new LevelLoader();
    const loaded = loader.loadLevel(level1);

    it('returns the level name', () => {
        assert.equal(loaded.name, 'Infiltration');
    });

    it('returns the briefing', () => {
        assert.ok(loaded.briefing.length > 0);
    });

    it('returns a map object with grid, width, height', () => {
        assert.ok(loaded.map);
        assert.ok(Array.isArray(loaded.map.grid));
        assert.equal(loaded.map.width, 32);
        assert.equal(loaded.map.height, 32);
    });

    it('returns playerStart', () => {
        assert.ok(loaded.playerStart);
        assert.closeTo(loaded.playerStart.x, 16.5, 0.01);
        assert.closeTo(loaded.playerStart.y, 30.5, 0.01);
    });

    it('returns enemies array', () => {
        assert.ok(Array.isArray(loaded.enemies));
        assert.equal(loaded.enemies.length, level1.enemies.length);
    });

    it('returns items with resolved numeric types', () => {
        assert.ok(Array.isArray(loaded.items));
        for (const item of loaded.items) {
            assert.ok(typeof item.type === 'number', 'item type should be resolved to a number');
        }
    });

    it('returns doors array', () => {
        assert.ok(Array.isArray(loaded.doors));
        assert.ok(loaded.doors.length > 0, 'level1 should have doors');
    });

    it('returns objectives array', () => {
        assert.ok(Array.isArray(loaded.objectives));
    });

    it('returns exitTrigger', () => {
        assert.ok(loaded.exitTrigger);
        assert.ok(typeof loaded.exitTrigger.x === 'number');
    });

    it('returns palette with defaults', () => {
        assert.ok(loaded.palette);
        assert.ok(typeof loaded.palette.ceiling === 'string');
        assert.ok(typeof loaded.palette.floor === 'string');
        assert.ok(typeof loaded.palette.fog === 'string');
    });

    it('returns parTime', () => {
        assert.equal(loaded.parTime, 180);
    });

    it('returns hints', () => {
        assert.ok(Array.isArray(loaded.hints));
    });
});

// =============================================================================
// LevelLoader - door extraction
// =============================================================================

describe('LevelLoader - door extraction from map', () => {
    it('replaces door tiles with 0 in the grid', () => {
        const loader = new LevelLoader();
        const loaded = loader.loadLevel(level1);

        // After loading, the grid should have no door tile values (9-12)
        for (let y = 0; y < loaded.map.height; y++) {
            for (let x = 0; x < loaded.map.width; x++) {
                const tile = loaded.map.grid[y][x];
                assert.ok(
                    tile < TILE_DOOR || tile > TILE_LOCKED_YELLOW,
                    `grid[${y}][${x}] should not be a door tile (${tile})`
                );
            }
        }
    });

    it('creates Door objects for each door tile found', () => {
        const loader = new LevelLoader();
        const loaded = loader.loadLevel(level1);

        for (const door of loaded.doors) {
            assert.ok(typeof door.x === 'number');
            assert.ok(typeof door.y === 'number');
            assert.equal(door.state, DoorState.CLOSED);
        }
    });

    it('assigns correct lock colors to doors', () => {
        const loader = new LevelLoader();
        const loaded = loader.loadLevel(level1);

        // There should be at least one blue-locked door
        const blueDoors = loaded.doors.filter(d => d.lockColor === 'blue');
        assert.ok(blueDoors.length >= 1, 'should have at least one blue-locked door');

        // There should be unlocked doors too
        const unlockedDoors = loaded.doors.filter(d => d.lockColor === null);
        assert.ok(unlockedDoors.length >= 1, 'should have at least one unlocked door');
    });
});

// =============================================================================
// LevelLoader - item type resolution
// =============================================================================

describe('LevelLoader - item type resolution', () => {
    it('resolves string item types to numeric values', () => {
        const loader = new LevelLoader();
        const loaded = loader.loadLevel(level1);

        // Find the KEYCARD_BLUE item
        const blueKeycard = loaded.items.find(i => i.type === ItemType.KEYCARD_BLUE);
        assert.ok(blueKeycard, 'should have a resolved KEYCARD_BLUE item');
    });

    it('passes through numeric item types unchanged', () => {
        const loader = new LevelLoader();
        const testLevel = {
            name: 'Test',
            map: [[0, 0], [0, 0]],
            playerStart: { x: 0.5, y: 0.5, angle: 0 },
            exitTrigger: { x: 1.5, y: 1.5 },
            items: [{ type: ItemType.HEALTH_SMALL, x: 1, y: 1 }],
        };
        const loaded = loader.loadLevel(testLevel);
        assert.equal(loaded.items[0].type, ItemType.HEALTH_SMALL);
    });
});

// =============================================================================
// ITEM_TYPE_MAP coverage
// =============================================================================

describe('ITEM_TYPE_MAP', () => {
    it('maps all string names to ItemType values', () => {
        assert.equal(ITEM_TYPE_MAP['HEALTH_SMALL'], ItemType.HEALTH_SMALL);
        assert.equal(ITEM_TYPE_MAP['HEALTH_LARGE'], ItemType.HEALTH_LARGE);
        assert.equal(ITEM_TYPE_MAP['ARMOR'], ItemType.ARMOR);
        assert.equal(ITEM_TYPE_MAP['AMMO_BULLETS'], ItemType.AMMO_BULLETS);
        assert.equal(ITEM_TYPE_MAP['AMMO_SHELLS'], ItemType.AMMO_SHELLS);
        assert.equal(ITEM_TYPE_MAP['AMMO_ROCKETS'], ItemType.AMMO_ROCKETS);
        assert.equal(ITEM_TYPE_MAP['AMMO_CELLS'], ItemType.AMMO_CELLS);
        assert.equal(ITEM_TYPE_MAP['KEYCARD_BLUE'], ItemType.KEYCARD_BLUE);
        assert.equal(ITEM_TYPE_MAP['KEYCARD_RED'], ItemType.KEYCARD_RED);
        assert.equal(ITEM_TYPE_MAP['KEYCARD_YELLOW'], ItemType.KEYCARD_YELLOW);
        assert.equal(ITEM_TYPE_MAP['WEAPON_SHOTGUN'], ItemType.WEAPON_SHOTGUN);
        assert.equal(ITEM_TYPE_MAP['WEAPON_MACHINEGUN'], ItemType.WEAPON_MACHINEGUN);
        assert.equal(ITEM_TYPE_MAP['WEAPON_ROCKET'], ItemType.WEAPON_ROCKET);
        assert.equal(ITEM_TYPE_MAP['WEAPON_PLASMA'], ItemType.WEAPON_PLASMA);
        assert.equal(ITEM_TYPE_MAP['OBJECTIVE_ITEM'], ItemType.OBJECTIVE_ITEM);
    });
});

// =============================================================================
// LevelLoader - validation
// =============================================================================

describe('LevelLoader - validation', () => {
    const loader = new LevelLoader();

    it('throws on null data', () => {
        assert.throws(() => loader.loadLevel(null));
    });

    it('throws on undefined data', () => {
        assert.throws(() => loader.loadLevel(undefined));
    });

    it('throws when name is missing', () => {
        assert.throws(() => loader.loadLevel({
            map: [[0]],
            playerStart: { x: 0, y: 0 },
            exitTrigger: { x: 0, y: 0 },
        }));
    });

    it('throws when map is missing', () => {
        assert.throws(() => loader.loadLevel({
            name: 'Test',
            playerStart: { x: 0, y: 0 },
            exitTrigger: { x: 0, y: 0 },
        }));
    });

    it('throws when map is empty', () => {
        assert.throws(() => loader.loadLevel({
            name: 'Test',
            map: [],
            playerStart: { x: 0, y: 0 },
            exitTrigger: { x: 0, y: 0 },
        }));
    });

    it('throws when playerStart is missing', () => {
        assert.throws(() => loader.loadLevel({
            name: 'Test',
            map: [[0]],
            exitTrigger: { x: 0, y: 0 },
        }));
    });

    it('throws when exitTrigger is missing', () => {
        assert.throws(() => loader.loadLevel({
            name: 'Test',
            map: [[0]],
            playerStart: { x: 0, y: 0 },
        }));
    });

    it('throws when map rows have inconsistent widths', () => {
        assert.throws(() => loader.loadLevel({
            name: 'Test',
            map: [[0, 0], [0]],
            playerStart: { x: 0, y: 0 },
            exitTrigger: { x: 0, y: 0 },
        }));
    });
});

// =============================================================================
// LevelLoader - deep copy isolation
// =============================================================================

describe('LevelLoader - does not mutate original level data', () => {
    it('original map is unchanged after loading', () => {
        const loader = new LevelLoader();
        // Count original door tiles
        let originalDoorCount = 0;
        for (const row of level1.map) {
            for (const tile of row) {
                if (tile >= TILE_DOOR && tile <= TILE_LOCKED_YELLOW) {
                    originalDoorCount++;
                }
            }
        }

        loader.loadLevel(level1);

        // Count door tiles again - should be same
        let afterDoorCount = 0;
        for (const row of level1.map) {
            for (const tile of row) {
                if (tile >= TILE_DOOR && tile <= TILE_LOCKED_YELLOW) {
                    afterDoorCount++;
                }
            }
        }

        assert.equal(afterDoorCount, originalDoorCount, 'original map should not be mutated');
    });
});

// =============================================================================
// Tile constants
// =============================================================================

describe('Tile constants', () => {
    it('WALL_MIN is 1', () => {
        assert.equal(WALL_MIN, 1);
    });

    it('WALL_MAX is 8', () => {
        assert.equal(WALL_MAX, 8);
    });

    it('TILE_DOOR is 9', () => {
        assert.equal(TILE_DOOR, 9);
    });

    it('TILE_LOCKED_BLUE is 10', () => {
        assert.equal(TILE_LOCKED_BLUE, 10);
    });

    it('TILE_LOCKED_RED is 11', () => {
        assert.equal(TILE_LOCKED_RED, 11);
    });

    it('TILE_LOCKED_YELLOW is 12', () => {
        assert.equal(TILE_LOCKED_YELLOW, 12);
    });
});
