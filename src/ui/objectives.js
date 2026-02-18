// =============================================================================
// objectives.js - Objective Tracker & Hint System for RETRO FURY
// =============================================================================
// Tracks level objectives, renders progress counters on the HUD, shows
// completion effects, and provides time-based hints when the player is stuck.
//
// Objectives are defined per-level and set via setObjectives(). Each objective
// has a description, a short label for the counter, and a hint string.
// =============================================================================

import { clamp } from '../utils/math.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FONT_FAMILY = '"Courier New", Courier, monospace';

/** Seconds before a hint is offered if the player has not progressed. */
const HINT_DELAY = 60;

/** How long the hint text stays fully visible (seconds). */
const HINT_DISPLAY_TIME = 5.0;

/** Fade-in and fade-out duration for hint text (seconds). */
const HINT_FADE_DURATION = 1.0;

/** How long the "OBJECTIVE COMPLETE" banner stays on screen (seconds). */
const COMPLETION_BANNER_DURATION = 3.0;

// =============================================================================
// ObjectiveSystem Class
// =============================================================================

export class ObjectiveSystem {
    constructor() {
        /**
         * @type {Array<{
         *   description: string,
         *   label: string,
         *   hint: string,
         *   completed: boolean
         * }>}
         * Current level objectives.
         */
        this.objectives = [];

        /** @type {number} Number of objectives completed so far. */
        this.completedCount = 0;

        /** @type {number} Timer tracking time since last objective progress. */
        this.hintTimer = 0;

        /** @type {string|null} Current hint text to display, or null. */
        this.currentHint = null;

        // -- Hint display state --
        /** @type {number} Remaining lifetime of the active hint display. */
        this._hintDisplayTimer = 0;

        /** @type {boolean} Whether a hint is currently being shown. */
        this._hintVisible = false;

        // -- Completion banner state --
        /** @type {number} Remaining lifetime of the completion banner. */
        this._completionBannerTimer = 0;

        /** @type {string} Text shown in the completion banner. */
        this._completionBannerText = '';

        // -- Tab overlay --
        /** @type {boolean} Whether the full objective panel is being shown. */
        this._tabHeld = false;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Set the objectives for the current level. Resets all tracking state.
     *
     * @param {Array<{
     *   description: string,
     *   label: string,
     *   hint: string
     * }>} objectiveList - Array of objective definitions from level data.
     */
    setObjectives(objectiveList) {
        this.objectives = (objectiveList || []).map(obj => ({
            description: obj.description || '',
            label: obj.label || 'OBJECTIVE',
            hint: obj.hint || '',
            completed: false,
        }));

        this.completedCount = 0;
        this.hintTimer = 0;
        this.currentHint = null;
        this._hintDisplayTimer = 0;
        this._hintVisible = false;
        this._completionBannerTimer = 0;
        this._completionBannerText = '';
    }

    /**
     * Mark an objective as completed by index. Triggers the completion
     * banner and resets the hint timer.
     *
     * @param {number} index - Index of the objective to complete.
     */
    completeObjective(index) {
        if (index < 0 || index >= this.objectives.length) return;
        if (this.objectives[index].completed) return;

        this.objectives[index].completed = true;
        this.completedCount++;

        // Reset hint timer on progress.
        this.hintTimer = 0;
        this.currentHint = null;
        this._hintVisible = false;
        this._hintDisplayTimer = 0;

        // Show completion banner.
        this._completionBannerTimer = COMPLETION_BANNER_DURATION;
        if (this.isComplete()) {
            this._completionBannerText = 'ALL OBJECTIVES COMPLETE';
        } else {
            this._completionBannerText = 'OBJECTIVE COMPLETE';
        }
    }

    /**
     * Update timers for hints and banners. Call once per frame.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        // Track time since last progress for hint system.
        if (!this.isComplete() && this.objectives.length > 0) {
            this.hintTimer += dt;

            // Trigger hint if the player has been stuck.
            if (this.hintTimer >= HINT_DELAY && !this._hintVisible) {
                this._triggerHint();
            }
        }

        // Hint display timer.
        if (this._hintVisible) {
            this._hintDisplayTimer -= dt;
            if (this._hintDisplayTimer <= 0) {
                this._hintVisible = false;
                this._hintDisplayTimer = 0;
            }
        }

        // Completion banner timer.
        if (this._completionBannerTimer > 0) {
            this._completionBannerTimer -= dt;
            if (this._completionBannerTimer < 0) {
                this._completionBannerTimer = 0;
            }
        }
    }

    /**
     * Set whether the Tab key is currently held for the full objective display.
     *
     * @param {boolean} held
     */
    setTabHeld(held) {
        this._tabHeld = held;
    }

    /**
     * Render the objective UI elements.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenWidth
     */
    render(ctx, screenWidth) {
        if (this.objectives.length === 0) return;

        ctx.save();

        // -- Full objective overlay when Tab is held --
        if (this._tabHeld) {
            this._renderObjectivePanel(ctx, screenWidth);
        }

        // -- Completion banner --
        if (this._completionBannerTimer > 0) {
            this._renderCompletionBanner(ctx, screenWidth);
        }

        ctx.restore();
    }

    /**
     * Render the hint text if a hint is active.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenWidth
     */
    renderHint(ctx, screenWidth) {
        if (!this._hintVisible || !this.currentHint) return;

        ctx.save();

        const totalTime = HINT_DISPLAY_TIME + HINT_FADE_DURATION * 2;
        const elapsed = (HINT_DISPLAY_TIME + HINT_FADE_DURATION * 2) - this._hintDisplayTimer;

        // Calculate alpha: fade in -> hold -> fade out.
        let alpha = 1.0;
        if (elapsed < HINT_FADE_DURATION) {
            // Fade in.
            alpha = clamp(elapsed / HINT_FADE_DURATION, 0, 1);
        } else if (this._hintDisplayTimer < HINT_FADE_DURATION) {
            // Fade out.
            alpha = clamp(this._hintDisplayTimer / HINT_FADE_DURATION, 0, 1);
        }

        const cx = screenWidth / 2;
        const y = 40;

        // Background.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        const textW = ctx.measureText(this.currentHint).width;
        const padX = 8;
        const padY = 4;

        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx - textW / 2 - padX, y - padY, textW + padX * 2, 18 + padY);

        // Hint text in yellow.
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFDD00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.currentHint, cx, y);

        // "HINT" label.
        ctx.font = `bold 7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#AA9900';
        ctx.fillText('HINT', cx, y - 10);

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    /**
     * Get the current hint text if the player has been stuck.
     *
     * @returns {string|null} The hint string, or null if no hint is due.
     */
    getHint() {
        if (this.hintTimer < HINT_DELAY) return null;
        if (this.isComplete()) return null;

        // Find the first incomplete objective and return its hint.
        for (const obj of this.objectives) {
            if (!obj.completed && obj.hint) {
                return obj.hint;
            }
        }

        return null;
    }

    /**
     * Check whether all objectives are completed.
     *
     * @returns {boolean}
     */
    isComplete() {
        return this.objectives.length > 0 && this.completedCount >= this.objectives.length;
    }

    /**
     * Get the objective state for HUD display.
     * Returns null if no objectives are set.
     *
     * @returns {{ label: string, current: number, total: number }|null}
     */
    getDisplayState() {
        if (this.objectives.length === 0) return null;

        // Use the label from the first objective as the counter label.
        const label = this.objectives[0].label || 'OBJECTIVE';

        return {
            label,
            current: this.completedCount,
            total: this.objectives.length,
        };
    }

    // -------------------------------------------------------------------------
    // Internal: Hint Trigger
    // -------------------------------------------------------------------------

    /**
     * Activate the hint display with the appropriate hint text.
     * @private
     */
    _triggerHint() {
        const hint = this.getHint();
        if (!hint) return;

        this.currentHint = hint;
        this._hintVisible = true;
        this._hintDisplayTimer = HINT_DISPLAY_TIME + HINT_FADE_DURATION * 2;

        // Reset the hint timer so it does not keep re-triggering every frame.
        // The next hint will appear after another HINT_DELAY seconds.
        this.hintTimer = 0;
    }

    // -------------------------------------------------------------------------
    // Internal: Full Objective Panel (Tab held)
    // -------------------------------------------------------------------------

    /**
     * Render the full objective panel when Tab is held.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenWidth
     * @private
     */
    _renderObjectivePanel(ctx, screenWidth) {
        const cx = screenWidth / 2;
        const panelW = Math.min(screenWidth * 0.7, 280);
        const lineHeight = 14;
        const panelH = 30 + this.objectives.length * lineHeight + 10;
        const panelX = cx - panelW / 2;
        const panelY = 6;

        // Background.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(panelX, panelY, panelW, panelH);

        // Border.
        ctx.strokeStyle = '#FFCC00';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        // Header.
        ctx.font = `bold 9px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFCC00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('OBJECTIVES', cx, panelY + 5);

        // Divider line.
        ctx.strokeStyle = '#555500';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 6, panelY + 20);
        ctx.lineTo(panelX + panelW - 6, panelY + 20);
        ctx.stroke();

        // Objective list.
        ctx.font = `8px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        for (let i = 0; i < this.objectives.length; i++) {
            const obj = this.objectives[i];
            const y = panelY + 26 + i * lineHeight;

            // Checkbox.
            const checkX = panelX + 8;
            if (obj.completed) {
                ctx.fillStyle = '#00FF00';
                ctx.fillText('[X]', checkX, y);
            } else {
                ctx.fillStyle = '#FF4444';
                ctx.fillText('[ ]', checkX, y);
            }

            // Description.
            ctx.fillStyle = obj.completed ? '#00CC00' : '#CCCCCC';
            ctx.fillText(obj.description.toUpperCase(), checkX + 24, y);
        }
    }

    // -------------------------------------------------------------------------
    // Internal: Completion Banner
    // -------------------------------------------------------------------------

    /**
     * Render the "OBJECTIVE COMPLETE" banner.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenWidth
     * @private
     */
    _renderCompletionBanner(ctx, screenWidth) {
        const cx = screenWidth / 2;
        const y = 30;

        // Fade out during last second.
        let alpha = 1.0;
        if (this._completionBannerTimer < 1.0) {
            alpha = clamp(this._completionBannerTimer, 0, 1);
        }

        ctx.globalAlpha = alpha;

        // Background bar.
        ctx.fillStyle = 'rgba(0, 50, 0, 0.8)';
        ctx.fillRect(0, y - 3, screenWidth, 18);

        // Text.
        ctx.font = `bold 10px ${FONT_FAMILY}`;
        ctx.fillStyle = '#00FF44';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this._completionBannerText, cx, y);

        ctx.globalAlpha = 1.0;
    }
}
