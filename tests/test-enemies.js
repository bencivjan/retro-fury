// =============================================================================
// test-enemies.js - Tests for src/game/enemy.js, grunt.js, soldier.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import { Enemy, DEFAULT_RADIUS, ANIM, States } from '../src/game/enemy.js';
import { createGrunt } from '../src/game/enemies/grunt.js';
import { createSoldier } from '../src/game/enemies/soldier.js';
import { GRUNT_BEHAVIOR, SOLDIER_BEHAVIOR } from '../src/ai/behaviors.js';

// =============================================================================
// Enemy - constructor
// =============================================================================

describe('Enemy - constructor', () => {
    it('sets position', () => {
        const e = new Enemy(5.5, 10.5, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.pos.x, 5.5);
        assert.equal(e.pos.y, 10.5);
    });

    it('sets type name', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.type, 'grunt');
    });

    it('stores behavior reference', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.behavior, GRUNT_BEHAVIOR);
    });

    it('initializes health from behavior.hp', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.health, GRUNT_BEHAVIOR.hp);
        assert.equal(e.maxHealth, GRUNT_BEHAVIOR.hp);
    });

    it('starts alive', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.alive, true);
    });

    it('starts in IDLE state', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.stateMachine.currentState, States.IDLE);
    });

    it('uses default radius when no scale in behavior', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.radius, DEFAULT_RADIUS);
    });

    it('scales radius when behavior has scale', () => {
        const behavior = { ...GRUNT_BEHAVIOR, scale: 1.5 };
        const e = new Enemy(1, 1, 'brute', behavior);
        assert.closeTo(e.radius, DEFAULT_RADIUS * 1.5, 1e-9);
    });

    it('sets spriteId from behavior', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.spriteId, GRUNT_BEHAVIOR.spriteId);
    });

    it('initializes animation frame to IDLE (0)', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        assert.equal(e.animFrame, ANIM.IDLE);
    });
});

// =============================================================================
// Enemy - takeDamage
// =============================================================================

describe('Enemy - takeDamage', () => {
    it('reduces health by the damage amount', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        e.takeDamage(10);
        assert.equal(e.health, GRUNT_BEHAVIOR.hp - 10);
    });

    it('returns true (killed) when health reaches 0', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        const killed = e.takeDamage(GRUNT_BEHAVIOR.hp);
        assert.equal(killed, true);
        assert.equal(e.health, 0);
    });

    it('transitions to DYING state on lethal damage', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        e.takeDamage(GRUNT_BEHAVIOR.hp);
        assert.equal(e.stateMachine.currentState, States.DYING);
    });

    it('keeps alive=true in DYING state (alive set to false in DEAD)', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        e.takeDamage(GRUNT_BEHAVIOR.hp);
        // In DYING state, alive is still true
        assert.equal(e.alive, true);
        assert.equal(e.stateMachine.currentState, States.DYING);
    });

    it('returns false when enemy survives', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        const killed = e.takeDamage(5);
        assert.equal(killed, false);
    });

    it('ignores zero damage', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        const killed = e.takeDamage(0);
        assert.equal(killed, false);
        assert.equal(e.health, GRUNT_BEHAVIOR.hp);
    });

    it('ignores negative damage', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        e.takeDamage(-10);
        assert.equal(e.health, GRUNT_BEHAVIOR.hp);
    });

    it('ignores damage when not alive', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        e.alive = false;
        const killed = e.takeDamage(999);
        assert.equal(killed, false);
    });

    it('ignores damage when in DYING state', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        e.takeDamage(GRUNT_BEHAVIOR.hp); // transitions to DYING
        const killed = e.takeDamage(100); // should be ignored
        assert.equal(killed, false);
    });

    it('ignores damage when in DEAD state', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        e.stateMachine.transition(States.DYING);
        e.stateMachine.transition(States.DEAD);
        const killed = e.takeDamage(100);
        assert.equal(killed, false);
    });

    it('damage alerting: transitions IDLE enemy to ALERT on non-lethal damage', () => {
        const e = new Enemy(1, 1, 'grunt', GRUNT_BEHAVIOR);
        // Override random so painChance never triggers
        const origRandom = Math.random;
        Math.random = () => 1.0; // > painChance, so no pain
        e.takeDamage(1);
        Math.random = origRandom;
        assert.equal(e.stateMachine.currentState, States.ALERT);
    });
});

// =============================================================================
// createGrunt factory
// =============================================================================

describe('createGrunt factory', () => {
    it('returns an Enemy instance', () => {
        const g = createGrunt(3.5, 7.5);
        assert.ok(g instanceof Enemy);
    });

    it('has type "grunt"', () => {
        const g = createGrunt(3.5, 7.5);
        assert.equal(g.type, 'grunt');
    });

    it('has grunt health (30 HP)', () => {
        const g = createGrunt(3.5, 7.5);
        assert.equal(g.health, 30);
        assert.equal(g.maxHealth, 30);
    });

    it('sets position correctly', () => {
        const g = createGrunt(3.5, 7.5);
        assert.equal(g.pos.x, 3.5);
        assert.equal(g.pos.y, 7.5);
    });

    it('has grunt spriteId', () => {
        const g = createGrunt(1, 1);
        assert.equal(g.spriteId, GRUNT_BEHAVIOR.spriteId);
    });

    it('uses grunt behavior values', () => {
        const g = createGrunt(1, 1);
        assert.equal(g.behavior.damage, 5);
        assert.equal(g.behavior.sightRange, 8);
        assert.equal(g.behavior.attackRange, 6);
        assert.equal(g.behavior.fireRate, 0.8);
        assert.closeTo(g.behavior.accuracy, 0.3, 1e-9);
    });
});

// =============================================================================
// createSoldier factory
// =============================================================================

describe('createSoldier factory', () => {
    it('returns an Enemy instance', () => {
        const s = createSoldier(3.5, 7.5);
        assert.ok(s instanceof Enemy);
    });

    it('has type "soldier"', () => {
        const s = createSoldier(3.5, 7.5);
        assert.equal(s.type, 'soldier');
    });

    it('has soldier health (50 HP)', () => {
        const s = createSoldier(3.5, 7.5);
        assert.equal(s.health, 50);
        assert.equal(s.maxHealth, 50);
    });

    it('sets position correctly', () => {
        const s = createSoldier(3.5, 7.5);
        assert.equal(s.pos.x, 3.5);
        assert.equal(s.pos.y, 7.5);
    });

    it('has soldier spriteId', () => {
        const s = createSoldier(1, 1);
        assert.equal(s.spriteId, SOLDIER_BEHAVIOR.spriteId);
    });

    it('uses soldier behavior values', () => {
        const s = createSoldier(1, 1);
        assert.equal(s.behavior.damage, 8);
        assert.equal(s.behavior.sightRange, 10);
        assert.equal(s.behavior.attackRange, 8);
        assert.equal(s.behavior.fireRate, 1.5);
        assert.equal(s.behavior.strafes, true);
    });

    it('has a random strafe direction (-1 or 1)', () => {
        const s = createSoldier(1, 1);
        assert.ok(s._strafeDir === -1 || s._strafeDir === 1);
    });
});

// =============================================================================
// Enemy properties - grunt vs soldier comparison
// =============================================================================

describe('Enemy - grunt vs soldier properties', () => {
    it('soldier has more health than grunt', () => {
        const g = createGrunt(1, 1);
        const s = createSoldier(1, 1);
        assert.ok(s.health > g.health);
    });

    it('soldier deals more damage per hit than grunt', () => {
        const g = createGrunt(1, 1);
        const s = createSoldier(1, 1);
        assert.ok(s.behavior.damage > g.behavior.damage);
    });

    it('soldier has higher fire rate than grunt', () => {
        const g = createGrunt(1, 1);
        const s = createSoldier(1, 1);
        assert.ok(s.behavior.fireRate > g.behavior.fireRate);
    });

    it('soldier is faster than grunt', () => {
        const g = createGrunt(1, 1);
        const s = createSoldier(1, 1);
        assert.ok(s.behavior.chaseSpeed > g.behavior.chaseSpeed);
    });
});

// =============================================================================
// ANIM constants
// =============================================================================

describe('ANIM constants', () => {
    it('has the expected animation frame indices', () => {
        assert.equal(ANIM.IDLE, 0);
        assert.equal(ANIM.WALK_START, 1);
        assert.equal(ANIM.WALK_END, 2);
        assert.equal(ANIM.ATTACK_START, 3);
        assert.equal(ANIM.ATTACK_END, 4);
        assert.equal(ANIM.PAIN, 5);
        assert.equal(ANIM.DEATH_START, 6);
        assert.equal(ANIM.DEATH_END, 8);
    });

    it('is frozen (immutable)', () => {
        assert.ok(Object.isFrozen(ANIM));
    });
});

// =============================================================================
// States enum (re-exported from enemy.js)
// =============================================================================

describe('States enum (exported from enemy.js)', () => {
    it('has all expected states', () => {
        assert.equal(States.IDLE, 'IDLE');
        assert.equal(States.PATROL, 'PATROL');
        assert.equal(States.ALERT, 'ALERT');
        assert.equal(States.CHASE, 'CHASE');
        assert.equal(States.ATTACK, 'ATTACK');
        assert.equal(States.PAIN, 'PAIN');
        assert.equal(States.DYING, 'DYING');
        assert.equal(States.DEAD, 'DEAD');
    });
});

// =============================================================================
// DEFAULT_RADIUS
// =============================================================================

describe('DEFAULT_RADIUS', () => {
    it('is 0.3 tiles', () => {
        assert.equal(DEFAULT_RADIUS, 0.3);
    });
});
