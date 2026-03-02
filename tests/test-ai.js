// =============================================================================
// test-ai.js - Tests for src/ai/state-machine.js and src/ai/pathfinding.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import { StateMachine, States } from '../src/ai/state-machine.js';
import { lineOfSight } from '../src/ai/pathfinding.js';

// =============================================================================
// States enum
// =============================================================================

describe('States enum', () => {
    it('has all expected states as strings', () => {
        assert.equal(States.IDLE, 'IDLE');
        assert.equal(States.PATROL, 'PATROL');
        assert.equal(States.ALERT, 'ALERT');
        assert.equal(States.CHASE, 'CHASE');
        assert.equal(States.ATTACK, 'ATTACK');
        assert.equal(States.PAIN, 'PAIN');
        assert.equal(States.DYING, 'DYING');
        assert.equal(States.DEAD, 'DEAD');
    });

    it('has 8 total states', () => {
        assert.equal(Object.keys(States).length, 8);
    });

    it('is frozen (immutable)', () => {
        assert.ok(Object.isFrozen(States));
    });
});

// =============================================================================
// StateMachine - constructor
// =============================================================================

describe('StateMachine - constructor', () => {
    it('starts with no active state when no initial state given', () => {
        const sm = new StateMachine({});
        assert.equal(sm.currentState, null);
    });

    it('enters the initial state if provided', () => {
        let entered = false;
        const sm = new StateMachine({
            'A': { enter() { entered = true; }, update() {}, exit() {} },
        }, 'A');
        assert.equal(sm.currentState, 'A');
        assert.equal(entered, true);
    });
});

// =============================================================================
// StateMachine - transition
// =============================================================================

describe('StateMachine - transition', () => {
    it('transitions to a new state', () => {
        const sm = new StateMachine({
            'A': { enter() {}, update() {}, exit() {} },
            'B': { enter() {}, update() {}, exit() {} },
        }, 'A');
        sm.transition('B');
        assert.equal(sm.currentState, 'B');
    });

    it('calls exit on the old state and enter on the new state', () => {
        let exitCalled = false;
        let enterCalled = false;
        const sm = new StateMachine({
            'A': { enter() {}, update() {}, exit() { exitCalled = true; } },
            'B': { enter() { enterCalled = true; }, update() {}, exit() {} },
        }, 'A');
        sm.transition('B');
        assert.equal(exitCalled, true);
        assert.equal(enterCalled, true);
    });

    it('skips transition to the same state (no double-enter)', () => {
        let enterCount = 0;
        const sm = new StateMachine({
            'A': { enter() { enterCount++; }, update() {}, exit() {} },
        }, 'A');
        assert.equal(enterCount, 1);
        sm.transition('A'); // same state, should be skipped
        assert.equal(enterCount, 1);
    });

    it('handles missing enter/exit callbacks gracefully', () => {
        const sm = new StateMachine({
            'A': { update() {} },
            'B': { update() {} },
        }, 'A');
        // Should not throw
        sm.transition('B');
        assert.equal(sm.currentState, 'B');
    });

    it('handles transition to a state not in the states map', () => {
        const sm = new StateMachine({
            'A': { enter() {}, update() {}, exit() {} },
        }, 'A');
        // Transition to unknown state - should not throw, just update currentState
        sm.transition('UNKNOWN');
        assert.equal(sm.currentState, 'UNKNOWN');
    });

    it('queues re-entrant transitions triggered from enter()', () => {
        const order = [];
        const sm = new StateMachine({
            'A': {
                enter() { order.push('enter-A'); },
                update() {},
                exit() { order.push('exit-A'); },
            },
            'B': {
                enter() {
                    order.push('enter-B');
                    // Re-entrant: request transition to C from inside enter()
                    sm.transition('C');
                },
                update() {},
                exit() { order.push('exit-B'); },
            },
            'C': {
                enter() { order.push('enter-C'); },
                update() {},
                exit() {},
            },
        }, 'A');

        sm.transition('B');
        // Expected: exit-A, enter-B, then queued: exit-B, enter-C
        assert.equal(sm.currentState, 'C');
        assert.deepEqual(order, ['enter-A', 'exit-A', 'enter-B', 'exit-B', 'enter-C']);
    });

    it('queues re-entrant transitions triggered from exit()', () => {
        const sm = new StateMachine({
            'A': {
                enter() {},
                update() {},
                exit() { sm.transition('C'); }, // re-entrant
            },
            'B': {
                enter() {},
                update() {},
                exit() {},
            },
            'C': {
                enter() {},
                update() {},
                exit() {},
            },
        }, 'A');

        sm.transition('B');
        // exit-A triggers transition to C, which gets queued.
        // After B is entered, pending C is processed.
        assert.equal(sm.currentState, 'C');
    });
});

// =============================================================================
// StateMachine - update
// =============================================================================

describe('StateMachine - update', () => {
    it('calls update on the current state with dt', () => {
        let receivedDt = null;
        const sm = new StateMachine({
            'A': {
                enter() {},
                update(dt) { receivedDt = dt; },
                exit() {},
            },
        }, 'A');
        sm.update(0.016);
        assert.closeTo(receivedDt, 0.016, 1e-9);
    });

    it('does nothing if no current state', () => {
        const sm = new StateMachine({});
        // Should not throw
        sm.update(0.016);
    });

    it('does nothing if state has no update function', () => {
        const sm = new StateMachine({
            'A': { enter() {} },
        }, 'A');
        // Should not throw
        sm.update(0.016);
    });
});

// =============================================================================
// StateMachine - is
// =============================================================================

describe('StateMachine - is', () => {
    it('returns true for the current state', () => {
        const sm = new StateMachine({
            'A': { enter() {}, update() {}, exit() {} },
        }, 'A');
        assert.equal(sm.is('A'), true);
    });

    it('returns false for a different state', () => {
        const sm = new StateMachine({
            'A': { enter() {}, update() {}, exit() {} },
        }, 'A');
        assert.equal(sm.is('B'), false);
    });

    it('returns false when no state is active', () => {
        const sm = new StateMachine({});
        assert.equal(sm.is('A'), false);
    });
});

// =============================================================================
// StateMachine - multi-state walkthrough (simulating enemy FSM)
// =============================================================================

describe('StateMachine - enemy-like state sequence', () => {
    it('walks through IDLE -> ALERT -> CHASE -> ATTACK -> PAIN -> DYING -> DEAD', () => {
        const visited = [];
        const states = {};
        for (const name of ['IDLE', 'ALERT', 'CHASE', 'ATTACK', 'PAIN', 'DYING', 'DEAD']) {
            states[name] = {
                enter() { visited.push(name); },
                update() {},
                exit() {},
            };
        }

        const sm = new StateMachine(states, 'IDLE');
        assert.equal(sm.currentState, 'IDLE');

        sm.transition('ALERT');
        assert.equal(sm.currentState, 'ALERT');

        sm.transition('CHASE');
        assert.equal(sm.currentState, 'CHASE');

        sm.transition('ATTACK');
        assert.equal(sm.currentState, 'ATTACK');

        sm.transition('PAIN');
        assert.equal(sm.currentState, 'PAIN');

        sm.transition('DYING');
        assert.equal(sm.currentState, 'DYING');

        sm.transition('DEAD');
        assert.equal(sm.currentState, 'DEAD');

        assert.deepEqual(visited, ['IDLE', 'ALERT', 'CHASE', 'ATTACK', 'PAIN', 'DYING', 'DEAD']);
    });
});

// =============================================================================
// lineOfSight - basic tests on small grids
// =============================================================================

describe('lineOfSight - clear path', () => {
    // 5x5 open map (all zeros)
    const openMap = {
        grid: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ],
        width: 5,
        height: 5,
    };

    it('returns true for a clear horizontal path', () => {
        assert.equal(lineOfSight(0.5, 2.5, 4.5, 2.5, openMap), true);
    });

    it('returns true for a clear vertical path', () => {
        assert.equal(lineOfSight(2.5, 0.5, 2.5, 4.5, openMap), true);
    });

    it('returns true for a clear diagonal path', () => {
        assert.equal(lineOfSight(0.5, 0.5, 4.5, 4.5, openMap), true);
    });

    it('returns true for the same point', () => {
        assert.equal(lineOfSight(2.5, 2.5, 2.5, 2.5, openMap), true);
    });

    it('returns true for very close points', () => {
        assert.equal(lineOfSight(2.5, 2.5, 2.501, 2.501, openMap), true);
    });
});

describe('lineOfSight - blocked path', () => {
    // Map with a wall in the middle
    const wallMap = {
        grid: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],  // wall at (2, 2)
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ],
        width: 5,
        height: 5,
    };

    it('returns false when a wall blocks the path', () => {
        // Horizontal ray through the wall at (2, 2)
        assert.equal(lineOfSight(0.5, 2.5, 4.5, 2.5, wallMap), false);
    });

    it('returns true for a path that avoids the wall', () => {
        // Path from bottom-left to top-right that goes above the wall
        assert.equal(lineOfSight(0.5, 0.5, 4.5, 0.5, wallMap), true);
    });

    it('returns false for diagonal path through wall', () => {
        // Diagonal that goes through the wall tile
        assert.equal(lineOfSight(0.5, 0.5, 4.5, 4.5, wallMap), false);
    });
});

describe('lineOfSight - wall barrier', () => {
    // Complete wall barrier across the map
    const barrierMap = {
        grid: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1],  // complete wall row
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ],
        width: 5,
        height: 5,
    };

    it('returns false when crossing a complete wall barrier', () => {
        assert.equal(lineOfSight(2.5, 0.5, 2.5, 4.5, barrierMap), false);
    });

    it('returns true for points on the same side of the barrier', () => {
        assert.equal(lineOfSight(0.5, 0.5, 4.5, 0.5, barrierMap), true);
    });
});

describe('lineOfSight - out of bounds', () => {
    const smallMap = {
        grid: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ],
        width: 3,
        height: 3,
    };

    it('returns false when the target is outside the map', () => {
        // Ray that would leave the map
        assert.equal(lineOfSight(1.5, 1.5, -1, 1.5, smallMap), false);
    });
});

// =============================================================================
// lineOfSight - edge: corridor with doorway (gap in wall)
// =============================================================================

describe('lineOfSight - gap in wall', () => {
    const gapMap = {
        grid: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [1, 1, 0, 1, 1],  // wall with a gap at column 2
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
        ],
        width: 5,
        height: 5,
    };

    it('returns true through the gap', () => {
        assert.equal(lineOfSight(2.5, 0.5, 2.5, 4.5, gapMap), true);
    });

    it('returns false through the solid part of the wall', () => {
        assert.equal(lineOfSight(0.5, 0.5, 0.5, 4.5, gapMap), false);
    });
});
