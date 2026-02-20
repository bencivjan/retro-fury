// =============================================================================
// hud.js - In-Game HUD for RETRO FURY
// =============================================================================
// Renders the heads-up display each frame on top of the game view. All elements
// use a retro 90s aesthetic: blocky monospace text, bright neon colors on dark
// backgrounds, and pulsing/flashing effects for critical states.
//
// Elements rendered:
//   - Health bar (bottom-left, red)
//   - Armor bar (bottom-left, blue)
//   - Ammo counter (bottom-right)
//   - Weapon name (above ammo)
//   - Crosshair (screen center)
//   - Damage flash (full-screen red overlay)
//   - Pickup text (fading message)
//   - Objective counter (top-center)
//   - Boss health bar (top, when active)
// =============================================================================

import { clamp } from '../utils/math.js';
import { WEAPON_DEFS } from '../game/weapon.js';
import { MAX_HEALTH, MAX_ARMOR } from '../game/player.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Base font used for all HUD text. */
const FONT_FAMILY = '"Courier New", Courier, monospace';

/** HUD bar dimensions and positioning. */
const BAR_WIDTH    = 80;
const BAR_HEIGHT   = 8;
const BAR_PADDING  = 6;
const BAR_GAP      = 3;

/** Damage flash duration in seconds. */
const DAMAGE_FLASH_DURATION = 0.35;

/** Maximum opacity for the damage flash overlay. */
const DAMAGE_FLASH_MAX_ALPHA = 0.45;

/** How long a pickup message is visible before it starts to fade. */
const PICKUP_DISPLAY_TIME = 1.5;

/** Total lifetime of a pickup message including fade. */
const PICKUP_FADE_TIME = 2.0;

/** Maximum number of simultaneous pickup messages. */
const MAX_PICKUP_MESSAGES = 4;

/** Health threshold for low-health flash effect. */
const LOW_HEALTH_THRESHOLD = 25;

/** Low health flash frequency in Hz. */
const LOW_HEALTH_FLASH_HZ = 3;

// =============================================================================
// HUD Class
// =============================================================================

export class HUD {
    /**
     * @param {number} screenWidth  - Canvas width in pixels.
     * @param {number} screenHeight - Canvas height in pixels.
     */
    constructor(screenWidth, screenHeight) {
        /** @type {number} */
        this.screenWidth = screenWidth;

        /** @type {number} */
        this.screenHeight = screenHeight;

        // -- Damage flash state --
        /** @type {number} Remaining time for the damage flash overlay. */
        this._damageFlashTimer = 0;

        // -- Pickup message queue --
        /**
         * @type {Array<{ text: string, timer: number }>}
         * Active pickup messages with their remaining lifetime.
         */
        this._pickupMessages = [];

        // -- Boss health bar state --
        /** @type {boolean} Whether the boss health bar is active. */
        this._bossActive = false;

        /** @type {number} Current boss health for display. */
        this._bossHealth = 0;

        /** @type {number} Maximum boss health for display. */
        this._bossMaxHealth = 0;

        // -- Internal timers --
        /** @type {number} Accumulated time for pulsing/flashing effects. */
        this._elapsed = 0;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Render all HUD elements for a single frame.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../game/player.js').Player} player
     * @param {import('../game/weapon.js').WeaponSystem} weaponSystem
     * @param {Object|null} objectiveState - Optional objective tracker state.
     *   Expected shape: { label: string, current: number, total: number }
     * @param {number} dt - Delta time in seconds for this frame.
     */
    render(ctx, player, weaponSystem, objectiveState, dt = 0.016) {
        this._elapsed += dt;

        // Update timers.
        this._updateTimers(dt);

        // Save canvas state so HUD rendering does not affect the game view.
        ctx.save();

        // -- Draw each HUD element in layered order --
        this._renderDamageFlash(ctx);
        this._renderCrosshair(ctx);
        this._renderHealthBar(ctx, player);
        this._renderArmorBar(ctx, player);
        this._renderAmmoCounter(ctx, player, weaponSystem);
        this._renderWeaponName(ctx, weaponSystem);
        this._renderPickupMessages(ctx);

        if (objectiveState) {
            this._renderObjectiveCounter(ctx, objectiveState);
        }

        if (this._bossActive) {
            this._renderBossHealthBar(ctx);
        }

        ctx.restore();
    }

    /**
     * Queue a pickup message to display on the HUD.
     *
     * @param {string} text - The message to display (e.g., "SHOTGUN ACQUIRED").
     */
    showPickupMessage(text) {
        this._pickupMessages.push({
            text: text.toUpperCase(),
            timer: PICKUP_FADE_TIME,
        });

        // Cap the message queue to avoid clutter.
        if (this._pickupMessages.length > MAX_PICKUP_MESSAGES) {
            this._pickupMessages.shift();
        }
    }

    /**
     * Start the damage flash effect (red overlay that fades out).
     */
    triggerDamageFlash() {
        this._damageFlashTimer = DAMAGE_FLASH_DURATION;
    }

    /**
     * Enable and update the boss health bar display.
     *
     * @param {number} current - Current boss health.
     * @param {number} max     - Maximum boss health.
     */
    showBossHealth(current, max) {
        this._bossActive = true;
        this._bossHealth = Math.max(0, current);
        this._bossMaxHealth = max;
    }

    /**
     * Hide the boss health bar.
     */
    hideBossHealth() {
        this._bossActive = false;
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
    // Internal: Timer Updates
    // -------------------------------------------------------------------------

    /**
     * Tick down all time-based HUD state.
     * @param {number} dt
     * @private
     */
    _updateTimers(dt) {
        // Damage flash countdown.
        if (this._damageFlashTimer > 0) {
            this._damageFlashTimer -= dt;
            if (this._damageFlashTimer < 0) this._damageFlashTimer = 0;
        }

        // Pickup message countdowns.
        for (let i = this._pickupMessages.length - 1; i >= 0; i--) {
            this._pickupMessages[i].timer -= dt;
            if (this._pickupMessages[i].timer <= 0) {
                this._pickupMessages.splice(i, 1);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Internal: Crosshair
    // -------------------------------------------------------------------------

    /**
     * Draw a small crosshair at the center of the screen.
     * @param {CanvasRenderingContext2D} ctx
     * @private
     */
    _renderCrosshair(ctx) {
        const cx = Math.floor(this.screenWidth / 2);
        const cy = Math.floor(this.screenHeight / 2);
        const size = 6;
        const thickness = 2;

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = thickness;
        ctx.globalAlpha = 0.8;

        // Horizontal line.
        ctx.beginPath();
        ctx.moveTo(cx - size, cy);
        ctx.lineTo(cx - 2, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + 2, cy);
        ctx.lineTo(cx + size, cy);
        ctx.stroke();

        // Vertical line.
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx, cy - 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, cy + 2);
        ctx.lineTo(cx, cy + size);
        ctx.stroke();

        // Center dot.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cx - 1, cy - 1, 2, 2);

        ctx.globalAlpha = 1.0;
    }

    // -------------------------------------------------------------------------
    // Internal: Health Bar
    // -------------------------------------------------------------------------

    /**
     * Draw the health bar and numeric value at bottom-left.
     * Flashes red when health is critically low.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../game/player.js').Player} player
     * @private
     */
    _renderHealthBar(ctx, player) {
        const x = BAR_PADDING;
        const y = this.screenHeight - BAR_PADDING - BAR_HEIGHT;
        const healthPct = clamp(player.health / MAX_HEALTH, 0, 1);

        // Flash effect when health is critically low.
        let barColor = '#FF2222';
        let textColor = '#FF4444';
        if (player.health <= LOW_HEALTH_THRESHOLD && player.health > 0) {
            const flash = Math.sin(this._elapsed * Math.PI * 2 * LOW_HEALTH_FLASH_HZ) > 0;
            barColor = flash ? '#FF0000' : '#880000';
            textColor = flash ? '#FF0000' : '#880000';
        }

        // Bar background.
        ctx.fillStyle = '#330000';
        ctx.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);

        // Bar fill.
        ctx.fillStyle = barColor;
        ctx.fillRect(x, y, Math.floor(BAR_WIDTH * healthPct), BAR_HEIGHT);

        // Bar border.
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, BAR_WIDTH, BAR_HEIGHT);

        // Label.
        ctx.font = `bold 7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('HP', x + 2, y + BAR_HEIGHT / 2);

        // Numeric value.
        ctx.font = `bold 10px ${FONT_FAMILY}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(Math.ceil(player.health)), x + BAR_WIDTH + 4, y + BAR_HEIGHT + 1);
    }

    // -------------------------------------------------------------------------
    // Internal: Armor Bar
    // -------------------------------------------------------------------------

    /**
     * Draw the armor bar next to the health bar.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../game/player.js').Player} player
     * @private
     */
    _renderArmorBar(ctx, player) {
        const x = BAR_PADDING;
        const y = this.screenHeight - BAR_PADDING - BAR_HEIGHT * 2 - BAR_GAP;
        const armorPct = clamp(player.armor / MAX_ARMOR, 0, 1);

        // Bar background.
        ctx.fillStyle = '#000033';
        ctx.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);

        // Bar fill.
        ctx.fillStyle = '#2266FF';
        ctx.fillRect(x, y, Math.floor(BAR_WIDTH * armorPct), BAR_HEIGHT);

        // Bar border.
        ctx.strokeStyle = '#4488FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, BAR_WIDTH, BAR_HEIGHT);

        // Label.
        ctx.font = `bold 7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('AR', x + 2, y + BAR_HEIGHT / 2);

        // Numeric value.
        ctx.font = `bold 10px ${FONT_FAMILY}`;
        ctx.fillStyle = '#4488FF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(Math.ceil(player.armor)), x + BAR_WIDTH + 4, y + BAR_HEIGHT + 1);
    }

    // -------------------------------------------------------------------------
    // Internal: Ammo Counter
    // -------------------------------------------------------------------------

    /**
     * Draw the ammo count at bottom-right. Shows "INF" for the pistol.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../game/player.js').Player} player
     * @param {import('../game/weapon.js').WeaponSystem} weaponSystem
     * @private
     */
    _renderAmmoCounter(ctx, player, weaponSystem) {
        const def = weaponSystem.getCurrentDef();
        if (!def) return;

        const x = this.screenWidth - BAR_PADDING;
        const y = this.screenHeight - BAR_PADDING;

        // Determine ammo text.
        let ammoText;
        if (def.ammoPerShot === 0) {
            ammoText = 'INF';
        } else {
            ammoText = String(player.ammo[def.ammoType] || 0);
        }

        // Ammo number (large).
        ctx.font = `bold 16px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFCC00';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(ammoText, x, y);

        // Ammo type label (small, below the weapon name area).
        ctx.font = `bold 7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#999966';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const ammoLabel = def.ammoPerShot === 0 ? 'UNLIMITED' : def.ammoType.toUpperCase();
        ctx.fillText(ammoLabel, x, y - 18);
    }

    // -------------------------------------------------------------------------
    // Internal: Weapon Name
    // -------------------------------------------------------------------------

    /**
     * Draw the current weapon name above the ammo counter.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../game/weapon.js').WeaponSystem} weaponSystem
     * @private
     */
    _renderWeaponName(ctx, weaponSystem) {
        const def = weaponSystem.getCurrentDef();
        if (!def) return;

        const x = this.screenWidth - BAR_PADDING;
        const y = this.screenHeight - BAR_PADDING - 26;

        ctx.font = `bold 7px ${FONT_FAMILY}`;
        ctx.fillStyle = '#CCCCCC';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(def.name.toUpperCase(), x, y);
    }

    // -------------------------------------------------------------------------
    // Internal: Damage Flash
    // -------------------------------------------------------------------------

    /**
     * Draw a full-screen red overlay that fades out after taking damage.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @private
     */
    _renderDamageFlash(ctx) {
        if (this._damageFlashTimer <= 0) return;

        const alpha = (this._damageFlashTimer / DAMAGE_FLASH_DURATION) * DAMAGE_FLASH_MAX_ALPHA;

        ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
    }

    // -------------------------------------------------------------------------
    // Internal: Pickup Messages
    // -------------------------------------------------------------------------

    /**
     * Draw active pickup messages that fade out over time.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @private
     */
    _renderPickupMessages(ctx) {
        if (this._pickupMessages.length === 0) return;

        const baseX = this.screenWidth / 2;
        const baseY = this.screenHeight * 0.65;

        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i < this._pickupMessages.length; i++) {
            const msg = this._pickupMessages[i];

            // Calculate alpha: full opacity for most of the display time,
            // then fade out during the last portion.
            let alpha = 1.0;
            const fadeStart = PICKUP_FADE_TIME - PICKUP_DISPLAY_TIME;
            if (msg.timer < fadeStart) {
                alpha = clamp(msg.timer / fadeStart, 0, 1);
            }

            const yOffset = i * 12;

            // Text shadow for readability.
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillStyle = '#000000';
            ctx.fillText(msg.text, baseX + 1, baseY + yOffset + 1);

            // Main text in bright green (pickup feel).
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#00FF66';
            ctx.fillText(msg.text, baseX, baseY + yOffset);
        }

        ctx.globalAlpha = 1.0;
    }

    // -------------------------------------------------------------------------
    // Internal: Objective Counter
    // -------------------------------------------------------------------------

    /**
     * Draw the objective progress counter at top-center of the screen.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ label: string, current: number, total: number }} state
     * @private
     */
    _renderObjectiveCounter(ctx, state) {
        if (!state || !state.label || !(state.total > 0)) return;

        const text = `${state.label.toUpperCase()}: ${state.current}/${state.total}`;
        const x = this.screenWidth / 2;
        const y = 8;

        // Background pill.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        const textWidth = ctx.measureText(text).width;
        const pillPad = 6;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this._roundRect(
            ctx,
            x - textWidth / 2 - pillPad,
            y - 6,
            textWidth + pillPad * 2,
            16,
            3
        );
        ctx.fill();

        // Border.
        ctx.strokeStyle = '#FFCC00';
        ctx.lineWidth = 1;
        this._roundRect(
            ctx,
            x - textWidth / 2 - pillPad,
            y - 6,
            textWidth + pillPad * 2,
            16,
            3
        );
        ctx.stroke();

        // Text.
        ctx.fillStyle = '#FFCC00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 2);
    }

    // -------------------------------------------------------------------------
    // Internal: Boss Health Bar
    // -------------------------------------------------------------------------

    /**
     * Draw a large boss health bar at the top of the screen.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @private
     */
    _renderBossHealthBar(ctx) {
        const barW = Math.min(this.screenWidth * 0.5, 200);
        const barH = 10;
        const x = (this.screenWidth - barW) / 2;
        const y = 26;
        const healthPct = clamp(this._bossHealth / this._bossMaxHealth, 0, 1);

        // Label.
        ctx.font = `bold 8px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FF4444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('COMMANDER', this.screenWidth / 2, y - 2);

        // Bar background.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);

        ctx.fillStyle = '#330000';
        ctx.fillRect(x, y, barW, barH);

        // Bar fill with gradient for a dramatic look.
        const gradient = ctx.createLinearGradient(x, y, x + barW * healthPct, y);
        gradient.addColorStop(0, '#FF0000');
        gradient.addColorStop(1, '#FF4400');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, Math.floor(barW * healthPct), barH);

        // Bar border.
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barW, barH);

        // Pulsing glow when boss is low health.
        if (healthPct < 0.33) {
            const pulse = Math.abs(Math.sin(this._elapsed * 4));
            ctx.strokeStyle = `rgba(255, 0, 0, ${pulse * 0.5})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(x - 2, y - 2, barW + 4, barH + 4);
        }
    }

    // -------------------------------------------------------------------------
    // Internal: Utility
    // -------------------------------------------------------------------------

    /**
     * Draw a rounded rectangle path.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} r - Corner radius.
     * @private
     */
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }
}
