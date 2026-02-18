// =============================================================================
// network-manager.js - Client-side WebSocket manager for RETRO FURY multiplayer
// =============================================================================
// Manages a single WebSocket connection to the game server. Provides a clean
// Promise-based connect API, message serialization/deserialization, and
// callback registration for incoming messages and disconnection events.
// =============================================================================

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default server URL when none is provided. */
const DEFAULT_URL = `ws://${window.location.hostname}:3000`;

// -----------------------------------------------------------------------------
// Protocol Helpers (inline to avoid importing Node-only server module)
// -----------------------------------------------------------------------------

/**
 * Parse a raw WebSocket message string into a protocol message object.
 * Returns null if the string is not valid JSON or lacks a `type` field.
 *
 * @param {string} rawString - Raw message from the WebSocket.
 * @returns {object|null} Parsed message, or null on failure.
 */
function parseMessage(rawString) {
    try {
        const msg = JSON.parse(rawString);
        if (msg === null || typeof msg !== 'object') return null;
        if (typeof msg.type !== 'string') return null;
        return msg;
    } catch {
        return null;
    }
}

/**
 * Serialize a message object to a JSON string.
 *
 * @param {object} msgObject - Message with a `type` field.
 * @returns {string}
 */
function serializeMessage(msgObject) {
    return JSON.stringify(msgObject);
}

// =============================================================================
// NetworkManager Class
// =============================================================================

export class NetworkManager {
    /**
     * @param {string} [url] - WebSocket server URL. Defaults to ws://localhost:3000.
     */
    constructor(url = DEFAULT_URL) {
        /** @type {string} Server URL. */
        this._url = url;

        /** @type {WebSocket|null} Active WebSocket connection. */
        this._ws = null;

        /** @type {boolean} Whether a live connection is established. */
        this._connected = false;

        /**
         * Callback invoked for every parsed incoming message.
         * @type {((msg: object) => void)|null}
         */
        this._messageHandler = null;

        /**
         * Callback invoked when the connection is closed (intentionally or not).
         * @type {((event: CloseEvent) => void)|null}
         */
        this._disconnectHandler = null;
    }

    // -------------------------------------------------------------------------
    // Connection Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Open a WebSocket connection to the server.
     *
     * Returns a Promise that resolves once the connection is open and ready
     * for communication, or rejects if the connection fails.
     *
     * @returns {Promise<void>}
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this._ws) {
                this.disconnect();
            }

            try {
                this._ws = new WebSocket(this._url);
            } catch (err) {
                reject(err);
                return;
            }

            this._ws.addEventListener('open', () => {
                this._connected = true;
                resolve();
            });

            this._ws.addEventListener('error', (event) => {
                // If we are not yet connected, the error causes the promise to
                // reject. After connection, errors are surfaced via the close
                // handler instead.
                if (!this._connected) {
                    reject(new Error('WebSocket connection failed'));
                }
            });

            this._ws.addEventListener('message', (event) => {
                const msg = parseMessage(typeof event.data === 'string' ? event.data : String(event.data));
                if (msg && this._messageHandler) {
                    this._messageHandler(msg);
                }
            });

            this._ws.addEventListener('close', (event) => {
                this._connected = false;
                this._ws = null;

                if (this._disconnectHandler) {
                    this._disconnectHandler(event);
                }
            });
        });
    }

    /**
     * Close the WebSocket connection cleanly.
     *
     * Safe to call even if the connection is already closed or was never opened.
     */
    disconnect() {
        if (this._ws) {
            this._ws.close();
            this._ws = null;
            this._connected = false;
        }
    }

    // -------------------------------------------------------------------------
    // Sending
    // -------------------------------------------------------------------------

    /**
     * Serialize and send a message object to the server.
     *
     * Silently does nothing if the connection is not open, so callers do not
     * need to guard every send call.
     *
     * @param {object} msgObject - Protocol message with a `type` field.
     */
    send(msgObject) {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
        this._ws.send(serializeMessage(msgObject));
    }

    // -------------------------------------------------------------------------
    // Callbacks
    // -------------------------------------------------------------------------

    /**
     * Register a handler that is called for every incoming parsed message.
     *
     * Only one handler is active at a time; calling this again replaces
     * the previous handler.
     *
     * @param {(msg: object) => void} callback
     */
    onMessage(callback) {
        this._messageHandler = callback;
    }

    /**
     * Register a handler that is called when the connection closes.
     *
     * Only one handler is active at a time; calling this again replaces
     * the previous handler.
     *
     * @param {(event: CloseEvent) => void} callback
     */
    onDisconnect(callback) {
        this._disconnectHandler = callback;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /**
     * Whether the WebSocket connection is currently open and ready.
     *
     * @returns {boolean}
     */
    isConnected() {
        return this._connected;
    }
}
