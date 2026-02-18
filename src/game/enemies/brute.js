// =============================================================================
// brute.js - Brute enemy factory for RETRO FURY
// =============================================================================
// Massive bullet-sponge tank. Brutes are slow, inaccurate, but have an
// enormous HP pool and fire constantly. The player has to dump significant
// ammo into them, and the sustained chip damage adds up. They use a larger
// collision radius and render scale to communicate their imposing presence.
// =============================================================================

import { Enemy } from '../enemy.js';
import { BRUTE_BEHAVIOR } from '../../ai/behaviors.js';

/**
 * Create a Brute enemy at the given position.
 *
 * Brutes use the standard Enemy state machine with a larger collision radius
 * (0.45 = DEFAULT_RADIUS * scale 1.5) and render scale. Their high HP and
 * near-zero pain chance means they almost never flinch, marching relentlessly
 * toward the player while suppressing them with constant gunfire.
 *
 * @param {number} x - Starting X position in map coordinates.
 * @param {number} y - Starting Y position in map coordinates.
 * @returns {Enemy}
 */
export function createBrute(x, y) {
    const brute = new Enemy(x, y, 'brute', BRUTE_BEHAVIOR);

    // Brute uses an explicitly larger collision radius for both physics and
    // hitscan detection. This is also set in the Enemy constructor from
    // behavior.scale, but we reinforce it here for clarity.
    brute.radius = 0.5;

    return brute;
}
