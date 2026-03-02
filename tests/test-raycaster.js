// =============================================================================
// test-raycaster.js - Tests for src/engine/raycaster.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import {
    Raycaster,
    FIELDS_PER_COLUMN,
    OFF_PERP_DIST,
    OFF_TEX_ID,
    OFF_TEX_X,
    OFF_SIDE,
    OFF_MAP_X,
    OFF_MAP_Y,
} from '../src/engine/raycaster.js';
import { Camera } from '../src/engine/camera.js';

// =============================================================================
// Raycaster - constructor
// =============================================================================

describe('Raycaster - constructor', () => {
    it('stores the screen width', () => {
        const rc = new Raycaster(320);
        assert.equal(rc.screenWidth, 320);
    });

    it('allocates results buffer of correct size', () => {
        const rc = new Raycaster(320);
        assert.equal(rc.results.length, 320 * FIELDS_PER_COLUMN);
    });

    it('allocates depth buffer of correct size', () => {
        const rc = new Raycaster(320);
        assert.equal(rc.depthBuffer.length, 320);
    });

    it('results and depthBuffer are Float64Arrays', () => {
        const rc = new Raycaster(10);
        assert.ok(rc.results instanceof Float64Array);
        assert.ok(rc.depthBuffer instanceof Float64Array);
    });
});

// =============================================================================
// Raycaster - columnOffset
// =============================================================================

describe('Raycaster - columnOffset', () => {
    it('returns 0 for column 0', () => {
        const rc = new Raycaster(320);
        assert.equal(rc.columnOffset(0), 0);
    });

    it('returns FIELDS_PER_COLUMN for column 1', () => {
        const rc = new Raycaster(320);
        assert.equal(rc.columnOffset(1), FIELDS_PER_COLUMN);
    });

    it('returns correct offset for arbitrary column', () => {
        const rc = new Raycaster(320);
        assert.equal(rc.columnOffset(10), 10 * FIELDS_PER_COLUMN);
    });
});

// =============================================================================
// Field offset constants
// =============================================================================

describe('Raycaster - field offset constants', () => {
    it('FIELDS_PER_COLUMN is 6', () => {
        assert.equal(FIELDS_PER_COLUMN, 6);
    });

    it('field offsets have expected values', () => {
        assert.equal(OFF_PERP_DIST, 0);
        assert.equal(OFF_TEX_ID, 1);
        assert.equal(OFF_TEX_X, 2);
        assert.equal(OFF_SIDE, 3);
        assert.equal(OFF_MAP_X, 4);
        assert.equal(OFF_MAP_Y, 5);
    });
});

// =============================================================================
// Raycaster - castRays with a simple map
// =============================================================================

describe('Raycaster - castRays on a simple map', () => {
    // A 5x5 map with walls on the borders and empty interior:
    // 1 1 1 1 1
    // 1 0 0 0 1
    // 1 0 0 0 1
    // 1 0 0 0 1
    // 1 1 1 1 1
    const map = [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
    ];

    it('returns the depth buffer', () => {
        const rc = new Raycaster(10);
        // Camera at center of map, facing east (positive X)
        const cam = new Camera(2.5, 2.5, 1, 0);
        const db = rc.castRays(cam, map, 10);
        assert.ok(db instanceof Float64Array);
        assert.equal(db.length, 10);
    });

    it('all depth buffer values are positive', () => {
        const rc = new Raycaster(10);
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, 10);
        for (let i = 0; i < 10; i++) {
            assert.ok(rc.depthBuffer[i] > 0, `depthBuffer[${i}] should be positive, got ${rc.depthBuffer[i]}`);
        }
    });

    it('center column facing east hits wall at distance ~1.5 tiles', () => {
        const screenWidth = 10;
        const rc = new Raycaster(screenWidth);
        // Camera at (2.5, 2.5) facing east. Wall is at x=4 (tile 4), so
        // distance from 2.5 to the wall face at x=4 is 1.5.
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, screenWidth);

        // Center column (index 5) should be close to perpendicular distance of 1.5
        const centerCol = Math.floor(screenWidth / 2);
        const base = centerCol * FIELDS_PER_COLUMN;
        const perpDist = rc.results[base + OFF_PERP_DIST];
        assert.closeTo(perpDist, 1.5, 0.2);
    });

    it('hit texture ID is 1 (wall tiles are all value 1)', () => {
        const screenWidth = 10;
        const rc = new Raycaster(screenWidth);
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, screenWidth);

        const centerCol = Math.floor(screenWidth / 2);
        const base = centerCol * FIELDS_PER_COLUMN;
        assert.equal(rc.results[base + OFF_TEX_ID], 1);
    });

    it('texture X coordinate is between 0 and 1', () => {
        const screenWidth = 10;
        const rc = new Raycaster(screenWidth);
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, screenWidth);

        for (let x = 0; x < screenWidth; x++) {
            const base = x * FIELDS_PER_COLUMN;
            const texX = rc.results[base + OFF_TEX_X];
            assert.ok(texX >= 0 && texX <= 1, `texX for column ${x} should be in [0,1], got ${texX}`);
        }
    });

    it('side value is 0 or 1', () => {
        const screenWidth = 10;
        const rc = new Raycaster(screenWidth);
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, screenWidth);

        for (let x = 0; x < screenWidth; x++) {
            const base = x * FIELDS_PER_COLUMN;
            const side = rc.results[base + OFF_SIDE];
            assert.ok(side === 0 || side === 1, `side for column ${x} should be 0 or 1, got ${side}`);
        }
    });

    it('mapX and mapY are non-negative integers', () => {
        const screenWidth = 10;
        const rc = new Raycaster(screenWidth);
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, screenWidth);

        for (let x = 0; x < screenWidth; x++) {
            const base = x * FIELDS_PER_COLUMN;
            const hitMapX = rc.results[base + OFF_MAP_X];
            const hitMapY = rc.results[base + OFF_MAP_Y];
            assert.ok(hitMapX >= 0, `mapX for column ${x} should be non-negative`);
            assert.ok(hitMapY >= 0, `mapY for column ${x} should be non-negative`);
            assert.equal(hitMapX, Math.floor(hitMapX), `mapX for column ${x} should be integer`);
            assert.equal(hitMapY, Math.floor(hitMapY), `mapY for column ${x} should be integer`);
        }
    });

    it('depth buffer matches results buffer perpDistance', () => {
        const screenWidth = 10;
        const rc = new Raycaster(screenWidth);
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, screenWidth);

        for (let x = 0; x < screenWidth; x++) {
            const base = x * FIELDS_PER_COLUMN;
            assert.equal(
                rc.depthBuffer[x],
                rc.results[base + OFF_PERP_DIST],
                `depthBuffer[${x}] should match results perpDist`
            );
        }
    });
});

// =============================================================================
// Raycaster - facing different directions
// =============================================================================

describe('Raycaster - different camera orientations', () => {
    const map = [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
    ];

    it('facing north (negative Y) from center hits wall at ~1.5 tiles', () => {
        const rc = new Raycaster(10);
        // Camera at center facing north (dir = (0, -1))
        const cam = new Camera(2.5, 2.5, 0, -1);
        rc.castRays(cam, map, 10);

        const centerCol = 5;
        const base = centerCol * FIELDS_PER_COLUMN;
        const perpDist = rc.results[base + OFF_PERP_DIST];
        assert.closeTo(perpDist, 1.5, 0.2);
    });

    it('facing west (negative X) from center hits wall at ~1.5 tiles', () => {
        const rc = new Raycaster(10);
        const cam = new Camera(2.5, 2.5, -1, 0);
        rc.castRays(cam, map, 10);

        const centerCol = 5;
        const base = centerCol * FIELDS_PER_COLUMN;
        const perpDist = rc.results[base + OFF_PERP_DIST];
        assert.closeTo(perpDist, 1.5, 0.2);
    });

    it('close to a wall yields a short perpendicular distance', () => {
        const rc = new Raycaster(10);
        // Camera at (1.3, 2.5) facing west toward wall at x=0
        const cam = new Camera(1.3, 2.5, -1, 0);
        rc.castRays(cam, map, 10);

        const centerCol = 5;
        const base = centerCol * FIELDS_PER_COLUMN;
        const perpDist = rc.results[base + OFF_PERP_DIST];
        assert.ok(perpDist < 0.5, `should be close to wall, got ${perpDist}`);
    });
});

// =============================================================================
// Raycaster - mixed wall textures
// =============================================================================

describe('Raycaster - wall texture detection', () => {
    it('detects different wall tile IDs', () => {
        // Map with different wall textures
        const map = [
            [2, 2, 2, 2, 2],
            [3, 0, 0, 0, 4],
            [3, 0, 0, 0, 4],
            [3, 0, 0, 0, 4],
            [5, 5, 5, 5, 5],
        ];

        const rc = new Raycaster(10);
        // Camera at center facing east -> should hit texture 4
        const cam = new Camera(2.5, 2.5, 1, 0);
        rc.castRays(cam, map, 10);

        const centerCol = 5;
        const base = centerCol * FIELDS_PER_COLUMN;
        assert.equal(rc.results[base + OFF_TEX_ID], 4);
    });
});
