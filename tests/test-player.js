// =============================================================================
// test-player.js - Tests for src/game/player.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import { Player, MAX_HEALTH, MAX_ARMOR, MAX_AMMO, COLLISION_RADIUS, MOVE_SPEED } from '../src/game/player.js';

// =============================================================================
// Player Constructor
// =============================================================================

describe('Player - constructor', () => {
    it('sets initial position from arguments', () => {
        const p = new Player(5.5, 10.5);
        assert.equal(p.pos.x, 5.5);
        assert.equal(p.pos.y, 10.5);
    });

    it('defaults angle to 0 when not provided', () => {
        const p = new Player(1, 1);
        assert.equal(p.angle, 0);
    });

    it('accepts an explicit starting angle', () => {
        const p = new Player(1, 1, Math.PI);
        assert.closeTo(p.angle, Math.PI, 1e-9);
    });

    it('starts with 100 health', () => {
        const p = new Player(1, 1);
        assert.equal(p.health, 100);
    });

    it('starts with 0 armor', () => {
        const p = new Player(1, 1);
        assert.equal(p.armor, 0);
    });

    it('starts alive', () => {
        const p = new Player(1, 1);
        assert.equal(p.alive, true);
    });

    it('starts with only the pistol (weapon 0)', () => {
        const p = new Player(1, 1);
        assert.equal(p.weapons[0], true);
        for (let i = 1; i < 7; i++) {
            assert.equal(p.weapons[i], false, `weapon ${i} should be false`);
        }
    });

    it('starts with current weapon 0', () => {
        const p = new Player(1, 1);
        assert.equal(p.currentWeapon, 0);
    });

    it('starts with infinite bullets and 0 other ammo', () => {
        const p = new Player(1, 1);
        assert.equal(p.ammo.bullets, Infinity);
        assert.equal(p.ammo.shells, 0);
        assert.equal(p.ammo.rockets, 0);
        assert.equal(p.ammo.cells, 0);
    });

    it('starts with an empty keycards set', () => {
        const p = new Player(1, 1);
        assert.equal(p.keycards.size, 0);
    });

    it('starts with 0 pitch', () => {
        const p = new Player(1, 1);
        assert.equal(p.pitch, 0);
    });
});

// =============================================================================
// Player - Exported constants
// =============================================================================

describe('Player - exported constants', () => {
    it('MAX_HEALTH is 200', () => {
        assert.equal(MAX_HEALTH, 200);
    });

    it('MAX_ARMOR is 100', () => {
        assert.equal(MAX_ARMOR, 100);
    });

    it('COLLISION_RADIUS is 0.25', () => {
        assert.equal(COLLISION_RADIUS, 0.25);
    });

    it('MOVE_SPEED is 3.0', () => {
        assert.equal(MOVE_SPEED, 3.0);
    });

    it('MAX_AMMO has correct caps', () => {
        assert.equal(MAX_AMMO.bullets, 200);
        assert.equal(MAX_AMMO.shells, 50);
        assert.equal(MAX_AMMO.rockets, 25);
        assert.equal(MAX_AMMO.cells, 100);
    });
});

// =============================================================================
// Player - takeDamage
// =============================================================================

describe('Player - takeDamage', () => {
    it('reduces health by the damage amount when no armor', () => {
        const p = new Player(1, 1);
        p.takeDamage(30);
        assert.equal(p.health, 70);
    });

    it('armor absorbs 50% of damage', () => {
        const p = new Player(1, 1);
        p.armor = 100;
        p.takeDamage(40);
        // Armor absorbs floor(40 * 0.5) = 20
        // Armor: 100 - 20 = 80, Health: 100 - 20 = 80
        assert.equal(p.armor, 80);
        assert.equal(p.health, 80);
    });

    it('armor absorption is capped by remaining armor', () => {
        const p = new Player(1, 1);
        p.armor = 5;
        p.takeDamage(40);
        // Armor absorbs min(5, floor(40*0.5)) = min(5, 20) = 5
        // Health: 100 - 35 = 65
        assert.equal(p.armor, 0);
        assert.equal(p.health, 65);
    });

    it('player dies when health reaches 0', () => {
        const p = new Player(1, 1);
        const died = p.takeDamage(100);
        assert.equal(died, true);
        assert.equal(p.alive, false);
        assert.equal(p.health, 0);
    });

    it('player dies when damage exceeds remaining health', () => {
        const p = new Player(1, 1);
        const died = p.takeDamage(999);
        assert.equal(died, true);
        assert.equal(p.alive, false);
        assert.equal(p.health, 0);
    });

    it('returns false when player survives', () => {
        const p = new Player(1, 1);
        const died = p.takeDamage(10);
        assert.equal(died, false);
        assert.equal(p.alive, true);
    });

    it('ignores zero or negative damage', () => {
        const p = new Player(1, 1);
        p.takeDamage(0);
        assert.equal(p.health, 100);
        p.takeDamage(-10);
        assert.equal(p.health, 100);
    });

    it('ignores damage when player is already dead', () => {
        const p = new Player(1, 1);
        p.alive = false;
        const died = p.takeDamage(50);
        assert.equal(died, false);
        assert.equal(p.health, 100); // health unchanged
    });
});

// =============================================================================
// Player - heal
// =============================================================================

describe('Player - heal', () => {
    it('restores health by the given amount', () => {
        const p = new Player(1, 1);
        p.health = 50;
        p.heal(25);
        assert.equal(p.health, 75);
    });

    it('caps health at MAX_HEALTH (200)', () => {
        const p = new Player(1, 1);
        p.heal(999);
        assert.equal(p.health, MAX_HEALTH);
    });

    it('does not exceed MAX_HEALTH when healing from partial health', () => {
        const p = new Player(1, 1);
        p.health = 190;
        p.heal(50);
        assert.equal(p.health, MAX_HEALTH);
    });
});

// =============================================================================
// Player - addArmor
// =============================================================================

describe('Player - addArmor', () => {
    it('adds armor', () => {
        const p = new Player(1, 1);
        p.addArmor(50);
        assert.equal(p.armor, 50);
    });

    it('caps armor at MAX_ARMOR (100)', () => {
        const p = new Player(1, 1);
        p.addArmor(999);
        assert.equal(p.armor, MAX_ARMOR);
    });

    it('does not exceed MAX_ARMOR when adding to existing armor', () => {
        const p = new Player(1, 1);
        p.armor = 80;
        p.addArmor(50);
        assert.equal(p.armor, MAX_ARMOR);
    });
});

// =============================================================================
// Player - addAmmo and isAmmoFull
// =============================================================================

describe('Player - addAmmo', () => {
    it('adds shells', () => {
        const p = new Player(1, 1);
        p.addAmmo('shells', 10);
        assert.equal(p.ammo.shells, 10);
    });

    it('caps ammo at the type maximum', () => {
        const p = new Player(1, 1);
        p.addAmmo('shells', 999);
        assert.equal(p.ammo.shells, MAX_AMMO.shells);
    });

    it('does not add to infinite ammo (bullets default)', () => {
        const p = new Player(1, 1);
        p.addAmmo('bullets', 50);
        assert.equal(p.ammo.bullets, Infinity);
    });

    it('ignores unknown ammo types', () => {
        const p = new Player(1, 1);
        p.addAmmo('plasma_goop', 10);
        assert.ok(!('plasma_goop' in p.ammo));
    });

    it('accumulates ammo across multiple calls', () => {
        const p = new Player(1, 1);
        p.addAmmo('rockets', 5);
        p.addAmmo('rockets', 5);
        assert.equal(p.ammo.rockets, 10);
    });
});

describe('Player - isAmmoFull', () => {
    it('returns true when ammo is at max', () => {
        const p = new Player(1, 1);
        p.ammo.shells = MAX_AMMO.shells;
        assert.equal(p.isAmmoFull('shells'), true);
    });

    it('returns false when ammo is below max', () => {
        const p = new Player(1, 1);
        p.ammo.shells = 10;
        assert.equal(p.isAmmoFull('shells'), false);
    });

    it('returns false for infinite ammo (bullets)', () => {
        const p = new Player(1, 1);
        assert.equal(p.isAmmoFull('bullets'), false);
    });
});

// =============================================================================
// Player - Keycards
// =============================================================================

describe('Player - keycards', () => {
    it('player starts without any keycards', () => {
        const p = new Player(1, 1);
        assert.equal(p.hasKeycard('blue'), false);
        assert.equal(p.hasKeycard('red'), false);
        assert.equal(p.hasKeycard('yellow'), false);
    });

    it('addKeycard grants the keycard', () => {
        const p = new Player(1, 1);
        p.addKeycard('blue');
        assert.equal(p.hasKeycard('blue'), true);
    });

    it('can hold multiple keycards', () => {
        const p = new Player(1, 1);
        p.addKeycard('blue');
        p.addKeycard('red');
        assert.equal(p.hasKeycard('blue'), true);
        assert.equal(p.hasKeycard('red'), true);
        assert.equal(p.hasKeycard('yellow'), false);
    });
});

// =============================================================================
// Player - giveWeapon
// =============================================================================

describe('Player - giveWeapon', () => {
    it('gives a weapon by index', () => {
        const p = new Player(1, 1);
        p.giveWeapon(1);
        assert.equal(p.weapons[1], true);
    });

    it('ignores negative indices', () => {
        const p = new Player(1, 1);
        p.giveWeapon(-1);
        // Should not crash, no change
        assert.equal(p.weapons.length, 7);
    });

    it('ignores index >= 7', () => {
        const p = new Player(1, 1);
        p.giveWeapon(7);
        assert.equal(p.weapons.length, 7);
    });
});

// =============================================================================
// Player - reset
// =============================================================================

describe('Player - reset', () => {
    it('restores position to spawn point', () => {
        const p = new Player(5.5, 10.5, Math.PI);
        p.pos.x = 20;
        p.pos.y = 20;
        p.angle = 0;
        p.reset();
        assert.equal(p.pos.x, 5.5);
        assert.equal(p.pos.y, 10.5);
        assert.closeTo(p.angle, Math.PI, 1e-9);
    });

    it('restores health and armor to defaults', () => {
        const p = new Player(1, 1);
        p.health = 10;
        p.armor = 50;
        p.reset();
        assert.equal(p.health, 100);
        assert.equal(p.armor, 0);
    });

    it('restores ammo to defaults', () => {
        const p = new Player(1, 1);
        p.ammo.shells = 50;
        p.ammo.rockets = 25;
        p.reset();
        assert.equal(p.ammo.bullets, Infinity);
        assert.equal(p.ammo.shells, 0);
        assert.equal(p.ammo.rockets, 0);
        assert.equal(p.ammo.cells, 0);
    });

    it('restores weapons to only pistol', () => {
        const p = new Player(1, 1);
        p.giveWeapon(1);
        p.giveWeapon(3);
        p.reset();
        assert.equal(p.weapons[0], true);
        assert.equal(p.weapons[1], false);
        assert.equal(p.weapons[3], false);
    });

    it('clears keycards', () => {
        const p = new Player(1, 1);
        p.addKeycard('blue');
        p.addKeycard('red');
        p.reset();
        assert.equal(p.hasKeycard('blue'), false);
        assert.equal(p.hasKeycard('red'), false);
    });

    it('restores alive to true', () => {
        const p = new Player(1, 1);
        p.alive = false;
        p.reset();
        assert.equal(p.alive, true);
    });

    it('restores pitch to 0', () => {
        const p = new Player(1, 1);
        p.pitch = 50;
        p.reset();
        assert.equal(p.pitch, 0);
    });

    it('restores currentWeapon to 0', () => {
        const p = new Player(1, 1);
        p.currentWeapon = 3;
        p.reset();
        assert.equal(p.currentWeapon, 0);
    });
});

// =============================================================================
// Player - Boundary / edge cases
// =============================================================================

describe('Player - boundary values', () => {
    it('health exactly 0 means dead', () => {
        const p = new Player(1, 1);
        p.health = 1;
        const died = p.takeDamage(1);
        assert.equal(died, true);
        assert.equal(p.health, 0);
        assert.equal(p.alive, false);
    });

    it('health at MAX_HEALTH cannot be healed further', () => {
        const p = new Player(1, 1);
        p.health = MAX_HEALTH;
        p.heal(10);
        assert.equal(p.health, MAX_HEALTH);
    });

    it('armor at MAX_ARMOR cannot be added further', () => {
        const p = new Player(1, 1);
        p.armor = MAX_ARMOR;
        p.addArmor(10);
        assert.equal(p.armor, MAX_ARMOR);
    });
});
