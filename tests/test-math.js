// =============================================================================
// test-math.js - Tests for src/utils/math.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import {
    vec2, vec2Add, vec2Sub, vec2Mul, vec2Length, vec2Normalize,
    vec2Dot, vec2Distance, vec2Rotate,
    degToRad, radToDeg, normalizeAngle,
    lerp, clamp,
} from '../src/utils/math.js';

// --- Vector operations -------------------------------------------------------

describe('vec2 - construction', () => {
    it('creates a vector with given components', () => {
        const v = vec2(3, 4);
        assert.equal(v.x, 3);
        assert.equal(v.y, 4);
    });

    it('defaults to zero vector', () => {
        const v = vec2();
        assert.equal(v.x, 0);
        assert.equal(v.y, 0);
    });
});

describe('vec2 - arithmetic', () => {
    it('adds two vectors', () => {
        assert.deepEqual(vec2Add(vec2(1, 2), vec2(3, 4)), { x: 4, y: 6 });
    });

    it('subtracts two vectors', () => {
        assert.deepEqual(vec2Sub(vec2(5, 7), vec2(2, 3)), { x: 3, y: 4 });
    });

    it('multiplies a vector by a scalar', () => {
        assert.deepEqual(vec2Mul(vec2(2, 3), 4), { x: 8, y: 12 });
    });

    it('computes vector length', () => {
        assert.equal(vec2Length(vec2(3, 4)), 5);
    });

    it('computes dot product', () => {
        assert.equal(vec2Dot(vec2(1, 0), vec2(0, 1)), 0);
        assert.equal(vec2Dot(vec2(2, 3), vec2(4, 5)), 23);
    });

    it('computes distance between two points', () => {
        assert.equal(vec2Distance(vec2(0, 0), vec2(3, 4)), 5);
    });
});

describe('vec2Normalize', () => {
    it('normalizes a non-zero vector to unit length', () => {
        const n = vec2Normalize(vec2(3, 4));
        assert.closeTo(n.x, 0.6);
        assert.closeTo(n.y, 0.8);
    });

    it('returns zero vector for zero-length input', () => {
        assert.deepEqual(vec2Normalize(vec2(0, 0)), { x: 0, y: 0 });
    });
});

describe('vec2Rotate', () => {
    it('rotates a vector by 90 degrees', () => {
        const r = vec2Rotate(vec2(1, 0), Math.PI / 2);
        assert.closeTo(r.x, 0, 1e-9);
        assert.closeTo(r.y, 1, 1e-9);
    });
});

// --- Angle utilities ---------------------------------------------------------

describe('angle conversions', () => {
    it('converts degrees to radians', () => {
        assert.closeTo(degToRad(180), Math.PI);
        assert.closeTo(degToRad(90), Math.PI / 2);
    });

    it('converts radians to degrees', () => {
        assert.closeTo(radToDeg(Math.PI), 180);
    });

    it('normalizes negative angles to [0, 2*PI)', () => {
        assert.closeTo(normalizeAngle(-Math.PI / 2), 3 * Math.PI / 2);
    });

    it('normalizes angles exceeding 2*PI', () => {
        assert.closeTo(normalizeAngle(3 * Math.PI), Math.PI, 1e-9);
    });
});

// --- Scalar utilities --------------------------------------------------------

describe('lerp', () => {
    it('returns start value at t=0', () => {
        assert.equal(lerp(10, 20, 0), 10);
    });

    it('returns end value at t=1', () => {
        assert.equal(lerp(10, 20, 1), 20);
    });

    it('returns midpoint at t=0.5', () => {
        assert.equal(lerp(0, 100, 0.5), 50);
    });
});

describe('clamp', () => {
    it('clamps below minimum', () => {
        assert.equal(clamp(-5, 0, 10), 0);
    });

    it('clamps above maximum', () => {
        assert.equal(clamp(15, 0, 10), 10);
    });

    it('returns value when within range', () => {
        assert.equal(clamp(5, 0, 10), 5);
    });
});
