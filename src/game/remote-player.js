// =============================================================================
// remote-player.js - Remote Player Entity for RETRO FURY Multiplayer
// =============================================================================
// Represents the opponent in multiplayer mode. Stores interpolated position
// and produces a renderable WorldSprite for the existing SpriteRenderer.
// =============================================================================

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Sprite texture ID for the player character. */
const PLAYER_SPRITE_ID = 110;

/** Interpolation speed factor (higher = snappier). */
const LERP_SPEED = 15.0;

/** Animation frame duration for walk cycle (seconds). */
const WALK_FRAME_DURATION = 0.25;

/** Minimum movement speed to be considered "moving" (tiles/sec). */
const MOVE_THRESHOLD = 0.1;

// =============================================================================
// RemotePlayer Class
// =============================================================================

export class RemotePlayer {
    constructor() {
        /** @type {{ x: number, y: number }} Current interpolated position. */
        this.pos = { x: 0, y: 0 };

        /** @type {number} Current interpolated facing angle. */
        this.angle = 0;

        /** @type {number} Current health. */
        this.health = 100;

        /** @type {boolean} Whether the remote player is alive. */
        this.alive = true;

        /** @type {number} Current weapon tier (0-4). */
        this.weaponTier = 0;

        /** @type {{ x: number, y: number }} Target position from server. */
        this._targetPos = { x: 0, y: 0 };

        /** @type {number} Target angle from server. */
        this._targetAngle = 0;

        /** @type {number} Animation frame index. */
        this._animFrame = 0;

        /** @type {number} Walk animation timer. */
        this._walkTimer = 0;

        /** @type {boolean} Whether the remote player is moving. */
        this._isMoving = false;

        /** @type {boolean} Whether the remote player is firing. */
        this._isFiring = false;

        /** @type {number} Fire animation timer. */
        this._fireTimer = 0;

        /** @type {{ x: number, y: number }} Previous position for movement detection. */
        this._prevPos = { x: 0, y: 0 };
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Set the authoritative state from a server update.
     *
     * @param {number} x
     * @param {number} y
     * @param {number} angle
     * @param {number} health
     * @param {boolean} alive
     * @param {number} weaponTier
     */
    setServerState(x, y, angle, health, alive, weaponTier) {
        this._targetPos.x = x;
        this._targetPos.y = y;
        this._targetAngle = angle;
        this.health = health;
        this.alive = alive;
        this.weaponTier = weaponTier;
    }

    /**
     * Snap to a position immediately (for respawns).
     *
     * @param {number} x
     * @param {number} y
     */
    snapTo(x, y) {
        this.pos.x = x;
        this.pos.y = y;
        this._targetPos.x = x;
        this._targetPos.y = y;
        this._prevPos.x = x;
        this._prevPos.y = y;
    }

    /**
     * Trigger the fire animation.
     */
    triggerFire() {
        this._isFiring = true;
        this._fireTimer = 0.3;
    }

    /**
     * Update interpolation and animation.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        // -- Interpolate position --
        const lerpFactor = Math.min(1.0, LERP_SPEED * dt);
        this.pos.x += (this._targetPos.x - this.pos.x) * lerpFactor;
        this.pos.y += (this._targetPos.y - this.pos.y) * lerpFactor;

        // -- Interpolate angle (handle wrapping) --
        let angleDiff = this._targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.angle += angleDiff * lerpFactor;

        // -- Detect movement --
        const dx = this.pos.x - this._prevPos.x;
        const dy = this.pos.y - this._prevPos.y;
        const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 0.001);
        this._isMoving = speed > MOVE_THRESHOLD;
        this._prevPos.x = this.pos.x;
        this._prevPos.y = this.pos.y;

        // -- Fire animation timer --
        if (this._fireTimer > 0) {
            this._fireTimer -= dt;
            if (this._fireTimer <= 0) {
                this._isFiring = false;
                this._fireTimer = 0;
            }
        }

        // -- Walk animation --
        if (this._isMoving) {
            this._walkTimer += dt;
            if (this._walkTimer >= WALK_FRAME_DURATION) {
                this._walkTimer -= WALK_FRAME_DURATION;
            }
        } else {
            this._walkTimer = 0;
        }

        // -- Determine animation frame --
        if (!this.alive) {
            this._animFrame = 8; // death3 (corpse on ground)
        } else if (this._isFiring) {
            this._animFrame = this._fireTimer > 0.15 ? 3 : 4; // attack1/attack2
        } else if (this._isMoving) {
            this._animFrame = this._walkTimer < WALK_FRAME_DURATION / 2 ? 1 : 2;
        } else {
            this._animFrame = 0; // idle
        }
    }

    /**
     * Convert to a WorldSprite for the SpriteRenderer.
     *
     * @returns {{ x: number, y: number, textureId: number, frameIndex: number, scaleX: number, scaleY: number }|null}
     */
    toWorldSprite() {
        return {
            x: this.pos.x,
            y: this.pos.y,
            textureId: PLAYER_SPRITE_ID,
            frameIndex: this._animFrame,
            scaleX: 1,
            scaleY: 1,
        };
    }
}
