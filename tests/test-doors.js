// =============================================================================
// test-doors.js - Tests for src/game/door.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import { Door, DoorState, OPEN_DURATION, STAY_OPEN_DURATION } from '../src/game/door.js';

// =============================================================================
// Door Constructor
// =============================================================================

describe('Door - constructor', () => {
    it('sets tile coordinates', () => {
        const d = new Door(3, 7);
        assert.equal(d.x, 3);
        assert.equal(d.y, 7);
    });

    it('defaults to CLOSED state', () => {
        const d = new Door(0, 0);
        assert.equal(d.state, DoorState.CLOSED);
    });

    it('starts with openAmount 0', () => {
        const d = new Door(0, 0);
        assert.equal(d.openAmount, 0);
    });

    it('defaults textureId to 10', () => {
        const d = new Door(0, 0);
        assert.equal(d.textureId, 10);
    });

    it('accepts a custom textureId', () => {
        const d = new Door(0, 0, 7);
        assert.equal(d.textureId, 7);
    });

    it('defaults lockColor to null (unlocked)', () => {
        const d = new Door(0, 0);
        assert.equal(d.lockColor, null);
    });

    it('accepts a lock color', () => {
        const d = new Door(0, 0, 10, 'blue');
        assert.equal(d.lockColor, 'blue');
    });
});

// =============================================================================
// DoorState enum
// =============================================================================

describe('DoorState enum', () => {
    it('has CLOSED, OPENING, OPEN, CLOSING states', () => {
        assert.equal(DoorState.CLOSED, 0);
        assert.equal(DoorState.OPENING, 1);
        assert.equal(DoorState.OPEN, 2);
        assert.equal(DoorState.CLOSING, 3);
    });

    it('is frozen (immutable)', () => {
        assert.ok(Object.isFrozen(DoorState));
    });
});

// =============================================================================
// Door - tryOpen (unlocked)
// =============================================================================

describe('Door - tryOpen (unlocked)', () => {
    it('opens a closed unlocked door', () => {
        const d = new Door(0, 0);
        const player = { hasKeycard: () => false, keycards: new Set() };
        const result = d.tryOpen(player);
        assert.equal(result.success, true);
        assert.equal(d.state, DoorState.OPENING);
    });

    it('returns failure when door is already opening', () => {
        const d = new Door(0, 0);
        d.state = DoorState.OPENING;
        const player = { hasKeycard: () => false };
        const result = d.tryOpen(player);
        assert.equal(result.success, false);
    });

    it('returns failure when door is already open', () => {
        const d = new Door(0, 0);
        d.state = DoorState.OPEN;
        const player = { hasKeycard: () => false };
        const result = d.tryOpen(player);
        assert.equal(result.success, false);
    });

    it('reverses a closing door back to opening', () => {
        const d = new Door(0, 0);
        d.state = DoorState.CLOSING;
        d.openAmount = 0.5;
        const player = { hasKeycard: () => false };
        const result = d.tryOpen(player);
        assert.equal(result.success, true);
        assert.equal(d.state, DoorState.OPENING);
    });
});

// =============================================================================
// Door - tryOpen (locked)
// =============================================================================

describe('Door - tryOpen (locked)', () => {
    it('refuses to open without the matching keycard', () => {
        const d = new Door(0, 0, 10, 'blue');
        const player = { hasKeycard: (color) => false };
        const result = d.tryOpen(player);
        assert.equal(result.success, false);
        assert.ok(result.message.includes('blue keycard'));
        assert.equal(d.state, DoorState.CLOSED);
    });

    it('opens when the player has the matching keycard', () => {
        const d = new Door(0, 0, 10, 'blue');
        const player = { hasKeycard: (color) => color === 'blue' };
        const result = d.tryOpen(player);
        assert.equal(result.success, true);
        assert.equal(d.state, DoorState.OPENING);
    });

    it('includes keycard color in the success message', () => {
        const d = new Door(0, 0, 10, 'red');
        const player = { hasKeycard: (color) => color === 'red' };
        const result = d.tryOpen(player);
        assert.ok(result.message.includes('red keycard'));
    });
});

// =============================================================================
// Door - state transitions via update
// =============================================================================

describe('Door - CLOSED to OPENING to OPEN transition', () => {
    it('progresses openAmount during OPENING', () => {
        const d = new Door(0, 0);
        d.state = DoorState.OPENING;
        d._timer = 0;

        // Update halfway through the opening duration
        d.update(OPEN_DURATION * 0.5);
        assert.closeTo(d.openAmount, 0.5, 0.01);
        assert.equal(d.state, DoorState.OPENING);
    });

    it('transitions to OPEN when fully opened', () => {
        const d = new Door(0, 0);
        d.state = DoorState.OPENING;
        d._timer = 0;

        // Update past the full opening duration
        d.update(OPEN_DURATION + 0.01);
        assert.equal(d.state, DoorState.OPEN);
        assert.equal(d.openAmount, 1.0);
    });
});

describe('Door - OPEN to CLOSING transition', () => {
    it('stays open until STAY_OPEN_DURATION expires', () => {
        const d = new Door(0, 0);
        d.state = DoorState.OPEN;
        d._timer = 0;

        d.update(STAY_OPEN_DURATION * 0.5);
        assert.equal(d.state, DoorState.OPEN);
    });

    it('transitions to CLOSING after STAY_OPEN_DURATION', () => {
        const d = new Door(0, 0);
        d.state = DoorState.OPEN;
        d._timer = 0;

        d.update(STAY_OPEN_DURATION + 0.01);
        assert.equal(d.state, DoorState.CLOSING);
    });

    it('holds open when player is standing in the doorway', () => {
        const d = new Door(5, 10);
        d.state = DoorState.OPEN;
        d._timer = 0;

        // Player position at tile (5, 10) - same as door
        const playerPos = { x: 5.5, y: 10.5 };
        d.update(STAY_OPEN_DURATION + 0.01, playerPos);
        assert.equal(d.state, DoorState.OPEN);
    });

    it('closes if player is in a different tile', () => {
        const d = new Door(5, 10);
        d.state = DoorState.OPEN;
        d._timer = 0;

        // Player is far away
        const playerPos = { x: 20.5, y: 20.5 };
        d.update(STAY_OPEN_DURATION + 0.01, playerPos);
        assert.equal(d.state, DoorState.CLOSING);
    });
});

describe('Door - CLOSING to CLOSED transition', () => {
    it('decreases openAmount during CLOSING', () => {
        const d = new Door(0, 0);
        d.state = DoorState.CLOSING;
        d.openAmount = 1.0;
        d._timer = 0;

        d.update(OPEN_DURATION * 0.5);
        assert.closeTo(d.openAmount, 0.5, 0.01);
        assert.equal(d.state, DoorState.CLOSING);
    });

    it('transitions to CLOSED when fully closed', () => {
        const d = new Door(0, 0);
        d.state = DoorState.CLOSING;
        d.openAmount = 1.0;
        d._timer = 0;

        d.update(OPEN_DURATION + 0.01);
        assert.equal(d.state, DoorState.CLOSED);
        assert.equal(d.openAmount, 0);
    });
});

// =============================================================================
// Door - Full lifecycle
// =============================================================================

describe('Door - full lifecycle (CLOSED -> OPENING -> OPEN -> CLOSING -> CLOSED)', () => {
    it('completes a full open/close cycle', () => {
        const d = new Door(5, 5);
        const player = { hasKeycard: () => false };

        // 1. Start CLOSED
        assert.equal(d.state, DoorState.CLOSED);

        // 2. Open it
        d.tryOpen(player);
        assert.equal(d.state, DoorState.OPENING);

        // 3. Advance to fully open
        d.update(OPEN_DURATION + 0.01);
        assert.equal(d.state, DoorState.OPEN);
        assert.equal(d.openAmount, 1.0);

        // 4. Wait for auto-close
        d.update(STAY_OPEN_DURATION + 0.01);
        assert.equal(d.state, DoorState.CLOSING);

        // 5. Advance to fully closed
        d.update(OPEN_DURATION + 0.01);
        assert.equal(d.state, DoorState.CLOSED);
        assert.equal(d.openAmount, 0);
    });
});

// =============================================================================
// Door - isBlocking
// =============================================================================

describe('Door - isBlocking', () => {
    it('blocks when fully closed', () => {
        const d = new Door(0, 0);
        assert.equal(d.isBlocking(), true);
    });

    it('blocks when partially open', () => {
        const d = new Door(0, 0);
        d.openAmount = 0.5;
        assert.equal(d.isBlocking(), true);
    });

    it('does not block when fully open', () => {
        const d = new Door(0, 0);
        d.openAmount = 1.0;
        assert.equal(d.isBlocking(), false);
    });
});

// =============================================================================
// Door - reset
// =============================================================================

describe('Door - reset', () => {
    it('resets to closed state', () => {
        const d = new Door(0, 0);
        d.state = DoorState.OPEN;
        d.openAmount = 1.0;
        d._timer = 5.0;
        d.reset();

        assert.equal(d.state, DoorState.CLOSED);
        assert.equal(d.openAmount, 0);
    });
});

// =============================================================================
// Door - CLOSED state does nothing on update
// =============================================================================

describe('Door - CLOSED update', () => {
    it('stays closed when updated', () => {
        const d = new Door(0, 0);
        d.update(1.0);
        assert.equal(d.state, DoorState.CLOSED);
        assert.equal(d.openAmount, 0);
    });
});

// =============================================================================
// Door - exported constants
// =============================================================================

describe('Door - exported constants', () => {
    it('OPEN_DURATION is 0.5 seconds', () => {
        assert.equal(OPEN_DURATION, 0.5);
    });

    it('STAY_OPEN_DURATION is 3.0 seconds', () => {
        assert.equal(STAY_OPEN_DURATION, 3.0);
    });
});
