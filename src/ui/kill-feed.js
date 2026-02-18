// =============================================================================
// kill-feed.js - Kill Notification Overlay for RETRO FURY Multiplayer
// =============================================================================
// Displays recent kill notifications in the top-left corner of the screen.
// Each entry shows "KILLER [WEAPON] VICTIM" and fades out over time.
// =============================================================================

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = '"Courier New", Courier, monospace';

/** Maximum number of visible entries. */
const MAX_ENTRIES = 3;

/** How long each entry stays visible (seconds). */
const ENTRY_LIFETIME = 4.0;

/** Fade-out begins this many seconds before removal. */
const FADE_DURATION = 1.0;

// =============================================================================
// KillFeed Class
// =============================================================================

export class KillFeed {
    constructor() {
        /**
         * @type {Array<{
         *   killer: string,
         *   victim: string,
         *   weapon: string,
         *   timer: number
         * }>}
         */
        this._entries = [];
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Add a kill notification.
     *
     * @param {string} killer - Killer's display name.
     * @param {string} victim - Victim's display name.
     * @param {string} weapon - Weapon name used for the kill.
     */
    addKill(killer, victim, weapon) {
        this._entries.push({
            killer,
            victim,
            weapon,
            timer: ENTRY_LIFETIME,
        });

        // Trim to max visible entries.
        if (this._entries.length > MAX_ENTRIES) {
            this._entries.shift();
        }
    }

    /**
     * Update entry timers. Call once per frame.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        for (let i = this._entries.length - 1; i >= 0; i--) {
            this._entries[i].timer -= dt;
            if (this._entries[i].timer <= 0) {
                this._entries.splice(i, 1);
            }
        }
    }

    /**
     * Render the kill feed overlay.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (this._entries.length === 0) return;

        ctx.save();
        ctx.font = `7px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const x = 4;
        let y = 4;
        const lineH = 10;

        for (const entry of this._entries) {
            // Calculate alpha for fade-out.
            let alpha = 1.0;
            if (entry.timer < FADE_DURATION) {
                alpha = Math.max(0, entry.timer / FADE_DURATION);
            }

            ctx.globalAlpha = alpha;

            // Background pill.
            const text = `${entry.killer} [${entry.weapon}] ${entry.victim}`;
            const textW = ctx.measureText(text).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x - 2, y - 1, textW + 4, lineH);

            // Killer name in green, weapon in yellow, victim in red.
            let curX = x;

            ctx.fillStyle = '#00FF88';
            ctx.fillText(entry.killer, curX, y);
            curX += ctx.measureText(entry.killer).width;

            ctx.fillStyle = '#FFCC00';
            const weaponText = ` [${entry.weapon}] `;
            ctx.fillText(weaponText, curX, y);
            curX += ctx.measureText(weaponText).width;

            ctx.fillStyle = '#FF4444';
            ctx.fillText(entry.victim, curX, y);

            y += lineH;
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    /**
     * Clear all entries.
     */
    clear() {
        this._entries.length = 0;
    }
}
