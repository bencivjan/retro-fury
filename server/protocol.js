// =============================================================================
// protocol.js - Message protocol for RETRO FURY multiplayer
// =============================================================================
// Defines all message types exchanged between client and server over WebSocket.
// Provides parse() and serialize() helpers for safe JSON handling.
// =============================================================================

// -----------------------------------------------------------------------------
// Client → Server Message Types
// -----------------------------------------------------------------------------

/** Client requests creation of a new game room. */
export const CREATE_ROOM = 'create_room';

/** Client requests to join an existing room by code. */
export const JOIN_ROOM = 'join_room';

/** Client signals it is ready to begin the match. */
export const READY = 'ready';

/** Client sends player input for the current frame. */
export const INPUT = 'input';

// -----------------------------------------------------------------------------
// Server → Client Message Types
// -----------------------------------------------------------------------------

/** Server confirms a room was created and provides the room code. */
export const ROOM_CREATED = 'room_created';

/** Server notifies that a new player has joined the room. */
export const PLAYER_JOINED = 'player_joined';

/** Server notifies that a player has readied up. */
export const PLAYER_READY = 'player_ready';

/** Server signals both players are ready and the match is starting. */
export const GAME_START = 'game_start';

/** Server broadcasts authoritative game state snapshot. */
export const STATE = 'state';

/** Server notifies that a player was hit. */
export const HIT = 'hit';

/** Server notifies that a player was killed. */
export const KILL = 'kill';

/** Server notifies that a player has respawned. */
export const RESPAWN = 'respawn';

/** Server declares a match winner. */
export const VICTORY = 'victory';

/** Server notifies that the opponent has disconnected. */
export const OPPONENT_DISCONNECTED = 'opponent_disconnected';

/** Server sends an error message. */
export const ERROR = 'error';

// -----------------------------------------------------------------------------
// All Valid Types (for validation)
// -----------------------------------------------------------------------------

/** @type {Set<string>} */
const VALID_TYPES = new Set([
    // Client → Server
    CREATE_ROOM,
    JOIN_ROOM,
    READY,
    INPUT,
    // Server → Client
    ROOM_CREATED,
    PLAYER_JOINED,
    PLAYER_READY,
    GAME_START,
    STATE,
    HIT,
    KILL,
    RESPAWN,
    VICTORY,
    OPPONENT_DISCONNECTED,
    ERROR,
]);

// -----------------------------------------------------------------------------
// Parse / Serialize
// -----------------------------------------------------------------------------

/**
 * Parse a raw WebSocket message string into a protocol message object.
 *
 * Returns `null` if the string is not valid JSON or if the parsed object
 * does not contain a recognised `type` field.
 *
 * @param {string} rawString - Raw message received from the WebSocket.
 * @returns {object|null} Parsed message object, or null on failure.
 */
export function parse(rawString) {
    try {
        const msg = JSON.parse(rawString);

        if (msg === null || typeof msg !== 'object') {
            return null;
        }

        if (typeof msg.type !== 'string' || !VALID_TYPES.has(msg.type)) {
            return null;
        }

        return msg;
    } catch {
        return null;
    }
}

/**
 * Serialize a message object to a JSON string for transmission over WebSocket.
 *
 * @param {object} msgObject - Message object with a `type` field and payload data.
 * @returns {string} JSON-encoded string.
 */
export function serialize(msgObject) {
    return JSON.stringify(msgObject);
}
