// =============================================================================
// scoreboard.js - Gun Game Weapon Tier Scoreboard for RETRO FURY
// =============================================================================
// Displays both players' weapon progression as a compact bar at the top-center
// of the screen. Each weapon tier is a labelled box; the current tier for each
// player is highlighted in their color (green for local, red for remote).
// =============================================================================

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = '"Courier New", Courier, monospace';

/** Tier abbreviations for the scoreboard boxes. */
const TIER_LABELS = ['P', 'SG', 'MG', 'SR', 'K'];

/** Full tier names for tooltip / overlay. */
const TIER_NAMES = ['PISTOL', 'SHOTGUN', 'MACHINE GUN', 'SNIPER', 'KNIFE'];

// =============================================================================
// ScoreboardDisplay Class
// =============================================================================

export class ScoreboardDisplay {
    constructor() {
        /** @type {number} Local player's current weapon tier (0-4). */
        this.localTier = 0;

        /** @type {number} Remote player's current weapon tier (0-4). */
        this.remoteTier = 0;

        /** @type {string} Local player display name. */
        this.localName = 'YOU';

        /** @type {string} Remote player display name. */
        this.remoteName = 'OPP';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Update the displayed tiers.
     *
     * @param {number} localTier
     * @param {number} remoteTier
     */
    setTiers(localTier, remoteTier) {
        this.localTier = localTier;
        this.remoteTier = remoteTier;
    }

    /**
     * Render the compact scoreboard bar.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenWidth
     */
    render(ctx, screenWidth) {
        ctx.save();

        const boxW = 16;
        const boxH = 10;
        const gap = 2;
        const tierCount = TIER_LABELS.length;
        const totalW = tierCount * boxW + (tierCount - 1) * gap;
        const startX = (screenWidth - totalW) / 2;
        const y = 2;

        ctx.font = `bold 6px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < tierCount; i++) {
            const bx = startX + i * (boxW + gap);

            // Box background.
            let bgColor = 'rgba(40, 40, 40, 0.8)';
            let textColor = '#555555';

            if (i === this.localTier && i === this.remoteTier) {
                // Both players on same tier — split color.
                bgColor = 'rgba(80, 80, 0, 0.8)';
                textColor = '#FFFF00';
            } else if (i === this.localTier) {
                bgColor = 'rgba(0, 60, 0, 0.8)';
                textColor = '#00FF44';
            } else if (i === this.remoteTier) {
                bgColor = 'rgba(60, 0, 0, 0.8)';
                textColor = '#FF4444';
            }

            ctx.fillStyle = bgColor;
            ctx.fillRect(bx, y, boxW, boxH);

            // Box border.
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, y, boxW, boxH);

            // Label.
            ctx.fillStyle = textColor;
            ctx.fillText(TIER_LABELS[i], bx + boxW / 2, y + boxH / 2);
        }

        // Player indicators below the bar.
        ctx.font = `5px ${FONT_FAMILY}`;
        ctx.textBaseline = 'top';

        // Local player marker.
        const localX = startX + this.localTier * (boxW + gap) + boxW / 2;
        ctx.fillStyle = '#00FF44';
        ctx.fillText(this.localName, localX, y + boxH + 1);

        // Remote player marker (only if on different tier to avoid overlap).
        if (this.remoteTier !== this.localTier) {
            const remoteX = startX + this.remoteTier * (boxW + gap) + boxW / 2;
            ctx.fillStyle = '#FF4444';
            ctx.fillText(this.remoteName, remoteX, y + boxH + 1);
        }

        ctx.restore();
    }

    /**
     * Render the full overlay (Tab held) with detailed weapon info.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenWidth
     * @param {number} screenHeight
     */
    renderOverlay(ctx, screenWidth, screenHeight) {
        ctx.save();

        const cx = screenWidth / 2;
        const panelW = Math.min(screenWidth * 0.8, 280);
        const panelH = 90;
        const panelX = cx - panelW / 2;
        const panelY = 20;

        // Background.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        // Border.
        ctx.strokeStyle = '#FFCC00';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Header.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFCC00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('GUN GAME PROGRESS', cx, panelY + 4);

        // Local player row.
        ctx.font = `7px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        const rowY1 = panelY + 20;
        ctx.fillStyle = '#00FF44';
        ctx.fillText(`${this.localName}:`, panelX + 6, rowY1);

        for (let i = 0; i < TIER_NAMES.length; i++) {
            const tx = panelX + 40 + i * 48;
            ctx.fillStyle = i === this.localTier ? '#00FF44' : (i < this.localTier ? '#006622' : '#333333');
            ctx.fillText(TIER_NAMES[i], tx, rowY1);
        }

        // Remote player row.
        const rowY2 = panelY + 34;
        ctx.fillStyle = '#FF4444';
        ctx.fillText(`${this.remoteName}:`, panelX + 6, rowY2);

        for (let i = 0; i < TIER_NAMES.length; i++) {
            const tx = panelX + 40 + i * 48;
            ctx.fillStyle = i === this.remoteTier ? '#FF4444' : (i < this.remoteTier ? '#662200' : '#333333');
            ctx.fillText(TIER_NAMES[i], tx, rowY2);
        }

        // Weapon progression.
        ctx.textAlign = 'center';
        ctx.font = `6px ${FONT_FAMILY}`;
        ctx.fillStyle = '#666666';
        ctx.fillText('PISTOL > SHOTGUN > MACHINE GUN > SNIPER > KNIFE', cx, panelY + 55);
        ctx.fillText('KILL WITH KNIFE TO WIN!', cx, panelY + 66);

        ctx.restore();
    }
}
