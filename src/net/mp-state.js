// =============================================================================
// mp-state.js - Multiplayer State Manager for RETRO FURY
// =============================================================================
// Manages the local multiplayer game state: local player prediction, remote
// player interpolation, gun game tiers, kill feed, and server reconciliation.
// =============================================================================

import { RemotePlayer } from '../game/remote-player.js';

// =============================================================================
// MultiplayerState Class
// =============================================================================

export class MultiplayerState {
    constructor() {
        /** @type {string|null} Local player ID assigned by server. */
        this.localPlayerId = null;

        /** @type {string|null} Remote player ID. */
        this.remotePlayerId = null;

        /** @type {RemotePlayer} The remote player entity. */
        this.remotePlayer = new RemotePlayer();

        /** @type {number} Local player weapon tier (0-4). */
        this.localTier = 0;

        /** @type {number} Remote player weapon tier (0-4). */
        this.remoteTier = 0;

        /** @type {number} Match time elapsed in seconds. */
        this.matchTime = 0;

        /** @type {boolean} Whether the match is active. */
        this.matchActive = false;

        /** @type {boolean} Whether the local player is in respawn. */
        this.respawning = false;

        /** @type {number} Respawn countdown timer. */
        this.respawnTimer = 0;

        /** @type {number} Hit confirmation flash timer. */
        this.hitConfirmTimer = 0;

        /** @type {number} Promotion flash timer. */
        this.promotionTimer = 0;

        /** @type {string|null} Promotion weapon name for overlay text. */
        this.promotionWeaponName = null;

        /** @type {string|null} Winner ID when match ends. */
        this.winnerId = null;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Initialize for a new match.
     *
     * @param {string} localId  - Local player ID.
     * @param {string} remoteId - Remote player ID.
     */
    initMatch(localId, remoteId) {
        this.localPlayerId = localId;
        this.remotePlayerId = remoteId;
        this.localTier = 0;
        this.remoteTier = 0;
        this.matchTime = 0;
        this.matchActive = true;
        this.respawning = false;
        this.respawnTimer = 0;
        this.hitConfirmTimer = 0;
        this.promotionTimer = 0;
        this.promotionWeaponName = null;
        this.winnerId = null;
        this.remotePlayer = new RemotePlayer();
    }

    /**
     * Update per-frame timers.
     *
     * @param {number} dt - Delta time in seconds.
     */
    update(dt) {
        if (this.matchActive) {
            this.matchTime += dt;
        }

        // Respawn timer.
        if (this.respawning) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.respawning = false;
                this.respawnTimer = 0;
            }
        }

        // Hit confirm flash.
        if (this.hitConfirmTimer > 0) {
            this.hitConfirmTimer -= dt;
        }

        // Promotion flash.
        if (this.promotionTimer > 0) {
            this.promotionTimer -= dt;
        }

        // Update remote player interpolation.
        this.remotePlayer.update(dt);
    }

    /**
     * Apply a server state update.
     *
     * @param {Object} stateMsg - Server state message with players array.
     */
    applyServerState(stateMsg) {
        if (!stateMsg.players) return;

        for (const p of stateMsg.players) {
            if (p.id === this.remotePlayerId) {
                this.remotePlayer.setServerState(
                    p.x, p.y, p.angle,
                    p.health, p.alive, p.weaponTier
                );
                this.remoteTier = p.weaponTier;
            }
        }
    }

    /**
     * Handle a kill event from the server.
     *
     * @param {Object} killMsg - { killerId, victimId, weapon, killerNewTier }
     * @returns {{ isLocalKill: boolean, isLocalDeath: boolean }}
     */
    handleKill(killMsg) {
        const isLocalKill = killMsg.killerId === this.localPlayerId;
        const isLocalDeath = killMsg.victimId === this.localPlayerId;

        if (isLocalKill && killMsg.killerNewTier !== undefined) {
            this.localTier = killMsg.killerNewTier;
        }

        if (killMsg.killerId === this.remotePlayerId && killMsg.killerNewTier !== undefined) {
            this.remoteTier = killMsg.killerNewTier;
        }

        return { isLocalKill, isLocalDeath };
    }

    /**
     * Begin the local respawn sequence.
     *
     * @param {number} duration - Respawn wait time in seconds.
     */
    startRespawn(duration) {
        this.respawning = true;
        this.respawnTimer = duration;
    }

    /**
     * Trigger hit confirmation feedback.
     */
    triggerHitConfirm() {
        this.hitConfirmTimer = 0.15;
    }

    /**
     * Trigger weapon promotion visual.
     *
     * @param {string} weaponName
     */
    triggerPromotion(weaponName) {
        this.promotionWeaponName = weaponName;
        this.promotionTimer = 2.0;
    }

    /**
     * Set the match winner.
     *
     * @param {string} winnerId
     */
    setWinner(winnerId) {
        this.winnerId = winnerId;
        this.matchActive = false;
    }

    /**
     * Check if the local player won.
     *
     * @returns {boolean}
     */
    didLocalWin() {
        return this.winnerId === this.localPlayerId;
    }

    /**
     * Reset all state for a new match.
     */
    reset() {
        this.localPlayerId = null;
        this.remotePlayerId = null;
        this.remotePlayer = new RemotePlayer();
        this.localTier = 0;
        this.remoteTier = 0;
        this.matchTime = 0;
        this.matchActive = false;
        this.respawning = false;
        this.respawnTimer = 0;
        this.hitConfirmTimer = 0;
        this.promotionTimer = 0;
        this.promotionWeaponName = null;
        this.winnerId = null;
    }
}
