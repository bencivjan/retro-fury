// =============================================================================
// room.js - Room and lobby management for RETRO FURY multiplayer server
// =============================================================================
// Room holds two players in a game session with a 4-letter room code.
// RoomManager handles room lifecycle: creation, joining, cleanup, and
// reverse-lookup from player ID to room.
// =============================================================================

import { serialize, OPPONENT_DISCONNECTED } from './protocol.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum number of players per room. */
const MAX_PLAYERS = 2;

/** Characters used for room code generation. */
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Length of generated room codes. */
const CODE_LENGTH = 4;

// =============================================================================
// Room Class
// =============================================================================

export class Room {
    /**
     * @param {string} roomCode - Unique 4-letter uppercase room code.
     */
    constructor(roomCode) {
        /** @type {string} Unique room identifier displayed to players. */
        this.roomCode = roomCode;

        /**
         * Connected players keyed by player ID.
         * @type {Map<number, { id: number, ws: import('ws').WebSocket, ready: boolean }>}
         */
        this.players = new Map();

        /**
         * Current room lifecycle state.
         * @type {'waiting'|'playing'|'ended'}
         */
        this.state = 'waiting';
    }

    // -------------------------------------------------------------------------
    // Player Management
    // -------------------------------------------------------------------------

    /**
     * Add a player to this room.
     *
     * @param {number} id - Unique player identifier.
     * @param {import('ws').WebSocket} ws - Player's WebSocket connection.
     * @throws {Error} If the room is already full.
     */
    addPlayer(id, ws) {
        if (this.players.size >= MAX_PLAYERS) {
            throw new Error(`Room ${this.roomCode} is full`);
        }

        this.players.set(id, { id, ws, ready: false });
    }

    /**
     * Remove a player from this room.
     *
     * @param {number} id - Player ID to remove.
     */
    removePlayer(id) {
        this.players.delete(id);
    }

    /**
     * Get the opponent of the given player (the other player in the room).
     *
     * @param {number} id - The requesting player's ID.
     * @returns {{ id: number, ws: import('ws').WebSocket, ready: boolean }|null}
     *   The opponent's player record, or null if no opponent exists.
     */
    getOpponent(id) {
        for (const [playerId, player] of this.players) {
            if (playerId !== id) {
                return player;
            }
        }
        return null;
    }

    /**
     * Whether the room has reached its maximum player count.
     *
     * @returns {boolean}
     */
    isFull() {
        return this.players.size >= MAX_PLAYERS;
    }

    // -------------------------------------------------------------------------
    // Messaging
    // -------------------------------------------------------------------------

    /**
     * Broadcast a message to every player in the room.
     *
     * @param {object} msg - Protocol message object to send.
     */
    broadcast(msg) {
        const raw = serialize(msg);
        for (const player of this.players.values()) {
            if (player.ws.readyState === player.ws.OPEN) {
                player.ws.send(raw);
            }
        }
    }

    /**
     * Send a message to a specific player by ID.
     *
     * @param {number} playerId - Target player's ID.
     * @param {object} msg - Protocol message object to send.
     */
    sendTo(playerId, msg) {
        const player = this.players.get(playerId);
        if (player && player.ws.readyState === player.ws.OPEN) {
            player.ws.send(serialize(msg));
        }
    }
}

// =============================================================================
// RoomManager Class
// =============================================================================

export class RoomManager {
    constructor() {
        /**
         * Active rooms keyed by room code.
         * @type {Map<string, Room>}
         */
        this.rooms = new Map();

        /**
         * Reverse lookup: player ID → room code.
         * @type {Map<number, string>}
         */
        this.playerRooms = new Map();
    }

    // -------------------------------------------------------------------------
    // Room Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Create a new room and add the requesting player as the first participant.
     *
     * Generates a unique 4-letter uppercase room code, creates the Room
     * instance, and registers the player in both the room and the reverse
     * lookup map.
     *
     * @param {number} playerId - ID of the player creating the room.
     * @param {import('ws').WebSocket} ws - Player's WebSocket connection.
     * @returns {Room} The newly created room.
     * @throws {Error} If the player is already in a room.
     */
    createRoom(playerId, ws) {
        if (this.playerRooms.has(playerId)) {
            throw new Error('Player is already in a room');
        }

        const code = this._generateUniqueCode();
        const room = new Room(code);

        room.addPlayer(playerId, ws);

        this.rooms.set(code, room);
        this.playerRooms.set(playerId, code);

        return room;
    }

    /**
     * Join an existing room by room code.
     *
     * Validates that the room exists, is not full, and the player is not
     * already in another room.
     *
     * @param {string} code - The 4-letter room code to join.
     * @param {number} playerId - ID of the joining player.
     * @param {import('ws').WebSocket} ws - Player's WebSocket connection.
     * @returns {Room} The joined room.
     * @throws {Error} If the room does not exist, is full, or the player is
     *   already in a room.
     */
    joinRoom(code, playerId, ws) {
        if (this.playerRooms.has(playerId)) {
            throw new Error('Player is already in a room');
        }

        const room = this.rooms.get(code);
        if (!room) {
            throw new Error(`Room ${code} does not exist`);
        }

        if (room.isFull()) {
            throw new Error(`Room ${code} is full`);
        }

        room.addPlayer(playerId, ws);
        this.playerRooms.set(playerId, code);

        return room;
    }

    /**
     * Remove a player from their current room.
     *
     * If the player was in a room, their opponent is notified with an
     * OPPONENT_DISCONNECTED message. If the room becomes empty after
     * removal it is destroyed.
     *
     * @param {number} playerId - ID of the player to remove.
     */
    removePlayer(playerId) {
        const code = this.playerRooms.get(playerId);
        if (!code) return;

        const room = this.rooms.get(code);
        if (!room) {
            this.playerRooms.delete(playerId);
            return;
        }

        // Notify the opponent before removing the player.
        const opponent = room.getOpponent(playerId);
        if (opponent && opponent.ws.readyState === opponent.ws.OPEN) {
            opponent.ws.send(serialize({ type: OPPONENT_DISCONNECTED }));
        }

        room.removePlayer(playerId);
        this.playerRooms.delete(playerId);

        // Destroy the room if it is now empty.
        if (room.players.size === 0) {
            this.rooms.delete(code);
        }
    }

    // -------------------------------------------------------------------------
    // Lookups
    // -------------------------------------------------------------------------

    /**
     * Get a room by its code.
     *
     * @param {string} code - Room code.
     * @returns {Room|null}
     */
    getRoom(code) {
        return this.rooms.get(code) || null;
    }

    /**
     * Get the room a player is currently in.
     *
     * @param {number} playerId - Player ID.
     * @returns {Room|null}
     */
    getRoomForPlayer(playerId) {
        const code = this.playerRooms.get(playerId);
        if (!code) return null;
        return this.rooms.get(code) || null;
    }

    // -------------------------------------------------------------------------
    // Internal Helpers
    // -------------------------------------------------------------------------

    /**
     * Generate a unique 4-letter uppercase room code.
     * Retries if a collision occurs (statistically rare at small room counts).
     *
     * @returns {string} A room code not currently in use.
     * @private
     */
    _generateUniqueCode() {
        let code;
        do {
            code = '';
            for (let i = 0; i < CODE_LENGTH; i++) {
                code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            }
        } while (this.rooms.has(code));

        return code;
    }
}
