// =============================================================================
// transitions.js - Level Transitions for RETRO FURY
// =============================================================================
// Handles level intro screens with typewriter briefing text, level complete
// screens with stats and letter grades, and fade-to-black overlays for smooth
// transitions between game states. All rendering uses heavy retro styling.
// =============================================================================

import { clamp } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = '"Courier New", Courier, monospace';

/** Typewriter speed: characters revealed per second. */
const TYPEWRITER_SPEED = 30;

/** Blink interval for "PRESS ENTER" prompts (seconds per full cycle). */
const BLINK_INTERVAL = 1.0;

/** Scanline gap and opacity (shared with menu.js for consistent look). */
const SCANLINE_GAP = 2;
const SCANLINE_ALPHA = 0.12;

// =============================================================================
// TransitionSystem Class
// =============================================================================

export class TransitionSystem {
    /**
     * @param {number} screenWidth  - Canvas width in pixels.
     * @param {number} screenHeight - Canvas height in pixels.
     */
    constructor(screenWidth, screenHeight) {
        /** @type {number} */
        this.screenWidth = screenWidth;

        /** @type {number} */
        this.screenHeight = screenHeight;

        /** @type {number} Elapsed time for animations and blinking. */
        this._elapsed = 0;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Advance the internal timer. Call once per frame.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        this._elapsed += dt;
    }

    /**
     * Render the level intro / briefing screen.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ name: string, briefing: string, levelNumber: number }} levelData
     *   Level metadata for the intro screen.
     * @param {number} charIndex - Number of briefing characters revealed so far.
     *   The caller advances this each frame via TYPEWRITER_SPEED.
     */
    renderLevelIntro(ctx, levelData, charIndex) {
        ctx.save();

        // -- Black background --
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        const cx = this.screenWidth / 2;
        const topY = 20;

        // -- Mission number and name --
        const levelNum = levelData.levelNumber || 1;
        const missionTitle = `MISSION ${levelNum}: ${(levelData.name || 'UNKNOWN').toUpperCase()}`;

        ctx.font = `bold 14px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Glow shadow.
        ctx.fillStyle = '#331100';
        ctx.fillText(missionTitle, cx + 2, topY + 2);
        // Main text.
        ctx.fillStyle = '#FF6622';
        ctx.fillText(missionTitle, cx, topY);

        // Underline.
        const titleW = ctx.measureText(missionTitle).width;
        ctx.strokeStyle = '#FF4400';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - titleW / 2, topY + 22);
        ctx.lineTo(cx + titleW / 2, topY + 22);
        ctx.stroke();

        // -- Briefing text with typewriter effect --
        const briefing = levelData.briefing || '';
        const revealed = briefing.substring(0, Math.floor(clamp(charIndex, 0, briefing.length)));

        const briefingX = 40;
        const briefingY = topY + 35;
        const maxWidth = this.screenWidth - 80;

        ctx.font = `8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#AAAAAA';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        this._drawWrappedText(ctx, revealed, briefingX, briefingY, maxWidth, 12);

        // -- Blinking cursor at end of revealed text --
        if (charIndex < briefing.length) {
            // Show a blinking underscore cursor.
            if (this._isBlinkOn(4)) { // Fast blink for cursor.
                const lines = this._getWrappedLines(ctx, revealed, maxWidth);
                const lastLine = lines[lines.length - 1] || '';
                const lastLineW = ctx.measureText(lastLine).width;
                const cursorY = briefingY + (lines.length - 1) * 12;

                ctx.fillStyle = '#FFCC00';
                ctx.fillRect(briefingX + lastLineW + 2, cursorY + 14, 8, 3);
            }
        }

        // -- "PRESS ENTER TO BEGIN" after all text is revealed --
        if (charIndex >= briefing.length) {
            if (this._isBlinkOn()) {
                ctx.font = `bold 10px ${FONT_FAMILY}`;
                ctx.fillStyle = '#FFCC00';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText('PRESS ENTER TO BEGIN', cx, this.screenHeight - 25);
            }
        }

        // -- Scanlines --
        this._renderScanlines(ctx);

        ctx.restore();
    }

    /**
     * Render the level complete stats screen.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{
     *   kills: number,
     *   totalEnemies: number,
     *   time: number,
     *   parTime: number,
     *   levelName: string,
     *   levelNumber: number
     * }} stats - Level completion statistics.
     */
    renderLevelComplete(ctx, stats) {
        ctx.save();

        // -- Dark background --
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        const cx = this.screenWidth / 2;
        let y = 15;

        // -- "MISSION COMPLETE" header --
        ctx.font = `bold 18px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Shadow.
        ctx.fillStyle = '#003300';
        ctx.fillText('MISSION COMPLETE', cx + 2, y + 2);
        // Green text.
        ctx.fillStyle = '#00FF44';
        ctx.fillText('MISSION COMPLETE', cx, y);

        y += 28;

        // -- Mission name --
        const levelNum = stats.levelNumber || 1;
        const levelName = (stats.levelName || 'UNKNOWN').toUpperCase();
        ctx.font = `bold 9px ${FONT_FAMILY}`;
        ctx.fillStyle = '#888888';
        ctx.fillText(`MISSION ${levelNum}: ${levelName}`, cx, y);

        y += 18;

        // -- Divider --
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 150, y);
        ctx.lineTo(cx + 150, y);
        ctx.stroke();

        y += 10;

        // -- Stats section --
        const kills = stats.kills !== undefined ? stats.kills : 0;
        const totalEnemies = stats.totalEnemies !== undefined ? stats.totalEnemies : 0;
        const time = stats.time !== undefined ? stats.time : 0;
        const parTime = stats.parTime !== undefined ? stats.parTime : 0;

        // Kills.
        ctx.font = `bold 10px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(`KILLS`, cx, y);
        y += 14;

        const killPct = totalEnemies > 0 ? Math.round((kills / totalEnemies) * 100) : 0;
        ctx.font = `bold 12px ${FONT_FAMILY}`;
        ctx.fillStyle = killPct === 100 ? '#00FF44' : '#FFCC00';
        ctx.fillText(`${kills} / ${totalEnemies}  (${killPct}%)`, cx, y);
        y += 22;

        // Time.
        ctx.font = `bold 10px ${FONT_FAMILY}`;
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText('TIME', cx, y);
        y += 14;

        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

        const parMinutes = Math.floor(parTime / 60);
        const parSeconds = Math.floor(parTime % 60);
        const parStr = `${parMinutes}:${String(parSeconds).padStart(2, '0')}`;

        const underPar = time <= parTime;

        ctx.font = `bold 12px ${FONT_FAMILY}`;
        ctx.fillStyle = underPar ? '#00FF44' : '#FF4444';
        ctx.fillText(timeStr, cx, y);
        y += 16;

        // Par time comparison.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#888888';
        ctx.fillText(`PAR: ${parStr}`, cx - 60, y);

        ctx.fillStyle = underPar ? '#00CC44' : '#CC4444';
        ctx.fillText(underPar ? 'UNDER PAR' : 'OVER PAR', cx + 60, y);
        y += 18;

        // -- Letter grade --
        const grade = this.calculateGrade(kills, totalEnemies, time, parTime);
        this._renderGrade(ctx, cx, y, grade);
        y += 70;

        // -- Blinking prompt --
        if (this._isBlinkOn()) {
            ctx.font = `bold 10px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFCC00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('PRESS ENTER TO CONTINUE', cx, this.screenHeight - 20);
        }

        // -- Scanlines --
        this._renderScanlines(ctx);

        ctx.restore();
    }

    /**
     * Render a fade-to-black overlay. Used for transitions between screens.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} alpha - Opacity of the black overlay (0 = clear, 1 = full black).
     */
    renderFade(ctx, alpha) {
        if (alpha <= 0) return;

        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${clamp(alpha, 0, 1)})`;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
        ctx.restore();
    }

    /**
     * Calculate a letter grade based on performance.
     *
     * - S: 100% kills AND under par time
     * - A: > 90% kills or (100% kills)
     * - B: > 70% kills
     * - C: > 50% kills
     * - D: everything else
     *
     * @param {number} kills       - Enemies killed.
     * @param {number} totalEnemies - Total enemies in the level.
     * @param {number} time        - Player's completion time in seconds.
     * @param {number} parTime     - Par time in seconds.
     * @returns {string} Letter grade ('S', 'A', 'B', 'C', or 'D').
     */
    calculateGrade(kills, totalEnemies, time, parTime) {
        const killPct = totalEnemies > 0 ? kills / totalEnemies : 0;
        const underPar = time <= parTime;

        if (killPct >= 1.0 && underPar) return 'S';
        if (killPct > 0.9) return 'A';
        if (killPct > 0.7) return 'B';
        if (killPct > 0.5) return 'C';
        return 'D';
    }

    /**
     * Get the typewriter speed constant so the caller knows how fast to
     * advance charIndex.
     *
     * @returns {number} Characters per second.
     */
    static getTypewriterSpeed() {
        return TYPEWRITER_SPEED;
    }

    /**
     * Reset the internal elapsed timer to zero. Used when transitioning into
     * a new level intro screen so blinking animations restart cleanly.
     */
    resetElapsed() {
        this._elapsed = 0;
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
    // Internal: Grade Display
    // -------------------------------------------------------------------------

    /**
     * Render a large letter grade with appropriate color and styling.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx - Center X.
     * @param {number} y  - Top Y.
     * @param {string} grade - Letter grade string.
     * @private
     */
    _renderGrade(ctx, cx, y, grade) {
        // Grade colors.
        const colors = {
            'S': { main: '#FFD700', glow: '#FFA500', shadow: '#664400' },
            'A': { main: '#00FF44', glow: '#00CC33', shadow: '#003300' },
            'B': { main: '#44AAFF', glow: '#2288CC', shadow: '#001133' },
            'C': { main: '#FFAA00', glow: '#CC8800', shadow: '#332200' },
            'D': { main: '#FF4444', glow: '#CC2222', shadow: '#330000' },
        };

        const col = colors[grade] || colors['D'];

        // "RANK" label.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('RANK', cx, y);

        // Large grade letter.
        ctx.font = `bold 28px ${FONT_FAMILY}`;
        ctx.textBaseline = 'top';

        // Glow shadow.
        ctx.fillStyle = col.shadow;
        ctx.fillText(grade, cx + 2, y + 12 + 2);

        // Main letter.
        ctx.fillStyle = col.main;
        ctx.fillText(grade, cx, y + 12);

        // Special sparkle effect for S rank.
        if (grade === 'S') {
            const sparkle = Math.abs(Math.sin(this._elapsed * 3));
            ctx.fillStyle = `rgba(255, 215, 0, ${sparkle * 0.4})`;
            ctx.font = `bold 30px ${FONT_FAMILY}`;
            ctx.fillText(grade, cx, y + 10);
        }
    }

    // -------------------------------------------------------------------------
    // Internal: Text Wrapping
    // -------------------------------------------------------------------------

    /**
     * Draw text wrapped to a maximum width.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {number} maxWidth
     * @param {number} lineHeight
     * @private
     */
    _drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const lines = this._getWrappedLines(ctx, text, maxWidth);

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, y + i * lineHeight);
        }
    }

    /**
     * Split text into lines that fit within maxWidth.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} maxWidth
     * @returns {string[]}
     * @private
     */
    _getWrappedLines(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        // Handle the case of empty text.
        if (lines.length === 0) {
            lines.push('');
        }

        return lines;
    }

    // -------------------------------------------------------------------------
    // Internal: CRT Effects
    // -------------------------------------------------------------------------

    /**
     * Draw scanlines for a CRT feel.
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

    // -------------------------------------------------------------------------
    // Internal: Blink Helper
    // -------------------------------------------------------------------------

    /**
     * Returns true during the "on" phase of a blink cycle.
     *
     * @param {number} [speed=1] - Blink speed multiplier.
     * @returns {boolean}
     * @private
     */
    _isBlinkOn(speed = 1) {
        const interval = BLINK_INTERVAL / speed;
        return (this._elapsed % interval) < (interval * 0.6);
    }
}
