// =============================================================================
// state-machine.js - Reusable Finite State Machine for RETRO FURY
// =============================================================================
// A generic FSM used by all enemy types to manage behavioral states. Each state
// provides enter(), update(dt), and exit() callbacks. The machine handles clean
// transitions, prevents double-entering the same state, and safely no-ops when
// a state callback is missing.
// =============================================================================

// -----------------------------------------------------------------------------
// States Enum
// -----------------------------------------------------------------------------

/** @enum {string} */
export const States = Object.freeze({
    IDLE:   'IDLE',
    PATROL: 'PATROL',
    ALERT:  'ALERT',
    CHASE:  'CHASE',
    ATTACK: 'ATTACK',
    PAIN:   'PAIN',
    DYING:  'DYING',
    DEAD:   'DEAD',
});

// =============================================================================
// StateMachine Class
// =============================================================================

export class StateMachine {
    /**
     * Create a finite state machine.
     *
     * @param {Object<string, { enter?: Function, update?: Function, exit?: Function }>} states
     *   An object mapping state name strings to handler objects. Each handler
     *   may define enter(), update(dt), and exit() callbacks. Missing callbacks
     *   are silently ignored.
     * @param {string} [initialState] - Optional state to enter immediately. If
     *   omitted the machine starts with no active state until transition() is
     *   called.
     */
    constructor(states, initialState) {
        /**
         * @type {Object<string, { enter?: Function, update?: Function, exit?: Function }>}
         * @private
         */
        this._states = states || {};

        /** @type {string|null} The name of the currently active state. */
        this.currentState = null;

        /**
         * @type {boolean} Guard flag to prevent re-entrant transitions during
         *   enter/exit callbacks.
         * @private
         */
        this._transitioning = false;

        /**
         * @type {string|null} If a transition is requested while one is already
         *   in progress, queue it for execution after the current one completes.
         * @private
         */
        this._pendingTransition = null;

        // Enter the initial state if one was provided.
        if (initialState) {
            this.transition(initialState);
        }
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Transition to a new state. Calls exit() on the current state and enter()
     * on the new state. If newState is the same as currentState, the transition
     * is skipped to avoid redundant re-entry.
     *
     * Re-entrant transition requests (transitions triggered inside enter/exit
     * callbacks) are queued and executed after the current transition completes.
     *
     * @param {string} newState - The name of the state to transition into.
     */
    transition(newState) {
        // Avoid double-entering the same state.
        if (newState === this.currentState) return;

        // Guard against re-entrant transitions triggered from within
        // enter() or exit() callbacks. Queue them instead.
        if (this._transitioning) {
            this._pendingTransition = newState;
            return;
        }

        this._transitioning = true;

        // Exit current state.
        const currentHandler = this._states[this.currentState];
        if (currentHandler && typeof currentHandler.exit === 'function') {
            currentHandler.exit();
        }

        // Enter new state.
        this.currentState = newState;
        const newHandler = this._states[newState];
        if (newHandler && typeof newHandler.enter === 'function') {
            newHandler.enter();
        }

        this._transitioning = false;

        // Process any transition that was queued during the enter/exit phase.
        if (this._pendingTransition !== null) {
            const pending = this._pendingTransition;
            this._pendingTransition = null;
            this.transition(pending);
        }
    }

    /**
     * Tick the current state. Should be called once per frame.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        const handler = this._states[this.currentState];
        if (handler && typeof handler.update === 'function') {
            handler.update(dt);
        }
    }

    /**
     * Check whether the machine is currently in a given state.
     *
     * @param {string} stateName
     * @returns {boolean}
     */
    is(stateName) {
        return this.currentState === stateName;
    }
}
