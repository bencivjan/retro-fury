// =============================================================================
// math.js - Pure math utility functions for RETRO FURY
// =============================================================================

const TWO_PI = Math.PI * 2;

// -----------------------------------------------------------------------------
// Vector2 Operations
// All vectors are plain { x, y } objects for simplicity and performance.
// Every function returns a new object; none mutate their arguments.
// -----------------------------------------------------------------------------

/**
 * Create a new 2D vector.
 * @param {number} [x=0]
 * @param {number} [y=0]
 * @returns {{ x: number, y: number }}
 */
export function vec2(x = 0, y = 0) {
    return { x, y };
}

/**
 * Add two vectors: a + b.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {{ x: number, y: number }}
 */
export function vec2Add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Subtract two vectors: a - b.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {{ x: number, y: number }}
 */
export function vec2Sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Multiply a vector by a scalar.
 * @param {{ x: number, y: number }} v
 * @param {number} s
 * @returns {{ x: number, y: number }}
 */
export function vec2Mul(v, s) {
    return { x: v.x * s, y: v.y * s };
}

/**
 * Return the length (magnitude) of a vector.
 * @param {{ x: number, y: number }} v
 * @returns {number}
 */
export function vec2Length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

/**
 * Return a unit-length vector pointing in the same direction.
 * Returns { x: 0, y: 0 } for zero-length input to avoid NaN.
 * @param {{ x: number, y: number }} v
 * @returns {{ x: number, y: number }}
 */
export function vec2Normalize(v) {
    const len = vec2Length(v);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
}

/**
 * Dot product of two vectors.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function vec2Dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

/**
 * Euclidean distance between two points.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function vec2Distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Rotate a vector by an angle (radians) around the origin.
 * @param {{ x: number, y: number }} v
 * @param {number} angle - Rotation in radians (counter-clockwise positive).
 * @returns {{ x: number, y: number }}
 */
export function vec2Rotate(v, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: v.x * cos - v.y * sin,
        y: v.x * sin + v.y * cos,
    };
}

// -----------------------------------------------------------------------------
// Angle Utilities
// -----------------------------------------------------------------------------

/**
 * Convert degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function degToRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 * @param {number} rad
 * @returns {number}
 */
export function radToDeg(rad) {
    return rad * (180 / Math.PI);
}

/**
 * Normalize an angle to the range [0, 2*PI).
 * @param {number} angle - Angle in radians.
 * @returns {number}
 */
export function normalizeAngle(angle) {
    angle = angle % TWO_PI;
    if (angle < 0) angle += TWO_PI;
    return angle;
}

// -----------------------------------------------------------------------------
// Scalar Utilities
// -----------------------------------------------------------------------------

/**
 * Linear interpolation from a to b by factor t.
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Interpolation factor (0 = a, 1 = b). Not clamped.
 * @returns {number}
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Clamp a value between min and max (inclusive).
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Return a random floating-point number in the range [min, max).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Return a random integer in the range [min, max] (inclusive on both ends).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
