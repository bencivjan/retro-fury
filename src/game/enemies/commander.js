// =============================================================================
// commander.js - Boss enemy for RETRO FURY
// =============================================================================
// The Commander is a multi-phase boss with custom AI that does NOT use the
// standard state machine. Instead it runs its own phase-based logic with
// missile barrages, charge attacks, grunt summoning, and a rage mode.
//
// Phase 1 (HP 100-66%): Missile barrage - fires 3 rockets in a spread every
//   3 seconds. Slow strafing movement.
//
// Phase 2 (HP 66-33%): Charge attack - periodically rushes the player at 3x
//   speed. Summons 2 grunts every 15 seconds. Missiles are less frequent.
//
// Phase 3 (HP 33-0%): Rage mode - all attacks 50% faster. Alternates between
//   minigun spray (high fire rate, low accuracy hitscan) and missile barrage.
//   Summons 1 grunt every 10 seconds.
//
// The Commander communicates summoned enemies through a callback so the game
// loop can add them to the active enemies array.
// =============================================================================

import { moveToward, lineOfSight } from '../../ai/pathfinding.js';
import { COMMANDER_BEHAVIOR } from '../../ai/behaviors.js';
import { vec2Distance, randomRange } from '../../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Boss collision radius (larger than standard enemies). */
const BOSS_RADIUS = 0.7;

/** Missile projectile speed (tiles per second). */
const MISSILE_SPEED = 6;

/** Missile direct damage. */
const MISSILE_DAMAGE = 20;

/** Missile splash damage. */
const MISSILE_SPLASH_DAMAGE = 15;

/** Missile splash radius. */
const MISSILE_SPLASH_RADIUS = 2.0;

/** Spread angle between missiles in a barrage (radians). */
const MISSILE_SPREAD = 0.2;

/** Minigun damage per hit. */
const MINIGUN_DAMAGE = 4;

/** Minigun shots per second (base rate, before rage multiplier). */
const MINIGUN_FIRE_RATE = 8;

/** Minigun accuracy (very low -- spray and pray). */
const MINIGUN_ACCURACY = 0.15;

/** Maximum spread angle for minigun (radians). */
const MINIGUN_MAX_SPREAD = 0.6;

/** Charge speed multiplier over base chase speed. */
const CHARGE_SPEED_MULTIPLIER = 3.0;

/** Duration of a charge attack (seconds). */
const CHARGE_DURATION = 1.5;

/** Cooldown between charge attacks (seconds). */
const CHARGE_COOLDOWN = 6.0;

/** Damage dealt if the charge connects (close proximity). */
const CHARGE_DAMAGE = 25;

/** Proximity threshold for charge damage (tiles). */
const CHARGE_HIT_RADIUS = 1.0;

/** Player hit radius for boss hitscan attacks. */
const PLAYER_HIT_RADIUS = 0.4;

/** Maximum hitscan range for minigun. */
const MAX_ATTACK_RANGE = 32.0;

// Phase HP thresholds (as fractions of max HP).
const PHASE_2_THRESHOLD = 0.66;
const PHASE_3_THRESHOLD = 0.33;

// Animation frame indices (same layout as standard enemies).
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
// Commander Class
// =============================================================================

export class Commander {
    /**
     * @param {number} x - Starting X position in map coordinates.
     * @param {number} y - Starting Y position in map coordinates.
     * @param {Object} [options] - Optional configuration.
     * @param {Array<{x: number, y: number}>} [options.spawnPoints] - Positions
     *   where summoned grunts appear. Defaults to offsets around the boss.
     * @param {Function} [options.onSummon] - Callback invoked when grunts are
     *   summoned. Receives an array of { x, y, type: 'grunt' } spawn requests.
     * @param {Function} [options.onMissile] - Callback invoked when missiles are
     *   fired. Receives an array of projectile data objects.
     */
    constructor(x, y, options = {}) {
        // ---- Identity ----
        /** @type {string} */
        this.type = 'commander';

        /** @type {import('../../ai/behaviors.js').BehaviorConfig} */
        this.behavior = COMMANDER_BEHAVIOR;

        // ---- Position & Physics ----
        /** @type {{ x: number, y: number }} */
        this.pos = { x, y };

        /** @type {number} */
        this.radius = BOSS_RADIUS;

        /** @type {number} Render scale. */
        this.scale = COMMANDER_BEHAVIOR.scale;

        // ---- Health ----
        /** @type {number} */
        this.health = COMMANDER_BEHAVIOR.hp;

        /** @type {number} */
        this.maxHealth = COMMANDER_BEHAVIOR.hp;

        /** @type {boolean} */
        this.alive = true;

        // ---- Sprite / Animation ----
        /** @type {number} */
        this.spriteId = COMMANDER_BEHAVIOR.spriteId;

        /** @type {number} */
        this.animFrame = ANIM.IDLE;

        /** @type {number} */
        this.animTimer = 0;

        // ---- Stuck detection (used by pathfinding) ----
        /** @type {number} */
        this.stuckTimer = 0;

        /** @type {{ x: number, y: number }} */
        this.lastPos = { x, y };

        // ---- Phase System ----
        /** @type {number} Current boss phase (1, 2, or 3). */
        this.phase = 1;

        /** @type {number} General-purpose phase timer. */
        this.phaseTimer = 0;

        // ---- Attack Timers ----
        /** @type {number} Cooldown for missile barrage (seconds). */
        this.missileTimer = 2.0; // Slight delay before first barrage.

        /** @type {number} Cooldown for minigun shots (seconds). */
        this._minigunTimer = 0;

        /** @type {number} Timer for alternating attacks in phase 3. */
        this._attackModeTimer = 0;

        /**
         * @type {string} Current attack mode in phase 3: 'minigun' or 'missile'.
         */
        this._attackMode = 'missile';

        // ---- Charge State ----
        /** @type {boolean} Whether the boss is currently charging. */
        this._isCharging = false;

        /** @type {number} Remaining charge duration. */
        this._chargeDuration = 0;

        /** @type {number} Cooldown before next charge is allowed. */
        this._chargeCooldown = CHARGE_COOLDOWN * 0.5; // Initial delay.

        /** @type {{ x: number, y: number }} Direction of the charge. */
        this._chargeDir = { x: 0, y: 0 };

        // ---- Summon State ----
        /** @type {number} Cooldown timer for summoning grunts. */
        this.summonTimer = 10.0; // Delay before first summon.

        // ---- Strafe State ----
        /** @type {number} */
        this._strafeDir = Math.random() < 0.5 ? -1 : 1;

        /** @type {number} */
        this._strafeTimer = randomRange(2.0, 4.0);

        // ---- Death State ----
        /**
         * @type {boolean} Whether the boss is in its dying animation.
         * Public because the main game loop needs to check this for the
         * boss health bar display and kill detection.
         */
        this.isDying = false;

        /** @type {number} Dying animation timer. */
        this._dyingTimer = 0;

        // ---- Line of sight cache ----
        /** @type {boolean} */
        this.facingPlayer = false;

        // ---- Callbacks ----
        /**
         * @type {Array<{x: number, y: number}>} Spawn points for summoned grunts.
         */
        this.spawnPoints = options.spawnPoints || [
            { x: x + 3, y: y },
            { x: x - 3, y: y },
            { x: x, y: y + 3 },
            { x: x, y: y - 3 },
        ];

        /**
         * @type {Function|null} Called with an array of grunt spawn requests.
         */
        this._onSummon = options.onSummon || null;

        /**
         * @type {Function|null} Called with an array of projectile data objects.
         */
        this._onMissile = options.onMissile || null;

        // ---- Per-frame references ----
        /** @private */
        this._player = null;
        /** @private */
        this._map = null;
        /** @private */
        this._enemies = null;
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Update the commander for one frame.
     *
     * @param {number} dt - Delta time in seconds.
     * @param {import('../player.js').Player} player
     * @param {{ grid: number[][], width: number, height: number }} map
     * @param {Array} enemies - All enemies (for separation).
     */
    update(dt, player, map, enemies) {
        this._player = player;
        this._map = map;
        this._enemies = enemies;

        // Handle death animation.
        if (this.isDying) {
            this._updateDying(dt);
            return;
        }

        if (!this.alive) return;

        // ---- Line of sight check ----
        if (player && player.alive) {
            const dist = vec2Distance(this.pos, player.pos);
            this.facingPlayer = dist <= this.behavior.sightRange &&
                lineOfSight(this.pos.x, this.pos.y, player.pos.x, player.pos.y, map);
        } else {
            this.facingPlayer = false;
        }

        // ---- Phase transitions ----
        this._updatePhase();

        // ---- Phase-specific behavior ----
        const rageMultiplier = this.phase === 3 ? 1.5 : 1.0;

        switch (this.phase) {
            case 1:
                this._updatePhase1(dt, rageMultiplier);
                break;
            case 2:
                this._updatePhase2(dt, rageMultiplier);
                break;
            case 3:
                this._updatePhase3(dt, rageMultiplier);
                break;
        }

        // ---- Animation ----
        this._updateAnimation(dt);
    }

    /**
     * Apply damage to the commander. The boss never enters a PAIN state.
     *
     * @param {number} amount - Damage to apply.
     * @returns {boolean} True if this damage killed the boss.
     */
    takeDamage(amount) {
        if (!this.alive || this.isDying || amount <= 0) return false;

        this.health -= amount;

        if (this.health <= 0) {
            this.health = 0;
            this.isDying = true;
            this._dyingTimer = 0.8; // Longer death animation for the boss.
            this.animFrame = ANIM.DEATH_START;
            this.animTimer = 0;
            return true;
        }

        return false;
    }

    // =========================================================================
    // Phase Management
    // =========================================================================

    /**
     * Check HP thresholds and transition between phases.
     * @private
     */
    _updatePhase() {
        const hpFraction = this.health / this.maxHealth;

        if (this.phase === 1 && hpFraction <= PHASE_2_THRESHOLD) {
            this.phase = 2;
            this.phaseTimer = 0;
            this._chargeCooldown = CHARGE_COOLDOWN * 0.5;
            this.summonTimer = 2.0; // Summon soon after phase transition.
        } else if (this.phase === 2 && hpFraction <= PHASE_3_THRESHOLD) {
            this.phase = 3;
            this.phaseTimer = 0;
            this._attackMode = 'minigun';
            this._attackModeTimer = 3.0;
            this.summonTimer = 2.0;
        }
    }

    // =========================================================================
    // Phase 1: Missile Barrage + Slow Strafe
    // =========================================================================

    /**
     * @param {number} dt
     * @param {number} rageMultiplier
     * @private
     */
    _updatePhase1(dt, rageMultiplier) {
        const player = this._player;
        if (!player || !player.alive) return;

        // Slow strafe movement.
        this._doStrafe(dt, this.behavior.chaseSpeed * 0.5);

        // Missile barrage every 3 seconds.
        this.missileTimer -= dt * rageMultiplier;
        if (this.missileTimer <= 0 && this.facingPlayer) {
            this._fireMissileBarrage(3);
            this.missileTimer = 3.0;
        }
    }

    // =========================================================================
    // Phase 2: Charge + Reduced Missiles + Grunt Summons
    // =========================================================================

    /**
     * @param {number} dt
     * @param {number} rageMultiplier
     * @private
     */
    _updatePhase2(dt, rageMultiplier) {
        const player = this._player;
        if (!player || !player.alive) return;

        // ---- Charge attack ----
        if (this._isCharging) {
            this._updateCharge(dt);
        } else {
            this._chargeCooldown -= dt;
            if (this._chargeCooldown <= 0 && this.facingPlayer) {
                this._startCharge();
            } else {
                // Strafe when not charging.
                this._doStrafe(dt, this.behavior.chaseSpeed * 0.7);
            }
        }

        // Missile barrage (less frequent than phase 1).
        this.missileTimer -= dt * rageMultiplier;
        if (this.missileTimer <= 0 && this.facingPlayer && !this._isCharging) {
            this._fireMissileBarrage(2);
            this.missileTimer = 5.0;
        }

        // Summon grunts every 15 seconds.
        this.summonTimer -= dt;
        if (this.summonTimer <= 0) {
            this._summonGrunts(2);
            this.summonTimer = 15.0;
        }
    }

    // =========================================================================
    // Phase 3: Rage Mode
    // =========================================================================

    /**
     * @param {number} dt
     * @param {number} rageMultiplier
     * @private
     */
    _updatePhase3(dt, rageMultiplier) {
        const player = this._player;
        if (!player || !player.alive) return;

        // Aggressive strafe.
        this._doStrafe(dt, this.behavior.chaseSpeed * 1.0);

        // Alternate between minigun and missile attacks.
        this._attackModeTimer -= dt * rageMultiplier;
        if (this._attackModeTimer <= 0) {
            this._attackMode = this._attackMode === 'minigun' ? 'missile' : 'minigun';
            this._attackModeTimer = this._attackMode === 'minigun' ? 3.0 : 2.0;
        }

        if (this._attackMode === 'minigun') {
            // High fire-rate hitscan with low accuracy.
            this._minigunTimer -= dt * rageMultiplier;
            if (this._minigunTimer <= 0 && this.facingPlayer) {
                this._fireMinigun();
                this._minigunTimer = 1.0 / (MINIGUN_FIRE_RATE * rageMultiplier);
            }
        } else {
            // Missile barrage (faster in rage mode due to rageMultiplier).
            this.missileTimer -= dt * rageMultiplier;
            if (this.missileTimer <= 0 && this.facingPlayer) {
                this._fireMissileBarrage(3);
                this.missileTimer = 2.5;
            }
        }

        // Summon 1 grunt every 10 seconds.
        this.summonTimer -= dt;
        if (this.summonTimer <= 0) {
            this._summonGrunts(1);
            this.summonTimer = 10.0;
        }
    }

    // =========================================================================
    // Movement
    // =========================================================================

    /**
     * Strafe perpendicular to the player direction. Periodically reverses
     * direction. Also slowly closes distance if the player is far away.
     *
     * @param {number} dt
     * @param {number} speed
     * @private
     */
    _doStrafe(dt, speed) {
        const player = this._player;
        if (!player) return;

        this._strafeTimer -= dt;
        if (this._strafeTimer <= 0) {
            this._strafeDir *= -1;
            this._strafeTimer = randomRange(2.0, 4.0);
        }

        const dx = player.pos.x - this.pos.x;
        const dy = player.pos.y - this.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.1) return;

        // Normalize direction to player.
        const ndx = dx / dist;
        const ndy = dy / dist;

        // Perpendicular for strafing.
        const perpX = -ndy * this._strafeDir;
        const perpY = ndx * this._strafeDir;

        // Blend: mostly strafe, with a component closing distance if far away.
        let moveX, moveY;
        if (dist > this.behavior.attackRange * 0.6) {
            // Close distance while strafing.
            moveX = ndx * 0.4 + perpX * 0.6;
            moveY = ndy * 0.4 + perpY * 0.6;
        } else {
            // Pure strafe when close enough.
            moveX = perpX;
            moveY = perpY;
        }

        // Normalize.
        const len = Math.sqrt(moveX * moveX + moveY * moveY);
        if (len > 0) {
            moveX /= len;
            moveY /= len;
        }

        const targetX = this.pos.x + moveX * 5;
        const targetY = this.pos.y + moveY * 5;

        moveToward(this, targetX, targetY, speed, dt, this._map, this._enemies);
    }

    // =========================================================================
    // Charge Attack (Phase 2)
    // =========================================================================

    /**
     * Begin a charge attack toward the player's current position.
     * @private
     */
    _startCharge() {
        const player = this._player;
        if (!player) return;

        this._isCharging = true;
        this._chargeDuration = CHARGE_DURATION;

        // Lock in the charge direction at the start.
        const dx = player.pos.x - this.pos.x;
        const dy = player.pos.y - this.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.1) {
            this._chargeDir.x = dx / dist;
            this._chargeDir.y = dy / dist;
        } else {
            this._chargeDir.x = 1;
            this._chargeDir.y = 0;
        }
    }

    /**
     * Update the charge attack in progress.
     *
     * @param {number} dt
     * @private
     */
    _updateCharge(dt) {
        this._chargeDuration -= dt;

        if (this._chargeDuration <= 0) {
            this._isCharging = false;
            this._chargeCooldown = CHARGE_COOLDOWN;
            return;
        }

        // Rush in the locked direction at high speed.
        const chargeSpeed = this.behavior.chaseSpeed * CHARGE_SPEED_MULTIPLIER;
        const targetX = this.pos.x + this._chargeDir.x * 10;
        const targetY = this.pos.y + this._chargeDir.y * 10;

        moveToward(this, targetX, targetY, chargeSpeed, dt, this._map, this._enemies);

        // Check for collision with the player.
        const player = this._player;
        if (player && player.alive) {
            const dist = vec2Distance(this.pos, player.pos);
            if (dist < CHARGE_HIT_RADIUS) {
                player.takeDamage(CHARGE_DAMAGE);
                // End the charge on impact.
                this._isCharging = false;
                this._chargeCooldown = CHARGE_COOLDOWN;
            }
        }
    }

    // =========================================================================
    // Missile Barrage
    // =========================================================================

    /**
     * Fire a spread of missiles toward the player.
     *
     * @param {number} count - Number of missiles in the barrage.
     * @private
     */
    _fireMissileBarrage(count) {
        const player = this._player;
        if (!player || !player.alive) return;

        const dx = player.pos.x - this.pos.x;
        const dy = player.pos.y - this.pos.y;
        const baseAngle = Math.atan2(dy, dx);

        const missiles = [];

        for (let i = 0; i < count; i++) {
            // Spread the missiles evenly across the spread arc.
            let spreadAngle = 0;
            if (count > 1) {
                const t = (i / (count - 1)) - 0.5; // -0.5 to 0.5
                spreadAngle = t * MISSILE_SPREAD * 2;
            }

            const angle = baseAngle + spreadAngle;
            const mdx = Math.cos(angle);
            const mdy = Math.sin(angle);

            // Spawn slightly ahead to avoid self-collision.
            const spawnOffset = this.radius + 0.3;

            missiles.push({
                x:            this.pos.x + mdx * spawnOffset,
                y:            this.pos.y + mdy * spawnOffset,
                dx:           mdx,
                dy:           mdy,
                speed:        MISSILE_SPEED,
                damage:       MISSILE_DAMAGE,
                splashDamage: MISSILE_SPLASH_DAMAGE,
                splashRadius: MISSILE_SPLASH_RADIUS,
                owner:        'enemy',
                spriteId:     401,
            });
        }

        if (this._onMissile) {
            this._onMissile(missiles);
        }

        // Set attack animation.
        this.animFrame = ANIM.ATTACK_START;
        this.animTimer = 0;
    }

    // =========================================================================
    // Minigun (Phase 3)
    // =========================================================================

    /**
     * Fire a single minigun hitscan shot at the player with low accuracy.
     * @private
     */
    _fireMinigun() {
        const player = this._player;
        const map = this._map;
        if (!player || !player.alive || !map) return;

        const dx = player.pos.x - this.pos.x;
        const dy = player.pos.y - this.pos.y;
        const baseAngle = Math.atan2(dy, dx);

        // Apply heavy spread for minigun inaccuracy.
        const spread = MINIGUN_MAX_SPREAD * (1.0 - MINIGUN_ACCURACY);
        const angle = baseAngle + randomRange(-spread, spread);

        const rayDirX = Math.cos(angle);
        const rayDirY = Math.sin(angle);

        const dist = vec2Distance(this.pos, player.pos);
        if (dist > MAX_ATTACK_RANGE) return;

        // Check line of sight for the aimed direction.
        const aimX = this.pos.x + rayDirX * dist;
        const aimY = this.pos.y + rayDirY * dist;

        if (!lineOfSight(this.pos.x, this.pos.y, aimX, aimY, map)) {
            return;
        }

        // Check if the ray passes close enough to the player.
        const toPX = player.pos.x - this.pos.x;
        const toPY = player.pos.y - this.pos.y;
        const dot = toPX * rayDirX + toPY * rayDirY;

        if (dot < 0) return;

        const closestX = this.pos.x + rayDirX * dot;
        const closestY = this.pos.y + rayDirY * dot;
        const perpDx = player.pos.x - closestX;
        const perpDy = player.pos.y - closestY;
        const perpDist = Math.sqrt(perpDx * perpDx + perpDy * perpDy);

        if (perpDist < PLAYER_HIT_RADIUS) {
            player.takeDamage(MINIGUN_DAMAGE);
        }

        // Set attack animation.
        this.animFrame = ANIM.ATTACK_START;
        this.animTimer = 0;
    }

    // =========================================================================
    // Grunt Summoning
    // =========================================================================

    /**
     * Summon grunts at the configured spawn points.
     *
     * @param {number} count - Number of grunts to summon.
     * @private
     */
    _summonGrunts(count) {
        if (!this._onSummon || this.spawnPoints.length === 0) return;

        const spawns = [];
        const available = [...this.spawnPoints];

        for (let i = 0; i < count && available.length > 0; i++) {
            // Pick a random spawn point and remove it to avoid double-spawning.
            const idx = Math.floor(Math.random() * available.length);
            const point = available.splice(idx, 1)[0];

            // Verify the spawn point is not inside a wall.
            if (this._map) {
                const tileX = Math.floor(point.x);
                const tileY = Math.floor(point.y);
                if (tileX >= 0 && tileX < this._map.width &&
                    tileY >= 0 && tileY < this._map.height &&
                    this._map.grid[tileY][tileX] > 0) {
                    continue; // Skip wall tiles.
                }
            }

            spawns.push({ x: point.x, y: point.y, type: 'grunt' });
        }

        if (spawns.length > 0) {
            this._onSummon(spawns);
        }
    }

    // =========================================================================
    // Animation
    // =========================================================================

    /**
     * Update animation frame based on current activity.
     *
     * @param {number} dt
     * @private
     */
    _updateAnimation(dt) {
        this.animTimer += dt;

        if (this._isCharging) {
            // Rapid walk cycle during charge.
            if (this.animTimer >= 0.1) {
                this.animTimer -= 0.1;
                this.animFrame = this.animFrame === ANIM.WALK_START
                    ? ANIM.WALK_END
                    : ANIM.WALK_START;
            }
            return;
        }

        // Attack animation briefly then return to idle.
        if (this.animFrame === ANIM.ATTACK_START || this.animFrame === ANIM.ATTACK_END) {
            if (this.animTimer >= 0.15) {
                if (this.animFrame === ANIM.ATTACK_START) {
                    this.animFrame = ANIM.ATTACK_END;
                    this.animTimer = 0;
                } else {
                    this.animFrame = ANIM.IDLE;
                    this.animTimer = 0;
                }
            }
            return;
        }

        // Normal walk cycle when strafing.
        if (this.animTimer >= 0.25) {
            this.animTimer -= 0.25;
            this.animFrame = this.animFrame === ANIM.WALK_START
                ? ANIM.WALK_END
                : ANIM.WALK_START;
        }
    }

    /**
     * Update the dying animation and mark as dead when complete.
     *
     * @param {number} dt
     * @private
     */
    _updateDying(dt) {
        this._dyingTimer -= dt;
        this.animTimer += dt;

        // Progress through death frames.
        const deathFrameCount = ANIM.DEATH_END - ANIM.DEATH_START + 1;
        const deathDuration = 0.8;
        const frameDuration = deathDuration / deathFrameCount;
        const frame = Math.min(
            Math.floor(this.animTimer / frameDuration),
            deathFrameCount - 1
        );
        this.animFrame = ANIM.DEATH_START + frame;

        if (this._dyingTimer <= 0) {
            this.alive = false;
            this.animFrame = ANIM.DEATH_END;
        }
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Commander boss at the given position.
 *
 * @param {number} x - Starting X position.
 * @param {number} y - Starting Y position.
 * @param {Object} [options] - Configuration options.
 * @param {Array<{x: number, y: number}>} [options.spawnPoints] - Grunt spawn locations.
 * @param {Function} [options.onSummon] - Callback for grunt summoning.
 * @param {Function} [options.onMissile] - Callback for missile firing.
 * @returns {Commander}
 */
export function createCommander(x, y, options) {
    return new Commander(x, y, options);
}
