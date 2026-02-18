// =============================================================================
// grunt.js - Grunt enemy factory for RETRO FURY
// =============================================================================
// The lowest-tier enemy. Grunts are slow, inaccurate, and fragile -- classic
// cannon fodder that the player mows down in groups. They use the standard
// Enemy AI with no special overrides.
// =============================================================================

import { Enemy } from '../enemy.js';
import { GRUNT_BEHAVIOR } from '../../ai/behaviors.js';

/**
 * Create a Grunt enemy at the given position.
 *
 * @param {number} x - Starting X position in map coordinates.
 * @param {number} y - Starting Y position in map coordinates.
 * @returns {Enemy}
 */
export function createGrunt(x, y) {
    return new Enemy(x, y, 'grunt', GRUNT_BEHAVIOR);
}
