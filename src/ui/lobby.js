// =============================================================================
// lobby.js - Multiplayer Lobby Screen for RETRO FURY
// =============================================================================
// Handles the multiplayer lobby flow: host/join selection, room code entry,
// waiting for opponent, and ready-up before match start.
// =============================================================================

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = '"Courier New", Courier, monospace';

/** Blink interval for prompts (seconds per full cycle). */
const BLINK_INTERVAL = 1.0;

/** Scanline gap in pixels. */
const SCANLINE_GAP = 2;

/** Scanline opacity. */
const SCANLINE_ALPHA = 0.12;

// -----------------------------------------------------------------------------
// Lobby States
// -----------------------------------------------------------------------------

/** @enum {number} */
const LobbyState = Object.freeze({
    /** Choosing between HOST and JOIN. */
    CHOOSE:          0,
    /** Hosting — waiting for room code from server. */
    CREATING:        1,
    /** Hosting — displaying room code, waiting for opponent. */
    WAITING_HOST:    2,
    /** Joining — entering room code. */
    ENTERING_CODE:   3,
    /** Joining — connecting to room. */
    JOINING:         4,
    /** Both connected — waiting for both players to ready up. */
    READY_UP:        5,
    /** Countdown before match starts. */
    COUNTDOWN:       6,
});

// =============================================================================
// LobbyScreen Class
// =============================================================================

export class LobbyScreen {
    /**
     * @param {number} screenWidth  - Canvas width in pixels.
     * @param {number} screenHeight - Canvas height in pixels.
     */
    constructor(screenWidth, screenHeight) {
        /** @type {number} */
        this.screenWidth = screenWidth;

        /** @type {number} */
        this.screenHeight = screenHeight;

        /** @type {number} Current lobby sub-state. */
        this.state = LobbyState.CHOOSE;

        /** @type {number} Selected option in CHOOSE state (0=HOST, 1=JOIN). */
        this.selectedOption = 0;

        /** @type {string} Room code displayed to the host or entered by joiner. */
        this.roomCode = '';

        /** @type {string} Partial room code typed by the joining player. */
        this.codeInput = '';

        /** @type {boolean} Whether the local player has pressed ready. */
        this.localReady = false;

        /** @type {boolean} Whether the remote player is ready. */
        this.remoteReady = false;

        /** @type {string|null} Error message to display briefly. */
        this.errorMessage = null;

        /** @type {number} Timer for error message display. */
        this._errorTimer = 0;

        /** @type {number} Elapsed time for animations. */
        this._elapsed = 0;

        /** @type {number} Countdown value (3, 2, 1, 0=GO). */
        this.countdownValue = 3;

        /** @type {number} Countdown timer in seconds. */
        this._countdownTimer = 0;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Reset lobby to initial state.
     */
    reset() {
        this.state = LobbyState.CHOOSE;
        this.selectedOption = 0;
        this.roomCode = '';
        this.codeInput = '';
        this.localReady = false;
        this.remoteReady = false;
        this.errorMessage = null;
        this._errorTimer = 0;
        this.countdownValue = 3;
        this._countdownTimer = 0;
    }

    /**
     * Update timers.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        this._elapsed += dt;

        if (this._errorTimer > 0) {
            this._errorTimer -= dt;
            if (this._errorTimer <= 0) {
                this.errorMessage = null;
                this._errorTimer = 0;
            }
        }

        if (this.state === LobbyState.COUNTDOWN) {
            this._countdownTimer -= dt;
            if (this._countdownTimer <= 0) {
                this.countdownValue--;
                this._countdownTimer = 1.0;
            }
        }
    }

    /**
     * Handle a key press event in the lobby.
     *
     * @param {string} code - The key code (e.g., 'KeyW', 'Enter', 'Escape').
     * @returns {{ action: string, data?: any }|null} Action to take, or null.
     */
    handleKey(code) {
        switch (this.state) {
            case LobbyState.CHOOSE:
                return this._handleChooseKey(code);
            case LobbyState.ENTERING_CODE:
                return this._handleCodeEntryKey(code);
            case LobbyState.READY_UP:
                return this._handleReadyKey(code);
            default:
                if (code === 'Escape') {
                    return { action: 'back' };
                }
                return null;
        }
    }

    /**
     * Set the room code (from server response).
     *
     * @param {string} code
     */
    setRoomCode(code) {
        this.roomCode = code;
        this.state = LobbyState.WAITING_HOST;
    }

    /**
     * Signal that the opponent has joined the room.
     */
    opponentJoined() {
        this.state = LobbyState.READY_UP;
    }

    /**
     * Signal that the opponent is ready.
     */
    opponentReady() {
        this.remoteReady = true;
    }

    /**
     * Signal that the room was joined successfully.
     */
    joinedRoom() {
        this.state = LobbyState.READY_UP;
    }

    /**
     * Start the pre-match countdown.
     */
    startCountdown() {
        this.state = LobbyState.COUNTDOWN;
        this.countdownValue = 3;
        this._countdownTimer = 1.0;
    }

    /**
     * Show an error message for a few seconds.
     *
     * @param {string} msg
     */
    showError(msg) {
        this.errorMessage = msg;
        this._errorTimer = 3.0;
    }

    /**
     * Render the lobby screen.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        ctx.save();

        // -- Black background --
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        const cx = this.screenWidth / 2;

        // -- Header --
        ctx.font = `bold 14px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FF6622';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('MULTIPLAYER', cx, 10);

        // -- State-specific content --
        switch (this.state) {
            case LobbyState.CHOOSE:
                this._renderChoose(ctx, cx);
                break;
            case LobbyState.CREATING:
                this._renderCreating(ctx, cx);
                break;
            case LobbyState.WAITING_HOST:
                this._renderWaitingHost(ctx, cx);
                break;
            case LobbyState.ENTERING_CODE:
                this._renderCodeEntry(ctx, cx);
                break;
            case LobbyState.JOINING:
                this._renderJoining(ctx, cx);
                break;
            case LobbyState.READY_UP:
                this._renderReadyUp(ctx, cx);
                break;
            case LobbyState.COUNTDOWN:
                this._renderCountdown(ctx, cx);
                break;
        }

        // -- Error message --
        if (this.errorMessage) {
            ctx.font = `bold 8px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FF4444';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(this.errorMessage, cx, this.screenHeight - 20);
        }

        // -- Scanlines --
        this._renderScanlines(ctx);

        ctx.restore();
    }

    /**
     * Update screen dimensions.
     *
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
    }

    // -------------------------------------------------------------------------
    // Internal: Key Handlers
    // -------------------------------------------------------------------------

    /** @private */
    _handleChooseKey(code) {
        if (code === 'KeyW' || code === 'ArrowUp') {
            this.selectedOption = 0;
            return null;
        }
        if (code === 'KeyS' || code === 'ArrowDown') {
            this.selectedOption = 1;
            return null;
        }
        if (code === 'Enter') {
            if (this.selectedOption === 0) {
                this.state = LobbyState.CREATING;
                return { action: 'host' };
            } else {
                this.state = LobbyState.ENTERING_CODE;
                this.codeInput = '';
                return null;
            }
        }
        if (code === 'Escape') {
            return { action: 'back' };
        }
        return null;
    }

    /** @private */
    _handleCodeEntryKey(code) {
        if (code === 'Escape') {
            this.state = LobbyState.CHOOSE;
            return null;
        }
        if (code === 'Backspace') {
            this.codeInput = this.codeInput.slice(0, -1);
            return null;
        }
        if (code === 'Enter' && this.codeInput.length === 4) {
            this.state = LobbyState.JOINING;
            return { action: 'join', data: this.codeInput.toUpperCase() };
        }
        // Accept A-Z key input.
        if (code.startsWith('Key') && this.codeInput.length < 4) {
            const letter = code.charAt(3);
            this.codeInput += letter;
            return null;
        }
        return null;
    }

    /** @private */
    _handleReadyKey(code) {
        if (code === 'Enter' && !this.localReady) {
            this.localReady = true;
            return { action: 'ready' };
        }
        if (code === 'Escape') {
            return { action: 'back' };
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Internal: Render Sub-states
    // -------------------------------------------------------------------------

    /** @private */
    _renderChoose(ctx, cx) {
        const baseY = 50;

        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // HOST GAME option.
        ctx.fillStyle = this.selectedOption === 0 ? '#FFCC00' : '#666666';
        ctx.fillText(this.selectedOption === 0 ? '> HOST GAME <' : '  HOST GAME  ', cx, baseY);

        // JOIN GAME option.
        ctx.fillStyle = this.selectedOption === 1 ? '#FFCC00' : '#666666';
        ctx.fillText(this.selectedOption === 1 ? '> JOIN GAME <' : '  JOIN GAME  ', cx, baseY + 16);

        // Instructions.
        ctx.font = `7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#444444';
        ctx.fillText('W/S - SELECT  |  ENTER - CONFIRM  |  ESC - BACK', cx, baseY + 50);
    }

    /** @private */
    _renderCreating(ctx, cx) {
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#AAAAAA';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const dots = '.'.repeat((Math.floor(this._elapsed * 3) % 3) + 1);
        ctx.fillText(`CREATING ROOM${dots}`, cx, 70);
    }

    /** @private */
    _renderWaitingHost(ctx, cx) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Room code display.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#888888';
        ctx.fillText('ROOM CODE:', cx, 45);

        ctx.font = `bold 22px ${FONT_FAMILY}`;
        ctx.fillStyle = '#00FF88';
        ctx.fillText(this.roomCode, cx, 58);

        // Waiting message.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#AAAAAA';
        const dots = '.'.repeat((Math.floor(this._elapsed * 3) % 3) + 1);
        ctx.fillText(`WAITING FOR OPPONENT${dots}`, cx, 95);

        // Hint.
        ctx.font = `7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#444444';
        ctx.fillText('SHARE THIS CODE WITH YOUR OPPONENT', cx, 115);
        ctx.fillText('ESC - CANCEL', cx, 130);
    }

    /** @private */
    _renderCodeEntry(ctx, cx) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#888888';
        ctx.fillText('ENTER ROOM CODE:', cx, 45);

        // Code input boxes.
        const boxW = 18;
        const boxH = 22;
        const gap = 4;
        const totalW = boxW * 4 + gap * 3;
        const startX = cx - totalW / 2;

        for (let i = 0; i < 4; i++) {
            const bx = startX + i * (boxW + gap);
            const by = 60;

            // Box border.
            ctx.strokeStyle = i === this.codeInput.length ? '#FFCC00' : '#444444';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, boxW, boxH);

            // Letter.
            if (i < this.codeInput.length) {
                ctx.font = `bold 14px ${FONT_FAMILY}`;
                ctx.fillStyle = '#00FF88';
                ctx.fillText(this.codeInput[i], bx + boxW / 2, by + 4);
            } else if (i === this.codeInput.length) {
                // Blinking cursor.
                if (this._isBlinkOn()) {
                    ctx.font = `bold 14px ${FONT_FAMILY}`;
                    ctx.fillStyle = '#FFCC00';
                    ctx.fillText('_', bx + boxW / 2, by + 4);
                }
            }
        }

        // Instructions.
        ctx.font = `7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#444444';
        ctx.fillText('TYPE A-Z  |  BACKSPACE - DELETE  |  ENTER - JOIN', cx, 95);
        ctx.fillText('ESC - BACK', cx, 110);
    }

    /** @private */
    _renderJoining(ctx, cx) {
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#AAAAAA';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const dots = '.'.repeat((Math.floor(this._elapsed * 3) % 3) + 1);
        ctx.fillText(`JOINING ROOM ${this.codeInput}${dots}`, cx, 70);
    }

    /** @private */
    _renderReadyUp(ctx, cx) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Connected message.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#00FF88';
        ctx.fillText('OPPONENT CONNECTED!', cx, 45);

        // Player statuses.
        const statusY = 70;
        ctx.font = `bold 8px ${FONT_FAMILY}`;

        ctx.fillStyle = this.localReady ? '#00FF00' : '#FFCC00';
        ctx.fillText(this.localReady ? 'YOU: READY' : 'YOU: NOT READY', cx, statusY);

        ctx.fillStyle = this.remoteReady ? '#00FF00' : '#FF4444';
        ctx.fillText(this.remoteReady ? 'OPPONENT: READY' : 'OPPONENT: NOT READY', cx, statusY + 14);

        // Prompt.
        if (!this.localReady && this._isBlinkOn()) {
            ctx.font = `bold 10px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFCC00';
            ctx.fillText('PRESS ENTER WHEN READY', cx, 110);
        }

        if (this.localReady && !this.remoteReady) {
            ctx.font = `7px ${FONT_FAMILY}`;
            ctx.fillStyle = '#888888';
            ctx.fillText('WAITING FOR OPPONENT...', cx, 110);
        }
    }

    /** @private */
    _renderCountdown(ctx, cx) {
        const cy = this.screenHeight / 2;

        if (this.countdownValue > 0) {
            ctx.font = `bold 32px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFCC00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(this.countdownValue), cx, cy);
        } else {
            ctx.font = `bold 22px ${FONT_FAMILY}`;
            ctx.fillStyle = '#00FF00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('GO!', cx, cy);
        }

        // Weapon progression info below.
        ctx.font = `7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#666666';
        ctx.textBaseline = 'top';
        ctx.fillText('PISTOL > SHOTGUN > MACHINE GUN > SNIPER > KNIFE', cx, cy + 30);
        ctx.fillText('KNIFE KILL WINS!', cx, cy + 42);
    }

    // -------------------------------------------------------------------------
    // Internal: Helpers
    // -------------------------------------------------------------------------

    /** @private */
    _isBlinkOn() {
        return (this._elapsed % BLINK_INTERVAL) < (BLINK_INTERVAL * 0.6);
    }

    /** @private */
    _renderScanlines(ctx) {
        ctx.fillStyle = `rgba(0, 0, 0, ${SCANLINE_ALPHA})`;
        for (let y = 0; y < this.screenHeight; y += SCANLINE_GAP) {
            ctx.fillRect(0, y, this.screenWidth, 1);
        }
    }
}
