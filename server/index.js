// =============================================================================
// index.js - WebSocket server entry point for RETRO FURY multiplayer
// =============================================================================
// Creates an HTTP server on port 3000 and upgrades connections to WebSocket.
// Handles lobby flow (create room, join room, ready up) and routes gameplay
// input messages to the appropriate room. Cleans up on disconnect.
// =============================================================================

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { RoomManager } from './room.js';
import { GameLoop } from './game-loop.js';
import {
    parse,
    serialize,
    CREATE_ROOM,
    JOIN_ROOM,
    READY,
    INPUT,
    ROOM_CREATED,
    PLAYER_JOINED,
    GAME_START,
    ERROR,
} from './protocol.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Port the server listens on. */
const PORT = 3000;

/**
 * Default spawn points for the arena map (matching arena.js spawnPoints).
 */
const DEFAULT_SPAWN_POINTS = [
    { x: 3.5, y: 2.5, angle: Math.PI / 4 },
    { x: 28.5, y: 2.5, angle: 3 * Math.PI / 4 },
    { x: 3.5, y: 29.5, angle: -Math.PI / 4 },
    { x: 28.5, y: 29.5, angle: -3 * Math.PI / 4 },
];

// -----------------------------------------------------------------------------
// Server State
// -----------------------------------------------------------------------------

const roomManager = new RoomManager();

/** Auto-incrementing counter for assigning unique player IDs. */
let nextPlayerId = 1;

/**
 * Map of WebSocket instances to their assigned player IDs.
 * @type {Map<import('ws').WebSocket, number>}
 */
const wsToPlayerId = new Map();

// =============================================================================
// HTTP + WebSocket Server
// =============================================================================

const httpServer = createServer((_req, res) => {
    // The HTTP server only exists to support the WebSocket upgrade.
    // Respond to plain HTTP requests with a simple status message.
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('RETRO FURY multiplayer server');
});

const wss = new WebSocketServer({ server: httpServer });

// =============================================================================
// Connection Handling
// =============================================================================

wss.on('connection', (ws) => {
    const playerId = nextPlayerId++;
    wsToPlayerId.set(ws, playerId);

    console.log(`[Server] Player ${playerId} connected (${wss.clients.size} total)`);

    // -------------------------------------------------------------------------
    // Message Routing
    // -------------------------------------------------------------------------

    ws.on('message', (raw) => {
        const msg = parse(String(raw));
        if (!msg) {
            sendError(ws, 'Malformed or unrecognised message');
            return;
        }

        switch (msg.type) {
            case CREATE_ROOM:
                handleCreateRoom(ws, playerId);
                break;

            case JOIN_ROOM:
                handleJoinRoom(ws, playerId, msg);
                break;

            case READY:
                handleReady(ws, playerId);
                break;

            case INPUT:
                handleInput(playerId, msg);
                break;

            default:
                sendError(ws, `Unexpected message type: ${msg.type}`);
                break;
        }
    });

    // -------------------------------------------------------------------------
    // Disconnect Cleanup
    // -------------------------------------------------------------------------

    ws.on('close', () => {
        console.log(`[Server] Player ${playerId} disconnected`);

        // Stop the game loop if this player was in an active game.
        const room = roomManager.getRoomForPlayer(playerId);
        if (room && room.gameLoop) {
            room.gameLoop.stop();
            room.gameLoop = null;
        }

        roomManager.removePlayer(playerId);
        wsToPlayerId.delete(ws);
    });

    ws.on('error', (err) => {
        console.error(`[Server] WebSocket error for player ${playerId}:`, err.message);
    });
});

// =============================================================================
// Message Handlers
// =============================================================================

/**
 * Handle a CREATE_ROOM request. Creates a new room with the requesting player
 * and sends the room code back.
 *
 * @param {import('ws').WebSocket} ws
 * @param {number} playerId
 */
function handleCreateRoom(ws, playerId) {
    try {
        const room = roomManager.createRoom(playerId, ws);
        console.log(`[Server] Player ${playerId} created room ${room.roomCode}`);

        ws.send(serialize({
            type: ROOM_CREATED,
            roomCode: room.roomCode,
        }));
    } catch (err) {
        sendError(ws, err.message);
    }
}

/**
 * Handle a JOIN_ROOM request. Adds the player to the specified room and
 * notifies both players.
 *
 * @param {import('ws').WebSocket} ws
 * @param {number} playerId
 * @param {object} msg - Must contain `roomCode`.
 */
function handleJoinRoom(ws, playerId, msg) {
    const code = typeof msg.roomCode === 'string' ? msg.roomCode.toUpperCase() : '';
    if (code.length !== 4) {
        sendError(ws, 'Invalid room code');
        return;
    }

    try {
        const room = roomManager.joinRoom(code, playerId, ws);
        console.log(`[Server] Player ${playerId} joined room ${code}`);

        // Notify both players that someone has joined.
        room.broadcast({
            type: PLAYER_JOINED,
            playerId,
            playerCount: room.players.size,
        });
    } catch (err) {
        sendError(ws, err.message);
    }
}

/**
 * Handle a READY message. Marks the player as ready in their room.
 * When both players in a room are ready, sends GAME_START to both.
 *
 * @param {import('ws').WebSocket} ws
 * @param {number} playerId
 */
function handleReady(ws, playerId) {
    const room = roomManager.getRoomForPlayer(playerId);
    if (!room) {
        sendError(ws, 'Not in a room');
        return;
    }

    const player = room.players.get(playerId);
    if (!player) return;

    player.ready = true;
    console.log(`[Server] Player ${playerId} is ready in room ${room.roomCode}`);

    // Check if all players are ready and the room is still in waiting state.
    if (!room.isFull()) return;
    if (room.state !== 'waiting') return;

    let allReady = true;
    for (const p of room.players.values()) {
        if (!p.ready) {
            allReady = false;
            break;
        }
    }

    if (!allReady) return;

    // Both players are ready -- start the game.
    room.state = 'playing';
    console.log(`[Server] Game starting in room ${room.roomCode}`);

    // Assign spawn points to each player.
    const playerIds = Array.from(room.players.keys());
    const spawnAssignments = {};
    for (let i = 0; i < playerIds.length; i++) {
        spawnAssignments[playerIds[i]] = DEFAULT_SPAWN_POINTS[i];
    }

    // Send GAME_START to each player with their own perspective.
    for (const [id, p] of room.players) {
        p.ws.send(serialize({
            type: GAME_START,
            yourId: id,
            players: playerIds,
            spawnPoints: spawnAssignments,
            arenaMap: 'arena',
        }));
    }

    // Start the server-authoritative game loop.
    room.gameLoop = new GameLoop(room);
    room.gameLoop.start(playerIds, spawnAssignments);
}

/**
 * Handle an INPUT message. Stores the player's input in the room's pending
 * input buffer for processing on the next server tick.
 *
 * @param {number} playerId
 * @param {object} msg - Input data (keys, mouseDX, mouseDY, fire, dt).
 */
function handleInput(playerId, msg) {
    const room = roomManager.getRoomForPlayer(playerId);
    if (!room || room.state !== 'playing') return;

    // Store input on the room for the game loop to consume.
    // The game loop (Phase 5) will read and clear these buffers each tick.
    if (!room.pendingInputs) {
        room.pendingInputs = new Map();
    }

    room.pendingInputs.set(playerId, {
        keys: msg.keys || [],
        mouseDX: msg.mouseDX || 0,
        mouseDY: msg.mouseDY || 0,
        fire: !!msg.fire,
        dt: msg.dt || 0,
    });
}

// =============================================================================
// Utility
// =============================================================================

/**
 * Send an ERROR message to a single client.
 *
 * @param {import('ws').WebSocket} ws
 * @param {string} message - Human-readable error description.
 */
function sendError(ws, message) {
    if (ws.readyState === ws.OPEN) {
        ws.send(serialize({ type: ERROR, message }));
    }
}

// =============================================================================
// Start
// =============================================================================

httpServer.listen(PORT, () => {
    console.log(`[Server] RETRO FURY multiplayer server listening on port ${PORT}`);
});
