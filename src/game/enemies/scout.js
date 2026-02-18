// =============================================================================
// scout.js - Scout enemy factory for RETRO FURY
// =============================================================================
// Glass-cannon speedster. Scouts are extremely fast but fragile, rushing the
// player with a zigzag movement pattern that makes them hard to hit. They deal
// heavy damage at close range. The zigzag behavior is handled by the base
// Enemy class when behavior.zigzag = true.
//
// Scouts should terrify the player -- you hear fast footsteps, look around,
// and one is already in your face dealing 15 damage per hit.
// =============================================================================

import { Enemy } from '../enemy.js';
import { SCOUT_BEHAVIOR } from '../../ai/behaviors.js';

/**
 * Create a Scout enemy at the given position.
 *
 * Scouts use the standard Enemy state machine with zigzag chasing enabled.
 * The CHASE state detects behavior.zigzag and offsets the movement target
 * with a sinusoidal perpendicular displacement, creating an evasive S-curve.
 *
 * @param {number} x - Starting X position in map coordinates.
 * @param {number} y - Starting Y position in map coordinates.
 * @returns {Enemy}
 */
export function createScout(x, y) {
    const scout = new Enemy(x, y, 'scout', SCOUT_BEHAVIOR);

    // Randomize the initial zigzag phase so scouts don't all weave in sync.
    scout._zigzagPhase = Math.random() * Math.PI * 2;

    return scout;
}
