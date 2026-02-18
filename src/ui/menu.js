// =============================================================================
// menu.js - All Menu Screens for RETRO FURY
// =============================================================================
// Manages the title screen, pause overlay, death screen, and victory screen.
// All screens use heavy retro styling: scanlines, CRT vignette, monospace
// fonts, neon-on-dark color palettes, and blinking text.
// =============================================================================

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = '"Courier New", Courier, monospace';

/** Blink interval for "PRESS ENTER" prompts (seconds per full cycle). */
const BLINK_INTERVAL = 1.0;

/** Scanline gap in pixels (every Nth pixel row is darkened). */
const SCANLINE_GAP = 2;

/** Scanline opacity. */
const SCANLINE_ALPHA = 0.12;

// =============================================================================
// MenuSystem Class
// =============================================================================

export class MenuSystem {
    /**
     * @param {number} screenWidth  - Canvas width in pixels.
     * @param {number} screenHeight - Canvas height in pixels.
     */
    constructor(screenWidth, screenHeight) {
        /** @type {number} */
        this.screenWidth = screenWidth;

        /** @type {number} */
        this.screenHeight = screenHeight;

        /** @type {number} Elapsed time accumulator for animations. */
        this._elapsed = 0;

        /** @type {number} Selected mode on title screen (0=single, 1=multi). */
        this.selectedMode = 0;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Advance internal timers. Call once per frame regardless of which screen
     * is active so blinking and animation timings stay consistent.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        this._elapsed += dt;
    }

    /**
     * Render the title screen.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    renderTitle(ctx) {
        ctx.save();

        // -- Black background --
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        const cx = this.screenWidth / 2;
        const cy = this.screenHeight / 2;

        // -- Subtle background glow --
        const glow = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, this.screenWidth * 0.5);
        glow.addColorStop(0, 'rgba(255, 40, 0, 0.08)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        // -- Title: "RETRO FURY" --
        this._drawRetroTitle(ctx, cx, cy - 30);

        // -- Subtitle tagline --
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('A RETRO FIRST-PERSON SHOOTER', cx, cy - 5);

        // -- Mode selection --
        const modeY = cy + 12;
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.fillStyle = this.selectedMode === 0 ? '#FFCC00' : '#666666';
        ctx.fillText(this.selectedMode === 0 ? '> SINGLE PLAYER <' : '  SINGLE PLAYER  ', cx, modeY);

        ctx.fillStyle = this.selectedMode === 1 ? '#FFCC00' : '#666666';
        ctx.fillText(this.selectedMode === 1 ? '> MULTIPLAYER <' : '  MULTIPLAYER  ', cx, modeY + 14);

        // -- Controls list --
        const controlsY = cy + 55;
        ctx.font = `8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('WASD - MOVE  |  MOUSE - AIM  |  CLICK - FIRE  |  E - INTERACT', cx, controlsY);
        ctx.fillText('1-7 - WEAPONS  |  M - MAP  |  TAB - OBJECTIVES  |  ESC - PAUSE', cx, controlsY + 12);

        // -- Blinking prompt --
        if (this._isBlinkOn()) {
            ctx.font = `bold 9px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FF6622';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('PRESS ENTER', cx, controlsY + 30);
        }

        // -- Scanlines and CRT effects --
        this._renderScanlines(ctx);
        this._renderVignette(ctx);

        ctx.restore();
    }

    /**
     * Render the pause overlay on top of the game view.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    renderPause(ctx, { isMultiplayer = false } = {}) {
        ctx.save();

        // -- Semi-transparent dark overlay --
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        const cx = this.screenWidth / 2;
        const cy = this.screenHeight / 2;

        // -- "PAUSED" text --
        ctx.font = `bold 22px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text shadow.
        ctx.fillStyle = '#FF4400';
        ctx.fillText('PAUSED', cx + 2, cy - 20 + 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('PAUSED', cx, cy - 20);

        // -- Options --
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#AAAAAA';
        ctx.textBaseline = 'top';
        ctx.fillText('ESC - RESUME', cx, cy + 15);
        if (!isMultiplayer) {
            ctx.fillText('R - RESTART LEVEL', cx, cy + 30);
        }
        ctx.fillText('Q - QUIT TO TITLE', cx, cy + (isMultiplayer ? 30 : 45));

        // -- Scanlines --
        this._renderScanlines(ctx);

        ctx.restore();
    }

    /**
     * Render the death screen.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ kills: number, time: number }} stats - Session stats.
     */
    renderDeath(ctx, stats) {
        ctx.save();

        // -- Dark red background --
        ctx.fillStyle = '#0A0000';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        // Blood-red vignette.
        const vg = ctx.createRadialGradient(
            this.screenWidth / 2, this.screenHeight / 2, 10,
            this.screenWidth / 2, this.screenHeight / 2, this.screenWidth * 0.6
        );
        vg.addColorStop(0, 'rgba(80, 0, 0, 0.3)');
        vg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        const cx = this.screenWidth / 2;
        const cy = this.screenHeight / 2;

        // -- "YOU ARE DEAD" --
        ctx.font = `bold 26px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glowing red text with shadow layers.
        ctx.fillStyle = '#330000';
        ctx.fillText('YOU ARE DEAD', cx + 3, cy - 30 + 3);
        ctx.fillStyle = '#880000';
        ctx.fillText('YOU ARE DEAD', cx + 1, cy - 30 + 1);
        ctx.fillStyle = '#FF0000';
        ctx.fillText('YOU ARE DEAD', cx, cy - 30);

        // -- Stats --
        if (stats) {
            ctx.font = `bold 9px ${FONT_FAMILY}`;
            ctx.fillStyle = '#CC4444';
            ctx.textBaseline = 'top';

            const kills = stats.kills !== undefined ? stats.kills : 0;
            const timeSec = stats.time !== undefined ? stats.time : 0;
            const minutes = Math.floor(timeSec / 60);
            const seconds = Math.floor(timeSec % 60);
            const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

            ctx.fillText(`KILLS: ${kills}`, cx, cy + 0);
            ctx.fillText(`TIME SURVIVED: ${timeStr}`, cx, cy + 18);
        }

        // -- Blinking "PRESS ENTER TO RETRY" --
        if (this._isBlinkOn()) {
            ctx.font = `bold 10px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FF4444';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('PRESS ENTER OR R TO RETRY', cx, cy + 50);
        }

        // -- Scanlines --
        this._renderScanlines(ctx);
        this._renderVignette(ctx);

        ctx.restore();
    }

    /**
     * Render the victory screen (after completing level 5).
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ totalKills: number, totalTime: number, accuracy: number }} totalStats
     */
    renderVictory(ctx, totalStats) {
        ctx.save();

        // -- Dark background --
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        // Golden glow.
        const glow = ctx.createRadialGradient(
            this.screenWidth / 2, this.screenHeight / 2 - 20, 20,
            this.screenWidth / 2, this.screenHeight / 2 - 20, this.screenWidth * 0.5
        );
        glow.addColorStop(0, 'rgba(255, 200, 0, 0.1)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        const cx = this.screenWidth / 2;
        const cy = this.screenHeight / 2;

        // -- "MISSION COMPLETE" in gold --
        ctx.font = `bold 22px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow.
        ctx.fillStyle = '#332200';
        ctx.fillText('MISSION COMPLETE', cx + 2, cy - 40 + 2);
        // Gold text.
        ctx.fillStyle = '#FFD700';
        ctx.fillText('MISSION COMPLETE', cx, cy - 40);

        // -- Total stats --
        if (totalStats) {
            ctx.font = `bold 9px ${FONT_FAMILY}`;
            ctx.textBaseline = 'top';

            const kills = totalStats.totalKills !== undefined ? totalStats.totalKills : 0;
            const timeSec = totalStats.totalTime !== undefined ? totalStats.totalTime : 0;
            const minutes = Math.floor(timeSec / 60);
            const seconds = Math.floor(timeSec % 60);
            const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
            const accuracy = totalStats.accuracy !== undefined
                ? `${Math.round(totalStats.accuracy)}%`
                : 'N/A';

            ctx.fillStyle = '#CCAA44';
            ctx.fillText(`TOTAL KILLS: ${kills}`, cx, cy - 5);
            ctx.fillText(`TOTAL TIME: ${timeStr}`, cx, cy + 10);
            ctx.fillText(`ACCURACY: ${accuracy}`, cx, cy + 25);
        }

        // -- Congratulations message --
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#888866';
        ctx.textBaseline = 'top';
        ctx.fillText('THE FACILITY IS DESTROYED. EARTH IS SAFE... FOR NOW.', cx, cy + 50);

        // -- Blinking prompt --
        if (this._isBlinkOn()) {
            ctx.font = `bold 10px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('PRESS ENTER TO PLAY AGAIN', cx, cy + 70);
        }

        // -- Scanlines and CRT --
        this._renderScanlines(ctx);
        this._renderVignette(ctx);

        ctx.restore();
    }

    /**
     * Handle key input on the title screen for mode selection.
     *
     * @param {string} code - Key code.
     * @returns {string|null} 'singleplayer', 'multiplayer', or null.
     */
    handleTitleKey(code) {
        if (code === 'KeyW' || code === 'ArrowUp') {
            this.selectedMode = 0;
            return null;
        }
        if (code === 'KeyS' || code === 'ArrowDown') {
            this.selectedMode = 1;
            return null;
        }
        if (code === 'Enter') {
            return this.selectedMode === 0 ? 'singleplayer' : 'multiplayer';
        }
        return null;
    }

    /**
     * Get the currently selected game mode.
     *
     * @returns {'singleplayer'|'multiplayer'}
     */
    getSelectedMode() {
        return this.selectedMode === 0 ? 'singleplayer' : 'multiplayer';
    }

    /**
     * Update screen dimensions if the canvas is resized.
     *
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
    }

    // -------------------------------------------------------------------------
    // Internal: Retro Title Rendering
    // -------------------------------------------------------------------------

    /**
     * Draw the "RETRO FURY" title in large, stylized retro text.
     * Uses multiple layered draws for a glowing neon effect.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx - Center X.
     * @param {number} cy - Center Y.
     * @private
     */
    _drawRetroTitle(ctx, cx, cy) {
        const title = 'RETRO FURY';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Outer glow layer.
        ctx.font = `bold 32px ${FONT_FAMILY}`;
        ctx.fillStyle = 'rgba(255, 60, 0, 0.15)';
        ctx.fillText(title, cx, cy);

        // Drop shadow.
        ctx.fillStyle = '#440000';
        ctx.fillText(title, cx + 3, cy + 3);

        // Main text - bright red/orange gradient simulation.
        ctx.fillStyle = '#FF4400';
        ctx.fillText(title, cx + 1, cy + 1);
        ctx.fillStyle = '#FF6622';
        ctx.fillText(title, cx, cy);

        // Highlight pass (top edge catch-light effect).
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, cy - 18, this.screenWidth, 10);
        ctx.clip();
        ctx.fillStyle = '#FFAA44';
        ctx.fillText(title, cx, cy);
        ctx.restore();

        // Thin underline accent.
        const textMetrics = ctx.measureText(title);
        const textW = textMetrics.width;
        ctx.strokeStyle = '#FF4400';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - textW / 2, cy + 18);
        ctx.lineTo(cx + textW / 2, cy + 18);
        ctx.stroke();

        // Decorative dots at line ends.
        ctx.fillStyle = '#FF6622';
        ctx.beginPath();
        ctx.arc(cx - textW / 2, cy + 18, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + textW / 2, cy + 18, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // -------------------------------------------------------------------------
    // Internal: CRT / Retro Effects
    // -------------------------------------------------------------------------

    /**
     * Draw horizontal scanlines across the entire screen for a CRT monitor feel.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @private
     */
    _renderScanlines(ctx) {
        ctx.fillStyle = `rgba(0, 0, 0, ${SCANLINE_ALPHA})`;
        for (let y = 0; y < this.screenHeight; y += SCANLINE_GAP) {
            ctx.fillRect(0, y, this.screenWidth, 1);
        }
    }

    /**
     * Draw a CRT vignette effect that darkens the corners and edges.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @private
     */
    _renderVignette(ctx) {
        const cx = this.screenWidth / 2;
        const cy = this.screenHeight / 2;
        const radius = Math.max(this.screenWidth, this.screenHeight) * 0.7;

        const vg = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius);
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, 0.6)');

        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
    }

    // -------------------------------------------------------------------------
    // Internal: Blink Helper
    // -------------------------------------------------------------------------

    /**
     * Returns true during the "on" phase of a blink cycle.
     *
     * @returns {boolean}
     * @private
     */
    _isBlinkOn() {
        return (this._elapsed % BLINK_INTERVAL) < (BLINK_INTERVAL * 0.6);
    }

    /**
     * Public blink state accessor for external UI elements.
     *
     * @returns {boolean}
     */
    isBlinkOn() {
        return this._isBlinkOn();
    }
}
