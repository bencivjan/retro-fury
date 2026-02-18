// =============================================================================
// enemy.js - Enemy base class for RETRO FURY
// =============================================================================
// The core enemy entity used by all standard enemy types (grunt, soldier, scout,
// brute). Each enemy is driven by a finite state machine whose states reference
// a behavior config for type-specific tuning. The commander boss uses a custom
// AI layer on top of this base.
//
// Enemies attack using hitscan rays toward the player with accuracy-based
// spread. They navigate using simple direct-to-player movement with wall
// sliding. Line-of-sight checks prevent them from shooting through walls.
// =============================================================================

import { StateMachine, States } from '../ai/state-machine.js';
import { moveToward, lineOfSight } from '../ai/pathfinding.js';
import { vec2Distance, randomRange, normalizeAngle } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default collision radius for standard enemies. */
const DEFAULT_RADIUS = 0.3;

/** How long the ALERT state pause lasts (seconds). */
const ALERT_DURATION = 0.5;

/** How long the PAIN stun lasts (seconds). */
const PAIN_DURATION = 0.3;

/** How long the death animation plays (seconds). */
const DYING_DURATION = 0.5;

/** Seconds without line of sight before an enemy gives up chasing. */
const CHASE_LOSE_SIGHT_TIMEOUT = 5.0;

/** Maximum hitscan range for enemy attacks. */
const MAX_ATTACK_RANGE = 32.0;

/** Maximum spread angle in radians (applied when accuracy = 0). */
const MAX_SPREAD = 0.5;

/** Animation timing: seconds per walk cycle frame. */
const WALK_FRAME_DURATION = 0.2;

/** Animation timing: seconds per attack animation frame. */
const ATTACK_FRAME_DURATION = 0.15;

/** Animation timing: seconds per death animation frame. */
const DEATH_FRAME_DURATION = 0.15;

// -----------------------------------------------------------------------------
// Animation Frame Constants
// -----------------------------------------------------------------------------
// These indices map to rows/columns in the enemy sprite sheet.
// 0 = idle, 1-2 = walk, 3-4 = attack, 5 = pain, 6-8 = death

const ANIM = Object.freeze({
    IDLE:         0,
    WALK_START:   1,
    WALK_END:     2,
    ATTACK_START: 3,
    ATTACK_END:   4,
    PAIN:         5,
    DEATH_START:  6,
    DEATH_END:    8,
});

// =============================================================================
// Enemy Class
// =============================================================================

export class Enemy {
    /**
     * @param {number} x - Starting X position in map coordinates.
     * @param {number} y - Starting Y position in map coordinates.
     * @param {string} type - Enemy type name (e.g. 'grunt', 'soldier').
     * @param {import('../ai/behaviors.js').BehaviorConfig} behavior - Behavior configuration.
     */
    constructor(x, y, type, behavior) {
        // ---- Identity ----
        /** @type {string} Enemy type name for identification. */
        this.type = type;

        /** @type {import('../ai/behaviors.js').BehaviorConfig} */
        this.behavior = behavior;

        // ---- Position & Physics ----
        /** @type {{ x: number, y: number }} World position. */
        this.pos = { x, y };

        /** @type {number} Collision radius. Brutes use a larger one. */
        this.radius = behavior.scale ? DEFAULT_RADIUS * behavior.scale : DEFAULT_RADIUS;

        /** @type {number} Render scale multiplier. */
        this.scale = behavior.scale || 1.0;

        // ---- Health ----
        /** @type {number} Current hit points. */
        this.health = behavior.hp;

        /** @type {number} Maximum hit points (for health bar display). */
        this.maxHealth = behavior.hp;

        /** @type {boolean} Whether this enemy is still alive. */
        this.alive = true;

        // ---- Combat ----
        /** @type {number} Cooldown timer between shots (seconds remaining). */
        this.attackCooldown = 0;

        /** @type {boolean} Whether the player is currently in line of sight. */
        this.facingPlayer = false;

        /** @type {number} Sprite ID base for rendering. */
        this.spriteId = behavior.spriteId;

        // ---- Animation ----
        /** @type {number} Current animation frame index. */
        this.animFrame = ANIM.IDLE;

        /** @type {number} Timer for cycling animation frames. */
        this.animTimer = 0;

        // ---- Stuck detection (used by pathfinding) ----
        /** @type {number} Accumulated time spent stuck. */
        this.stuckTimer = 0;

        /** @type {{ x: number, y: number }} Position at previous frame. */
        this.lastPos = { x, y };

        // ---- Patrol state ----
        /** @type {{ x: number, y: number }|null} Current patrol target. */
        this._patrolTarget = null;

        /** @type {number} Timer for picking a new patrol direction. */
        this._patrolTimer = 0;

        // ---- Chase state ----
        /** @type {number} Seconds since last line-of-sight to the player. */
        this._chaseLostSightTimer = 0;

        /** @type {{ x: number, y: number }} Last known player position. */
        this._lastKnownPlayerPos = { x: 0, y: 0 };

        // ---- Alert state ----
        /** @type {number} Time remaining in ALERT pause. */
        this._alertTimer = 0;

        // ---- Pain state ----
        /** @type {number} Time remaining in PAIN stun. */
        this._painTimer = 0;

        // ---- Dying state ----
        /** @type {number} Time remaining in DYING animation. */
        this._dyingTimer = 0;

        // ---- Strafe state (soldiers) ----
        /** @type {number} Direction of strafe: -1 = left, 1 = right. */
        this._strafeDir = Math.random() < 0.5 ? -1 : 1;

        /** @type {number} Timer until next strafe direction change. */
        this._strafeTimer = randomRange(1.0, 2.0);

        // ---- Zigzag state (scouts) ----
        /** @type {number} Zigzag phase accumulator (radians). */
        this._zigzagPhase = Math.random() * Math.PI * 2;

        // ---- References set each frame ----
        /** @type {Object|null} Reference to the player, set during update. */
        this._player = null;

        /** @type {Object|null} Reference to the map, set during update. */
        this._map = null;

        /** @type {Array|null} Reference to the enemies array, set during update. */
        this._enemies = null;

        // ---- Build the state machine ----
        this.stateMachine = this._buildStateMachine();
        this.stateMachine.transition(States.IDLE);
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Update the enemy for one frame. Runs the state machine, checks line of
     * sight, and updates animation.
     *
     * @param {number} dt - Delta time in seconds.
     * @param {import('./player.js').Player} player - The player entity.
     * @param {{ grid: number[][], width: number, height: number }} map - Tile map.
     * @param {Array<Enemy>} enemies - All enemies (for separation and friendly fire avoidance).
     */
    update(dt, player, map, enemies) {
        if (!this.alive) return;

        // Store references for use by state callbacks.
        this._player = player;
        this._map = map;
        this._enemies = enemies;

        // Decrement attack cooldown.
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        // Check line of sight to the player.
        if (player.alive) {
            const dist = vec2Distance(this.pos, player.pos);
            this.facingPlayer = dist <= this.behavior.sightRange &&
                lineOfSight(this.pos.x, this.pos.y, player.pos.x, player.pos.y, map);

            if (this.facingPlayer) {
                this._lastKnownPlayerPos.x = player.pos.x;
                this._lastKnownPlayerPos.y = player.pos.y;
            }
        } else {
            this.facingPlayer = false;
        }

        // Tick the state machine.
        this.stateMachine.update(dt);

        // Update animation based on current state.
        this._updateAnimation(dt);
    }

    /**
     * Apply damage to this enemy. May trigger PAIN state based on painChance,
     * or DYING if health reaches zero.
     *
     * @param {number} amount - Damage to apply.
     * @returns {boolean} True if this damage killed the enemy.
     */
    takeDamage(amount) {
        if (!this.alive || amount <= 0) return false;

        // Ignore damage if already in DYING or DEAD state to prevent
        // double-counting kills and re-triggering death animations.
        const currentState = this.stateMachine.currentState;
        if (currentState === States.DYING || currentState === States.DEAD) {
            return false;
        }

        this.health -= amount;

        if (this.health <= 0) {
            this.health = 0;
            this.alive = true; // Keep alive flag until DEAD state is reached.
            this.stateMachine.transition(States.DYING);
            return true;
        }

        // Chance to flinch into PAIN state. At this point we know the enemy
        // is not DYING or DEAD (checked at the top of the method).
        if (Math.random() < this.behavior.painChance) {
            this.stateMachine.transition(States.PAIN);
        } else if (currentState === States.IDLE || currentState === States.PATROL) {
            // Getting shot always alerts an idle/patrolling enemy.
            this.stateMachine.transition(States.ALERT);
        }

        return false;
    }

    // =========================================================================
    // State Machine Construction
    // =========================================================================

    /**
     * Build the finite state machine with all behavioral states. Each state
     * closure captures `this` for access to enemy properties and the
     * per-frame player/map/enemies references.
     *
     * @returns {StateMachine}
     * @private
     */
    _buildStateMachine() {
        const self = this;

        return new StateMachine({
            // -----------------------------------------------------------------
            // IDLE: Stand still, scan for the player.
            // -----------------------------------------------------------------
            [States.IDLE]: {
                enter() {
                    self.animFrame = ANIM.IDLE;
                    self.animTimer = 0;
                },
                update(dt) {
                    if (self.facingPlayer) {
                        self.stateMachine.transition(States.ALERT);
                    }
                },
                exit() {},
            },

            // -----------------------------------------------------------------
            // PATROL: Wander randomly, scan for the player.
            // -----------------------------------------------------------------
            [States.PATROL]: {
                enter() {
                    self._patrolTimer = 0;
                    self._patrolTarget = null;
                    self.animTimer = 0;
                },
                update(dt) {
                    // Check for player.
                    if (self.facingPlayer) {
                        self.stateMachine.transition(States.ALERT);
                        return;
                    }

                    // Pick a new random patrol target periodically.
                    self._patrolTimer -= dt;
                    if (self._patrolTimer <= 0 || self._patrolTarget === null) {
                        self._patrolTimer = randomRange(2.0, 5.0);
                        const angle = randomRange(0, Math.PI * 2);
                        const dist = randomRange(2, 5);
                        self._patrolTarget = {
                            x: self.pos.x + Math.cos(angle) * dist,
                            y: self.pos.y + Math.sin(angle) * dist,
                        };
                    }

                    // Move toward patrol target.
                    moveToward(
                        self, self._patrolTarget.x, self._patrolTarget.y,
                        self.behavior.patrolSpeed, dt, self._map, self._enemies
                    );

                    // If we reached the target, pick a new one next frame.
                    const dx = self._patrolTarget.x - self.pos.x;
                    const dy = self._patrolTarget.y - self.pos.y;
                    if (dx * dx + dy * dy < 0.5) {
                        self._patrolTarget = null;
                    }
                },
                exit() {},
            },

            // -----------------------------------------------------------------
            // ALERT: Brief pause when the enemy first spots the player.
            // -----------------------------------------------------------------
            [States.ALERT]: {
                enter() {
                    self._alertTimer = ALERT_DURATION;
                    self.animFrame = ANIM.IDLE;
                },
                update(dt) {
                    self._alertTimer -= dt;
                    if (self._alertTimer <= 0) {
                        self.stateMachine.transition(States.CHASE);
                    }
                },
                exit() {},
            },

            // -----------------------------------------------------------------
            // CHASE: Pursue the player. Switch to ATTACK when in range.
            // -----------------------------------------------------------------
            [States.CHASE]: {
                enter() {
                    self._chaseLostSightTimer = 0;
                    self.animTimer = 0;
                },
                update(dt) {
                    const player = self._player;
                    if (!player || !player.alive) {
                        self.stateMachine.transition(States.PATROL);
                        return;
                    }

                    // Track how long since we last saw the player.
                    if (self.facingPlayer) {
                        self._chaseLostSightTimer = 0;
                    } else {
                        self._chaseLostSightTimer += dt;
                        if (self._chaseLostSightTimer >= CHASE_LOSE_SIGHT_TIMEOUT) {
                            self.stateMachine.transition(States.PATROL);
                            return;
                        }
                    }

                    // Check if we're in attack range with line of sight.
                    const dist = vec2Distance(self.pos, player.pos);
                    if (dist <= self.behavior.attackRange && self.facingPlayer) {
                        self.stateMachine.transition(States.ATTACK);
                        return;
                    }

                    // Move toward the last known player position.
                    let targetX = self._lastKnownPlayerPos.x;
                    let targetY = self._lastKnownPlayerPos.y;

                    // Scout zigzag: offset the target position side-to-side.
                    if (self.behavior.zigzag) {
                        self._zigzagPhase += dt * 6.0; // Oscillation speed.
                        const perpOffset = Math.sin(self._zigzagPhase) * 2.0;

                        // Calculate perpendicular to the direction of travel.
                        const dx = targetX - self.pos.x;
                        const dy = targetY - self.pos.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len > 0.1) {
                            const nx = -dy / len;
                            const ny = dx / len;
                            targetX += nx * perpOffset;
                            targetY += ny * perpOffset;
                        }
                    }

                    moveToward(
                        self, targetX, targetY,
                        self.behavior.chaseSpeed, dt, self._map, self._enemies
                    );
                },
                exit() {},
            },

            // -----------------------------------------------------------------
            // ATTACK: Fire at the player. Strafe if behavior dictates.
            // -----------------------------------------------------------------
            [States.ATTACK]: {
                enter() {
                    self.animTimer = 0;
                    self.attackCooldown = 0; // Fire immediately on entering attack.
                },
                update(dt) {
                    const player = self._player;
                    if (!player || !player.alive) {
                        self.stateMachine.transition(States.PATROL);
                        return;
                    }

                    // Check if player has moved out of range or LOS is broken.
                    const dist = vec2Distance(self.pos, player.pos);
                    if (dist > self.behavior.attackRange * 1.2 || !self.facingPlayer) {
                        self.stateMachine.transition(States.CHASE);
                        return;
                    }

                    // Strafe movement (soldiers).
                    if (self.behavior.strafes) {
                        self._strafeTimer -= dt;
                        if (self._strafeTimer <= 0) {
                            self._strafeDir *= -1;
                            self._strafeTimer = randomRange(1.0, 2.0);
                        }

                        // Calculate strafe direction (perpendicular to player).
                        const dx = player.pos.x - self.pos.x;
                        const dy = player.pos.y - self.pos.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len > 0.1) {
                            const perpX = (-dy / len) * self._strafeDir;
                            const perpY = (dx / len) * self._strafeDir;
                            const strafeTarget = {
                                x: self.pos.x + perpX * 3,
                                y: self.pos.y + perpY * 3,
                            };
                            moveToward(
                                self, strafeTarget.x, strafeTarget.y,
                                self.behavior.chaseSpeed * 0.6, dt,
                                self._map, self._enemies
                            );
                        }
                    }

                    // Fire at the player.
                    if (self.attackCooldown <= 0) {
                        self._fireAtPlayer();
                        self.attackCooldown = 1.0 / self.behavior.fireRate;
                        self.animFrame = ANIM.ATTACK_START;
                        self.animTimer = 0;
                    }
                },
                exit() {},
            },

            // -----------------------------------------------------------------
            // PAIN: Brief stun when hit. Then resume chasing.
            // -----------------------------------------------------------------
            [States.PAIN]: {
                enter() {
                    self._painTimer = PAIN_DURATION;
                    self.animFrame = ANIM.PAIN;
                    self.animTimer = 0;
                },
                update(dt) {
                    self._painTimer -= dt;
                    if (self._painTimer <= 0) {
                        self.stateMachine.transition(States.CHASE);
                    }
                },
                exit() {},
            },

            // -----------------------------------------------------------------
            // DYING: Play death animation, then become DEAD.
            // -----------------------------------------------------------------
            [States.DYING]: {
                enter() {
                    self._dyingTimer = DYING_DURATION;
                    self.animFrame = ANIM.DEATH_START;
                    self.animTimer = 0;
                },
                update(dt) {
                    self._dyingTimer -= dt;

                    // Advance death animation frames.
                    self.animTimer += dt;
                    const deathFrameCount = ANIM.DEATH_END - ANIM.DEATH_START + 1;
                    const frame = Math.min(
                        Math.floor(self.animTimer / DEATH_FRAME_DURATION),
                        deathFrameCount - 1
                    );
                    self.animFrame = ANIM.DEATH_START + frame;

                    if (self._dyingTimer <= 0) {
                        self.stateMachine.transition(States.DEAD);
                    }
                },
                exit() {},
            },

            // -----------------------------------------------------------------
            // DEAD: Corpse on the ground. Do nothing.
            // -----------------------------------------------------------------
            [States.DEAD]: {
                enter() {
                    self.alive = false;
                    self.animFrame = ANIM.DEATH_END;
                },
                update(_dt) {
                    // Dead enemies do nothing. Their sprite remains as a corpse.
                },
                exit() {},
            },
        });
    }

    // =========================================================================
    // Attack Logic
    // =========================================================================

    /**
     * Fire a hitscan ray at the player with accuracy-based spread. Deals
     * damage if the ray reaches the player without hitting a wall.
     *
     * @private
     */
    _fireAtPlayer() {
        const player = this._player;
        const map = this._map;
        if (!player || !player.alive || !map) return;

        // Calculate base angle toward the player.
        const dx = player.pos.x - this.pos.x;
        const dy = player.pos.y - this.pos.y;
        const baseAngle = Math.atan2(dy, dx);

        // Apply accuracy-based spread. Lower accuracy = wider spread.
        const spread = MAX_SPREAD * (1.0 - this.behavior.accuracy);
        const angle = baseAngle + randomRange(-spread, spread);

        // Cast a ray to check for wall obstruction before the player.
        const rayDirX = Math.cos(angle);
        const rayDirY = Math.sin(angle);

        // Step along the ray and see if it reaches close to the player.
        const dist = vec2Distance(this.pos, player.pos);
        if (dist > MAX_ATTACK_RANGE) return;

        // Verify the ray can reach the player's general area without hitting
        // a wall. Use line of sight from enemy to the aimed-at point.
        const aimX = this.pos.x + rayDirX * dist;
        const aimY = this.pos.y + rayDirY * dist;

        if (!lineOfSight(this.pos.x, this.pos.y, aimX, aimY, map)) {
            return; // Shot blocked by a wall.
        }

        // Check if the aimed ray passes close enough to the player.
        // Project the player position onto the ray to find perpendicular distance.
        const toPX = player.pos.x - this.pos.x;
        const toPY = player.pos.y - this.pos.y;
        const dot = toPX * rayDirX + toPY * rayDirY;

        if (dot < 0) return; // Somehow aiming backward.

        const closestX = this.pos.x + rayDirX * dot;
        const closestY = this.pos.y + rayDirY * dot;
        const perpDx = player.pos.x - closestX;
        const perpDy = player.pos.y - closestY;
        const perpDist = Math.sqrt(perpDx * perpDx + perpDy * perpDy);

        // Player hit radius for enemy hitscan.
        const playerHitRadius = 0.4;
        if (perpDist < playerHitRadius) {
            player.takeDamage(this.behavior.damage);
        }
    }

    // =========================================================================
    // Animation
    // =========================================================================

    /**
     * Update the animation frame based on current state.
     *
     * @param {number} dt - Delta time in seconds.
     * @private
     */
    _updateAnimation(dt) {
        const state = this.stateMachine.currentState;

        switch (state) {
            case States.PATROL:
            case States.CHASE: {
                // Cycle between walk frames.
                this.animTimer += dt;
                if (this.animTimer >= WALK_FRAME_DURATION) {
                    this.animTimer -= WALK_FRAME_DURATION;
                    // Toggle between WALK_START and WALK_END.
                    this.animFrame = this.animFrame === ANIM.WALK_START
                        ? ANIM.WALK_END
                        : ANIM.WALK_START;
                }
                break;
            }

            case States.ATTACK: {
                // Brief attack animation then return to idle pose.
                this.animTimer += dt;
                if (this.animTimer >= ATTACK_FRAME_DURATION * 2) {
                    this.animFrame = ANIM.IDLE;
                } else if (this.animTimer >= ATTACK_FRAME_DURATION) {
                    this.animFrame = ANIM.ATTACK_END;
                }
                // ATTACK_START is set when firing in the attack state.
                break;
            }

            case States.PAIN:
                // Pain frame is set on enter, stays fixed.
                break;

            case States.DYING:
                // Death frames are handled in the DYING state update.
                break;

            case States.DEAD:
                // Final death frame, stays fixed.
                break;

            case States.IDLE:
            case States.ALERT:
            default:
                this.animFrame = ANIM.IDLE;
                break;
        }
    }
}

// Export constants and animation enum for renderers and external code.
export { DEFAULT_RADIUS, ANIM, States };
