// =============================================================================
// input.js - Keyboard, mouse, and pointer lock input manager for RETRO FURY
// =============================================================================

// Keys that should have their browser default behavior suppressed during play.
const SUPPRESSED_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',   // Movement
    'KeyE',                             // Interact / use
    'KeyM',                             // Map toggle
    'Tab',                              // Scoreboard / inventory
    'Digit1', 'Digit2', 'Digit3',      // Weapon slots
    'Digit4', 'Digit5',
    'Escape',                           // Menu / release pointer lock
]);

class InputManager {
    constructor() {
        /** @type {Set<string>} Currently held keys (uses event.code). */
        this._keysDown = new Set();

        /** @type {boolean} Whether the left mouse button is currently held. */
        this._mouseDown = false;

        /** @type {boolean} One-shot flag: true on the frame the mouse was pressed. */
        this._mousePressed = false;

        /** @type {number} Accumulated horizontal mouse movement this frame. */
        this._mouseDeltaX = 0;

        /** @type {number} Accumulated vertical mouse movement this frame. */
        this._mouseDeltaY = 0;

        /** @type {HTMLCanvasElement | null} The canvas element to request pointer lock on. */
        this._canvas = null;

        /** @type {boolean} Whether pointer lock is currently active. */
        this._pointerLocked = false;

        // Bind event handlers so they can be removed if needed.
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onPointerLockChange = this._onPointerLockChange.bind(this);
        this._onCanvasClick = this._onCanvasClick.bind(this);
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Attach all event listeners. Must be called once at startup.
     * @param {HTMLCanvasElement} canvas - The game canvas to bind pointer lock to.
     */
    init(canvas) {
        this._canvas = canvas;

        // Keyboard
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);

        // Mouse buttons
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);

        // Mouse movement (only meaningful while pointer is locked)
        window.addEventListener('mousemove', this._onMouseMove);

        // Pointer lock state changes
        document.addEventListener('pointerlockchange', this._onPointerLockChange);

        // Click on canvas to request pointer lock
        canvas.addEventListener('click', this._onCanvasClick);
    }

    /**
     * Call once per frame **after** all game logic has consumed input.
     * Resets per-frame deltas so they do not accumulate across frames.
     */
    update() {
        this._mouseDeltaX = 0;
        this._mouseDeltaY = 0;
        this._mousePressed = false;
    }

    /**
     * Remove all event listeners. Call on teardown / cleanup.
     */
    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup', this._onMouseUp);
        window.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('pointerlockchange', this._onPointerLockChange);

        if (this._canvas) {
            this._canvas.removeEventListener('click', this._onCanvasClick);
        }
    }

    // -------------------------------------------------------------------------
    // Query Methods (read during game update)
    // -------------------------------------------------------------------------

    /**
     * Returns true while the given key is held down.
     * @param {string} code - The KeyboardEvent.code value (e.g. 'KeyW', 'Space').
     * @returns {boolean}
     */
    isKeyDown(code) {
        return this._keysDown.has(code);
    }

    /**
     * Returns true while the left mouse button is held.
     * @returns {boolean}
     */
    isMouseDown() {
        return this._mouseDown;
    }

    /**
     * Returns true only on the single frame the left mouse button was pressed.
     * @returns {boolean}
     */
    isMousePressed() {
        return this._mousePressed;
    }

    /**
     * Horizontal mouse movement accumulated since last update().
     * Positive = rightward.
     * @returns {number}
     */
    getMouseDeltaX() {
        return this._mouseDeltaX;
    }

    /**
     * Vertical mouse movement accumulated since last update().
     * Positive = downward (raw browser convention).
     * @returns {number}
     */
    getMouseDeltaY() {
        return this._mouseDeltaY;
    }

    /**
     * Whether the pointer is currently locked to the canvas.
     * @returns {boolean}
     */
    isPointerLocked() {
        return this._pointerLocked;
    }

    // -------------------------------------------------------------------------
    // Internal Event Handlers
    // -------------------------------------------------------------------------

    /** @param {KeyboardEvent} e */
    _onKeyDown(e) {
        if (SUPPRESSED_KEYS.has(e.code)) {
            e.preventDefault();
        }
        this._keysDown.add(e.code);
    }

    /** @param {KeyboardEvent} e */
    _onKeyUp(e) {
        this._keysDown.delete(e.code);
    }

    /** @param {MouseEvent} e */
    _onMouseDown(e) {
        if (e.button === 0) { // Left button
            this._mouseDown = true;
            this._mousePressed = true;
        }
    }

    /** @param {MouseEvent} e */
    _onMouseUp(e) {
        if (e.button === 0) {
            this._mouseDown = false;
        }
    }

    /** @param {MouseEvent} e */
    _onMouseMove(e) {
        if (!this._pointerLocked) return;
        this._mouseDeltaX += e.movementX;
        this._mouseDeltaY += e.movementY;
    }

    _onPointerLockChange() {
        this._pointerLocked = document.pointerLockElement === this._canvas;
        if (this._pointerLocked) {
            document.body.classList.add('pointer-locked');
        } else {
            document.body.classList.remove('pointer-locked');
        }
    }

    _onCanvasClick() {
        if (!this._pointerLocked && this._canvas) {
            this._canvas.requestPointerLock();
        }
    }
}

// Export a singleton so every module shares the same input state.
const input = new InputManager();
export default input;
