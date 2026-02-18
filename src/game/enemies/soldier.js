// =============================================================================
// soldier.js - Soldier enemy factory for RETRO FURY
// =============================================================================
// Mid-tier tactical enemy. Soldiers are more accurate and durable than grunts,
// and they strafe left/right during combat to make themselves harder to hit.
// The strafing behavior is handled by the base Enemy class when
// behavior.strafes = true, alternating direction every 1-2 seconds.
// =============================================================================

import { Enemy } from '../enemy.js';
import { SOLDIER_BEHAVIOR } from '../../ai/behaviors.js';

/**
 * Create a Soldier enemy at the given position.
 *
 * Soldiers use the standard Enemy state machine with strafing enabled. The
 * ATTACK state detects behavior.strafes and applies lateral movement while
 * firing, making the soldier weave side to side during combat.
 *
 * @param {number} x - Starting X position in map coordinates.
 * @param {number} y - Starting Y position in map coordinates.
 * @returns {Enemy}
 */
export function createSoldier(x, y) {
    const soldier = new Enemy(x, y, 'soldier', SOLDIER_BEHAVIOR);

    // Soldiers start with a random strafe direction so groups of soldiers
    // don't all move in unison, creating a more dynamic firefight.
    soldier._strafeDir = Math.random() < 0.5 ? -1 : 1;

    return soldier;
}
