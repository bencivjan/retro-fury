// =============================================================================
// behaviors.js - Per-enemy-type behavior configurations for RETRO FURY
// =============================================================================
// Each behavior config defines the tuning knobs that make an enemy type feel
// distinct in combat. These are passed to the Enemy constructor and referenced
// throughout the state machine to control sight ranges, fire rates, movement
// speeds, and special movement patterns.
// =============================================================================

// -----------------------------------------------------------------------------
// Grunt - Cannon Fodder
// -----------------------------------------------------------------------------
// The lowest-tier enemy. Slow to react, inaccurate, and fragile. They exist to
// give the player something satisfying to mow down. Encountered in groups.

/** @type {import('./behaviors').BehaviorConfig} */
export const GRUNT_BEHAVIOR = Object.freeze({
    sightRange:  8,
    attackRange: 6,
    fireRate:    0.8,       // Shots per second.
    accuracy:    0.3,       // 0 = perfectly inaccurate, 1 = perfect aim.
    patrolSpeed: 1.0,
    chaseSpeed:  1.5,
    painChance:  0.5,       // 50% chance to flinch on hit.
    damage:      5,
    spriteId:    100,
    hp:          30,
});

// -----------------------------------------------------------------------------
// Soldier - Tactical Mid-Tier
// -----------------------------------------------------------------------------
// Tougher and more accurate than grunts. Strafes during combat to make itself
// harder to hit. The player needs to lead their shots.

/** @type {import('./behaviors').BehaviorConfig} */
export const SOLDIER_BEHAVIOR = Object.freeze({
    sightRange:  10,
    attackRange: 8,
    fireRate:    1.5,
    accuracy:    0.5,
    patrolSpeed: 1.2,
    chaseSpeed:  2.0,
    painChance:  0.3,
    strafes:     true,      // Moves laterally during ATTACK state.
    damage:      8,
    spriteId:    101,
    hp:          50,
});

// -----------------------------------------------------------------------------
// Scout - Glass Cannon Sprinter
// -----------------------------------------------------------------------------
// Extremely fast but fragile. Closes distance quickly with a zigzag pattern
// that makes it hard to hit. Deals heavy damage up close. The player hears
// footsteps and has seconds to react before it is in their face.

/** @type {import('./behaviors').BehaviorConfig} */
export const SCOUT_BEHAVIOR = Object.freeze({
    sightRange:  12,
    attackRange: 3,
    fireRate:    0.8,
    accuracy:    0.4,
    patrolSpeed: 1.5,
    chaseSpeed:  3.0,
    painChance:  0.6,
    zigzag:      true,      // Weaves side to side during CHASE.
    damage:      15,
    spriteId:    102,
    hp:          25,
});

// -----------------------------------------------------------------------------
// Brute - Bullet Sponge Tank
// -----------------------------------------------------------------------------
// Massive HP pool, slow movement, constant suppressive fire with poor accuracy.
// The threat is sustained damage over time rather than burst. Intimidating
// because the player has to dump a lot of ammo to bring one down.

/** @type {import('./behaviors').BehaviorConfig} */
export const BRUTE_BEHAVIOR = Object.freeze({
    sightRange:  8,
    attackRange: 7,
    fireRate:    5.0,
    accuracy:    0.2,
    patrolSpeed: 0.5,
    chaseSpeed:  0.7,
    painChance:  0.1,       // Nearly impossible to stagger.
    damage:      3,
    spriteId:    103,
    hp:          150,
    scale:       1.5,       // Rendered 50% larger than standard enemies.
});

// -----------------------------------------------------------------------------
// Commander - Boss
// -----------------------------------------------------------------------------
// Multi-phase boss with custom AI. Not used via the standard behavior system
// directly, but the base stats are defined here for consistency.

/** @type {import('./behaviors').BehaviorConfig} */
export const COMMANDER_BEHAVIOR = Object.freeze({
    sightRange:  20,
    attackRange: 15,
    fireRate:    1.0,       // Base rate; overridden per phase.
    accuracy:    0.6,
    patrolSpeed: 0.8,
    chaseSpeed:  1.2,
    painChance:  0.0,       // Boss never flinches.
    damage:      12,
    spriteId:    104,
    hp:          500,
    scale:       2.0,
});

// -----------------------------------------------------------------------------
// Type Definition (for documentation / IDE support)
// -----------------------------------------------------------------------------

/**
 * @typedef {Object} BehaviorConfig
 * @property {number}  sightRange  - Maximum distance (tiles) to detect the player.
 * @property {number}  attackRange - Distance at which the enemy opens fire.
 * @property {number}  fireRate    - Shots per second.
 * @property {number}  accuracy    - 0..1 where 1 = perfect accuracy.
 * @property {number}  patrolSpeed - Tiles per second while patrolling.
 * @property {number}  chaseSpeed  - Tiles per second while chasing.
 * @property {number}  painChance  - 0..1 probability of entering PAIN on hit.
 * @property {number}  damage      - Damage dealt per hit.
 * @property {number}  spriteId    - Base sprite ID in the sprite sheet.
 * @property {number}  hp          - Starting hit points.
 * @property {boolean} [strafes]   - Whether the enemy strafes during ATTACK.
 * @property {boolean} [zigzag]    - Whether the enemy zigzags during CHASE.
 * @property {number}  [scale]     - Render scale multiplier (default 1.0).
 */
