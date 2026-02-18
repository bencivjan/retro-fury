// =============================================================================
// gun-game.js - Gun Game progression manager for RETRO FURY
// =============================================================================
// Manages per-player weapon tier progression in Gun Game mode. Players start
// with a pistol and advance through increasingly challenging weapons with each
// kill. The final tier is the knife -- scoring a knife kill wins the game.
// =============================================================================

// -----------------------------------------------------------------------------
// Gun Game Tier Definitions
// -----------------------------------------------------------------------------
// Indices into WEAPON_DEFS (from weapon.js):
//   0 = Pistol, 1 = Shotgun, 2 = Machine Gun, 5 = Sniper Rifle, 6 = Knife

/** @type {number[]} Weapon indices for each Gun Game tier. */
export const GUN_GAME_TIERS = [0, 1, 2, 5, 6];

/** @type {string[]} Human-readable names for each tier. */
export const TIER_NAMES = ['PISTOL', 'SHOTGUN', 'MACHINE GUN', 'SNIPER RIFLE', 'KNIFE'];

// =============================================================================
// GunGameManager Class
// =============================================================================

export class GunGameManager {
    constructor() {
        /**
         * Per-player tier tracking.  Maps playerId to the current tier index
         * (0..4) into GUN_GAME_TIERS / TIER_NAMES.
         * @type {Map<string|number, number>}
         */
        this.tiers = new Map();
    }

    // -------------------------------------------------------------------------
    // Player Management
    // -------------------------------------------------------------------------

    /**
     * Register a player in the Gun Game, starting at tier 0 (Pistol).
     *
     * @param {string|number} playerId
     */
    addPlayer(playerId) {
        this.tiers.set(playerId, 0);
    }

    /**
     * Get the current tier index (0-4) for a player.
     *
     * @param {string|number} playerId
     * @returns {number} Tier index, or 0 if the player is not registered.
     */
    getTier(playerId) {
        return this.tiers.get(playerId) || 0;
    }

    /**
     * Get the WEAPON_DEFS index for the player's current tier.
     *
     * @param {string|number} playerId
     * @returns {number} Index into WEAPON_DEFS.
     */
    getWeaponIndex(playerId) {
        const tier = this.getTier(playerId);
        return GUN_GAME_TIERS[tier];
    }

    /**
     * Get the human-readable weapon name for the player's current tier.
     *
     * @param {string|number} playerId
     * @returns {string}
     */
    getWeaponName(playerId) {
        const tier = this.getTier(playerId);
        return TIER_NAMES[tier];
    }

    // -------------------------------------------------------------------------
    // Progression
    // -------------------------------------------------------------------------

    /**
     * Promote a player to the next tier after scoring a kill.
     *
     * If the player was on tier 4 (Knife) when the kill happened, the kill
     * is a knife kill and the player wins -- `isVictory` is returned as true.
     * Otherwise the tier is incremented by one.
     *
     * @param {string|number} playerId
     * @returns {{ newTier: number, isVictory: boolean }}
     */
    promote(playerId) {
        const currentTier = this.getTier(playerId);

        // Knife kill (tier 4) is the victory condition.
        if (currentTier >= GUN_GAME_TIERS.length - 1) {
            return { newTier: currentTier, isVictory: true };
        }

        // Advance to the next tier.
        const newTier = currentTier + 1;
        this.tiers.set(playerId, newTier);

        return { newTier, isVictory: false };
    }

    // -------------------------------------------------------------------------
    // Reset
    // -------------------------------------------------------------------------

    /**
     * Reset a single player back to tier 0 (Pistol).
     *
     * @param {string|number} playerId
     */
    resetPlayer(playerId) {
        this.tiers.set(playerId, 0);
    }

    /**
     * Reset all players, clearing every tier entry.
     */
    resetAll() {
        this.tiers.clear();
    }
}
