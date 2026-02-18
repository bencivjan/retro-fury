// =============================================================================
// door.js - Interactive door entity for RETRO FURY
// =============================================================================
// Doors are special tile entities that can open and close. They transition
// through four states (CLOSED -> OPENING -> OPEN -> CLOSING -> CLOSED) with
// timed animations. Doors may be locked by color-keyed keycards.
//
// When fully open, the door does not block raycasting or movement.
// When closed or partially open, it blocks both.
// =============================================================================

// -----------------------------------------------------------------------------
// Door State Enum
// -----------------------------------------------------------------------------

/** @enum {number} */
export const DoorState = Object.freeze({
    CLOSED:  0,
    OPENING: 1,
    OPEN:    2,
    CLOSING: 3,
});

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Time in seconds for a door to fully open or close. */
const OPEN_DURATION = 0.5;

/** Time in seconds a door stays open before auto-closing. */
const STAY_OPEN_DURATION = 3.0;

// =============================================================================
// Door Class
// =============================================================================

export class Door {
    /**
     * @param {number} x - Tile X coordinate of the door.
     * @param {number} y - Tile Y coordinate of the door.
     * @param {number} [textureId=10] - Texture ID for rendering the door.
     * @param {string|null} [lockColor=null] - Keycard color required to open
     *   (null for unlocked, or 'blue', 'red', 'yellow').
     */
    constructor(x, y, textureId = 10, lockColor = null) {
        /** @type {number} Tile X coordinate. */
        this.x = x;

        /** @type {number} Tile Y coordinate. */
        this.y = y;

        /** @type {number} Current door state. */
        this.state = DoorState.CLOSED;

        /**
         * @type {number} How far the door is open, from 0 (fully closed) to
         *   1 (fully open). Used for animation and partial blocking.
         */
        this.openAmount = 0;

        /**
         * @type {string|null} Keycard color required to open this door.
         *   null means the door is unlocked.
         */
        this.lockColor = lockColor;

        /** @type {number} Texture ID for rendering. */
        this.textureId = textureId;

        /**
         * @type {number} Timer used internally for tracking state durations.
         *   During OPENING/CLOSING: tracks animation progress.
         *   During OPEN: tracks time remaining before auto-close.
         * @private
         */
        this._timer = 0;
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    /**
     * Advance door animation state by one frame.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        switch (this.state) {
            case DoorState.OPENING:
                this._timer += dt;
                this.openAmount = Math.min(this._timer / OPEN_DURATION, 1.0);

                if (this.openAmount >= 1.0) {
                    this.openAmount = 1.0;
                    this.state = DoorState.OPEN;
                    this._timer = 0;
                }
                break;

            case DoorState.OPEN:
                this._timer += dt;

                if (this._timer >= STAY_OPEN_DURATION) {
                    this.state = DoorState.CLOSING;
                    this._timer = 0;
                }
                break;

            case DoorState.CLOSING:
                this._timer += dt;
                this.openAmount = Math.max(1.0 - this._timer / OPEN_DURATION, 0.0);

                if (this.openAmount <= 0.0) {
                    this.openAmount = 0.0;
                    this.state = DoorState.CLOSED;
                    this._timer = 0;
                }
                break;

            case DoorState.CLOSED:
            default:
                // Nothing to do.
                break;
        }
    }

    // -------------------------------------------------------------------------
    // Interaction
    // -------------------------------------------------------------------------

    /**
     * Attempt to open the door. If the door is locked, the player must have
     * the matching keycard.
     *
     * @param {import('./player.js').Player} player - The player trying to open.
     * @returns {{ success: boolean, message: string }}
     */
    tryOpen(player) {
        // Door is already opening or open -- nothing to do.
        if (this.state === DoorState.OPENING || this.state === DoorState.OPEN) {
            return { success: false, message: '' };
        }

        // If the door is closing, reverse it back to opening.
        if (this.state === DoorState.CLOSING) {
            this.state = DoorState.OPENING;
            // Invert the timer so the animation continues smoothly from
            // the current openAmount.
            this._timer = this.openAmount * OPEN_DURATION;
            return { success: true, message: 'Door opening.' };
        }

        // Door is CLOSED. Check for lock.
        if (this.lockColor) {
            if (!player.hasKeycard(this.lockColor)) {
                return {
                    success: false,
                    message: `You need the ${this.lockColor} keycard.`,
                };
            }
            // Player has the key -- consume it? No, DOOM-style: keep keycard.
        }

        // Begin opening.
        this.state = DoorState.OPENING;
        this._timer = 0;

        const msg = this.lockColor
            ? `Used ${this.lockColor} keycard.`
            : 'Door opening.';

        return { success: true, message: msg };
    }

    // -------------------------------------------------------------------------
    // Query
    // -------------------------------------------------------------------------

    /**
     * Returns whether this door blocks raycasting and player movement.
     * A door blocks unless it is fully open.
     *
     * @returns {boolean} True if the door is blocking.
     */
    isBlocking() {
        return this.openAmount < 1.0;
    }

    /**
     * Reset the door to its initial closed state.
     */
    reset() {
        this.state = DoorState.CLOSED;
        this.openAmount = 0;
        this._timer = 0;
    }
}

// Export constants for external use.
export { OPEN_DURATION, STAY_OPEN_DURATION };
