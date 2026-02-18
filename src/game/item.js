// =============================================================================
// item.js - Pickup item entity for RETRO FURY
// =============================================================================
// Items are world objects that the player can walk over to collect. They
// include health packs, armor, ammo, weapons, keycards, and objective items.
// Each item type has a defined effect, sprite, and pickup condition (e.g.,
// health items cannot be picked up at full health).
// =============================================================================

import { MAX_HEALTH, MAX_ARMOR, MAX_AMMO } from './player.js';
import { WEAPON_DEFS } from './weapon.js';

// -----------------------------------------------------------------------------
// Item Type Enum
// -----------------------------------------------------------------------------

/** @enum {number} */
export const ItemType = Object.freeze({
    HEALTH_SMALL:    0,
    HEALTH_LARGE:    1,
    ARMOR:           2,
    AMMO_BULLETS:    3,
    AMMO_SHELLS:     4,
    AMMO_ROCKETS:    5,
    AMMO_CELLS:      6,
    KEYCARD_BLUE:    7,
    KEYCARD_RED:     8,
    KEYCARD_YELLOW:  9,
    WEAPON_SHOTGUN:  10,
    WEAPON_MACHINEGUN: 11,
    WEAPON_ROCKET:   12,
    WEAPON_PLASMA:   13,
    OBJECTIVE_ITEM:  14,
});

// -----------------------------------------------------------------------------
// Item Definitions
// -----------------------------------------------------------------------------
// Each definition describes the pickup behavior for an item type.
// - spriteId:    texture/sprite ID for rendering.
// - value:       amount of health/armor/ammo granted.
// - weaponIndex: which weapon to give (for weapon pickups).
// - ammoType:    ammo category string (for ammo pickups).
// - keycardColor: which keycard to grant (for keycard pickups).
// - starterAmmo: ammo granted alongside a weapon pickup.

/**
 * @typedef {Object} ItemDef
 * @property {number} spriteId
 * @property {number} [value]
 * @property {number} [weaponIndex]
 * @property {string} [ammoType]
 * @property {string} [keycardColor]
 * @property {{ type: string, amount: number }} [starterAmmo]
 */

/** @type {Record<number, ItemDef>} */
const ITEM_DEFS = {
    [ItemType.HEALTH_SMALL]: {
        spriteId: 200,
        value: 10,
    },
    [ItemType.HEALTH_LARGE]: {
        spriteId: 201,
        value: 25,
    },
    [ItemType.ARMOR]: {
        spriteId: 202,
        value: 50,
    },
    [ItemType.AMMO_BULLETS]: {
        spriteId: 210,
        value: 20,
        ammoType: 'bullets',
    },
    [ItemType.AMMO_SHELLS]: {
        spriteId: 211,
        value: 4,
        ammoType: 'shells',
    },
    [ItemType.AMMO_ROCKETS]: {
        spriteId: 212,
        value: 3,
        ammoType: 'rockets',
    },
    [ItemType.AMMO_CELLS]: {
        spriteId: 213,
        value: 20,
        ammoType: 'cells',
    },
    [ItemType.KEYCARD_BLUE]: {
        spriteId: 220,
        keycardColor: 'blue',
    },
    [ItemType.KEYCARD_RED]: {
        spriteId: 221,
        keycardColor: 'red',
    },
    [ItemType.KEYCARD_YELLOW]: {
        spriteId: 222,
        keycardColor: 'yellow',
    },
    [ItemType.WEAPON_SHOTGUN]: {
        spriteId: 230,
        weaponIndex: 1,
        starterAmmo: { type: 'shells', amount: 8 },
    },
    [ItemType.WEAPON_MACHINEGUN]: {
        spriteId: 231,
        weaponIndex: 2,
        starterAmmo: { type: 'bullets', amount: 40 },
    },
    [ItemType.WEAPON_ROCKET]: {
        spriteId: 232,
        weaponIndex: 3,
        starterAmmo: { type: 'rockets', amount: 5 },
    },
    [ItemType.WEAPON_PLASMA]: {
        spriteId: 233,
        weaponIndex: 4,
        starterAmmo: { type: 'cells', amount: 20 },
    },
    [ItemType.OBJECTIVE_ITEM]: {
        spriteId: 240,
    },
};

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Distance in tiles at which the player can pick up an item. */
const PICKUP_RADIUS = 0.5;

/** Amplitude of the vertical bob animation in "virtual pixels". */
const BOB_AMPLITUDE = 0.05;

/** Speed of the bob animation in radians per second. */
const BOB_SPEED = 3.0;

// =============================================================================
// Item Class
// =============================================================================

export class Item {
    /**
     * @param {number} x - World X position (center of tile or fractional).
     * @param {number} y - World Y position.
     * @param {number} type - One of the ItemType enum values.
     */
    constructor(x, y, type) {
        /** @type {number} World X position. */
        this.x = x;

        /** @type {number} World Y position. */
        this.y = y;

        /** @type {number} Item type (ItemType enum). */
        this.type = type;

        /** @type {boolean} Whether the item is still in the world. */
        this.active = true;

        /**
         * @type {number} Current bob animation offset. Used by the sprite
         *   renderer to shift the item up/down for a floating effect.
         */
        this.bobOffset = 0;

        /** @type {number} Internal phase accumulator for bob animation. @private */
        this._bobPhase = Math.random() * Math.PI * 2; // Randomize initial phase.

        // Cache the definition for this item type.
        const def = ITEM_DEFS[type];

        /** @type {number} Sprite/texture ID for rendering. */
        this.spriteId = def ? def.spriteId : 200;
    }

    // -------------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------------

    /**
     * Advance the bob animation.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        if (!this.active) return;

        this._bobPhase += BOB_SPEED * dt;
        this.bobOffset = Math.sin(this._bobPhase) * BOB_AMPLITUDE;
    }

    // -------------------------------------------------------------------------
    // Pickup
    // -------------------------------------------------------------------------

    /**
     * Attempt to pick up this item. Checks distance to the player and whether
     * the player can benefit from the pickup (not at max health/armor/ammo).
     *
     * @param {import('./player.js').Player} player
     * @returns {{ picked: boolean, message: string }}
     */
    tryPickup(player) {
        if (!this.active) return { picked: false, message: '' };

        // Distance check.
        const dx = player.pos.x - this.x;
        const dy = player.pos.y - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > PICKUP_RADIUS * PICKUP_RADIUS) {
            return { picked: false, message: '' };
        }

        const def = ITEM_DEFS[this.type];
        if (!def) return { picked: false, message: '' };

        // Dispatch by item category.
        return this._applyPickup(player, def);
    }

    // -------------------------------------------------------------------------
    // Internal Pickup Logic
    // -------------------------------------------------------------------------

    /**
     * Apply the item's effect to the player. Returns whether the item was
     * consumed and a message string.
     *
     * @param {import('./player.js').Player} player
     * @param {ItemDef} def
     * @returns {{ picked: boolean, message: string }}
     * @private
     */
    _applyPickup(player, def) {
        // ---- Health pickups ----
        if (this.type === ItemType.HEALTH_SMALL || this.type === ItemType.HEALTH_LARGE) {
            if (player.health >= MAX_HEALTH) {
                return { picked: false, message: '' };
            }
            player.heal(def.value);
            this.active = false;
            return { picked: true, message: `+${def.value} Health` };
        }

        // ---- Armor pickup ----
        if (this.type === ItemType.ARMOR) {
            if (player.armor >= MAX_ARMOR) {
                return { picked: false, message: '' };
            }
            player.addArmor(def.value);
            this.active = false;
            return { picked: true, message: `+${def.value} Armor` };
        }

        // ---- Ammo pickups ----
        if (def.ammoType && def.value !== undefined) {
            if (player.isAmmoFull(def.ammoType)) {
                return { picked: false, message: '' };
            }
            player.addAmmo(def.ammoType, def.value);
            this.active = false;
            return { picked: true, message: `+${def.value} ${def.ammoType}` };
        }

        // ---- Weapon pickups ----
        if (def.weaponIndex !== undefined) {
            player.giveWeapon(def.weaponIndex);

            // Grant starter ammo.
            if (def.starterAmmo) {
                player.addAmmo(def.starterAmmo.type, def.starterAmmo.amount);
            }

            // Auto-switch to the new weapon.
            player.currentWeapon = def.weaponIndex;

            this.active = false;
            const wName = WEAPON_DEFS[def.weaponIndex] ? WEAPON_DEFS[def.weaponIndex].name : 'weapon';
            return { picked: true, message: `Got ${wName}!` };
        }

        // ---- Keycard pickups ----
        if (def.keycardColor) {
            player.addKeycard(def.keycardColor);
            this.active = false;
            return { picked: true, message: `Got ${def.keycardColor} keycard!` };
        }

        // ---- Objective item ----
        if (this.type === ItemType.OBJECTIVE_ITEM) {
            this.active = false;
            return { picked: true, message: '' };
        }

        return { picked: false, message: '' };
    }
}

// Export definitions and constants for external use.
export { ITEM_DEFS, PICKUP_RADIUS };
