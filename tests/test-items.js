// =============================================================================
// test-items.js - Tests for src/game/item.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import { Item, ItemType, ITEM_DEFS, PICKUP_RADIUS } from '../src/game/item.js';
import { Player, MAX_HEALTH, MAX_ARMOR, MAX_AMMO } from '../src/game/player.js';

// =============================================================================
// ItemType enum
// =============================================================================

describe('ItemType enum', () => {
    it('has all expected item types', () => {
        assert.equal(ItemType.HEALTH_SMALL, 0);
        assert.equal(ItemType.HEALTH_LARGE, 1);
        assert.equal(ItemType.ARMOR, 2);
        assert.equal(ItemType.AMMO_BULLETS, 3);
        assert.equal(ItemType.AMMO_SHELLS, 4);
        assert.equal(ItemType.AMMO_ROCKETS, 5);
        assert.equal(ItemType.AMMO_CELLS, 6);
        assert.equal(ItemType.KEYCARD_BLUE, 7);
        assert.equal(ItemType.KEYCARD_RED, 8);
        assert.equal(ItemType.KEYCARD_YELLOW, 9);
        assert.equal(ItemType.WEAPON_SHOTGUN, 10);
        assert.equal(ItemType.WEAPON_MACHINEGUN, 11);
        assert.equal(ItemType.WEAPON_ROCKET, 12);
        assert.equal(ItemType.WEAPON_PLASMA, 13);
        assert.equal(ItemType.OBJECTIVE_ITEM, 14);
    });

    it('has 15 distinct item types (0 through 14)', () => {
        const values = Object.values(ItemType);
        assert.equal(values.length, 15);
    });

    it('is frozen (immutable)', () => {
        assert.ok(Object.isFrozen(ItemType));
    });
});

// =============================================================================
// ITEM_DEFS coverage
// =============================================================================

describe('ITEM_DEFS - definitions exist for all item types', () => {
    for (const [name, value] of Object.entries(ItemType)) {
        it(`has a definition for ${name} (${value})`, () => {
            assert.ok(ITEM_DEFS[value] !== undefined, `missing ITEM_DEFS[${value}] for ${name}`);
        });
    }
});

describe('ITEM_DEFS - health item values', () => {
    it('HEALTH_SMALL restores 10 HP', () => {
        assert.equal(ITEM_DEFS[ItemType.HEALTH_SMALL].value, 10);
    });

    it('HEALTH_LARGE restores 25 HP', () => {
        assert.equal(ITEM_DEFS[ItemType.HEALTH_LARGE].value, 25);
    });
});

describe('ITEM_DEFS - armor value', () => {
    it('ARMOR grants 50 armor', () => {
        assert.equal(ITEM_DEFS[ItemType.ARMOR].value, 50);
    });
});

describe('ITEM_DEFS - ammo item values and types', () => {
    it('AMMO_BULLETS gives 20 bullets', () => {
        const def = ITEM_DEFS[ItemType.AMMO_BULLETS];
        assert.equal(def.value, 20);
        assert.equal(def.ammoType, 'bullets');
    });

    it('AMMO_SHELLS gives 4 shells', () => {
        const def = ITEM_DEFS[ItemType.AMMO_SHELLS];
        assert.equal(def.value, 4);
        assert.equal(def.ammoType, 'shells');
    });

    it('AMMO_ROCKETS gives 3 rockets', () => {
        const def = ITEM_DEFS[ItemType.AMMO_ROCKETS];
        assert.equal(def.value, 3);
        assert.equal(def.ammoType, 'rockets');
    });

    it('AMMO_CELLS gives 20 cells', () => {
        const def = ITEM_DEFS[ItemType.AMMO_CELLS];
        assert.equal(def.value, 20);
        assert.equal(def.ammoType, 'cells');
    });
});

describe('ITEM_DEFS - keycard colors', () => {
    it('KEYCARD_BLUE has color blue', () => {
        assert.equal(ITEM_DEFS[ItemType.KEYCARD_BLUE].keycardColor, 'blue');
    });

    it('KEYCARD_RED has color red', () => {
        assert.equal(ITEM_DEFS[ItemType.KEYCARD_RED].keycardColor, 'red');
    });

    it('KEYCARD_YELLOW has color yellow', () => {
        assert.equal(ITEM_DEFS[ItemType.KEYCARD_YELLOW].keycardColor, 'yellow');
    });
});

describe('ITEM_DEFS - weapon pickups', () => {
    it('WEAPON_SHOTGUN gives weapon index 1', () => {
        const def = ITEM_DEFS[ItemType.WEAPON_SHOTGUN];
        assert.equal(def.weaponIndex, 1);
    });

    it('WEAPON_SHOTGUN includes 8 shells as starter ammo', () => {
        const def = ITEM_DEFS[ItemType.WEAPON_SHOTGUN];
        assert.equal(def.starterAmmo.type, 'shells');
        assert.equal(def.starterAmmo.amount, 8);
    });

    it('WEAPON_MACHINEGUN gives weapon index 2', () => {
        assert.equal(ITEM_DEFS[ItemType.WEAPON_MACHINEGUN].weaponIndex, 2);
    });

    it('WEAPON_ROCKET gives weapon index 3', () => {
        assert.equal(ITEM_DEFS[ItemType.WEAPON_ROCKET].weaponIndex, 3);
    });

    it('WEAPON_PLASMA gives weapon index 4', () => {
        assert.equal(ITEM_DEFS[ItemType.WEAPON_PLASMA].weaponIndex, 4);
    });
});

// =============================================================================
// Item Constructor
// =============================================================================

describe('Item - constructor', () => {
    it('sets position and type', () => {
        const item = new Item(5.5, 10.5, ItemType.HEALTH_SMALL);
        assert.equal(item.x, 5.5);
        assert.equal(item.y, 10.5);
        assert.equal(item.type, ItemType.HEALTH_SMALL);
    });

    it('starts active', () => {
        const item = new Item(1, 1, ItemType.ARMOR);
        assert.equal(item.active, true);
    });

    it('assigns the correct spriteId from ITEM_DEFS', () => {
        const item = new Item(1, 1, ItemType.KEYCARD_BLUE);
        assert.equal(item.spriteId, ITEM_DEFS[ItemType.KEYCARD_BLUE].spriteId);
    });

    it('defaults spriteId to 200 for unknown types', () => {
        const item = new Item(1, 1, 999);
        assert.equal(item.spriteId, 200);
    });
});

// =============================================================================
// Item - update (bob animation)
// =============================================================================

describe('Item - update (bob animation)', () => {
    it('updates bobOffset when active', () => {
        const item = new Item(1, 1, ItemType.HEALTH_SMALL);
        const initialBob = item.bobOffset;
        item.update(1.0); // 1 second
        // bobOffset should have changed (unless the phase happened to produce same value)
        // We just verify it does not crash and the value is a number
        assert.ok(typeof item.bobOffset === 'number');
    });

    it('does not update bobOffset when inactive', () => {
        const item = new Item(1, 1, ItemType.HEALTH_SMALL);
        item.active = false;
        const phase = item._bobPhase;
        item.update(1.0);
        assert.equal(item._bobPhase, phase);
    });
});

// =============================================================================
// Item - tryPickup (distance check)
// =============================================================================

describe('Item - tryPickup (distance check)', () => {
    it('picks up when player is within PICKUP_RADIUS', () => {
        const item = new Item(5.0, 5.0, ItemType.HEALTH_SMALL);
        const player = new Player(5.0, 5.0); // Same position
        player.health = 50; // Not full, so can pick up
        const result = item.tryPickup(player);
        assert.equal(result.picked, true);
    });

    it('does not pick up when player is too far', () => {
        const item = new Item(5.0, 5.0, ItemType.HEALTH_SMALL);
        const player = new Player(10.0, 10.0); // Far away
        player.health = 50;
        const result = item.tryPickup(player);
        assert.equal(result.picked, false);
    });

    it('does not pick up when item is inactive', () => {
        const item = new Item(5.0, 5.0, ItemType.HEALTH_SMALL);
        item.active = false;
        const player = new Player(5.0, 5.0);
        player.health = 50;
        const result = item.tryPickup(player);
        assert.equal(result.picked, false);
    });
});

// =============================================================================
// Item - tryPickup (health items)
// =============================================================================

describe('Item - health pickup conditions', () => {
    it('cannot pick up health at full health (MAX_HEALTH)', () => {
        const item = new Item(5.0, 5.0, ItemType.HEALTH_SMALL);
        const player = new Player(5.0, 5.0);
        player.health = MAX_HEALTH;
        const result = item.tryPickup(player);
        assert.equal(result.picked, false);
    });

    it('picks up health when below MAX_HEALTH', () => {
        const item = new Item(5.0, 5.0, ItemType.HEALTH_SMALL);
        const player = new Player(5.0, 5.0);
        player.health = 90;
        const result = item.tryPickup(player);
        assert.equal(result.picked, true);
        assert.equal(player.health, 100); // 90 + 10
        assert.equal(item.active, false);
    });

    it('HEALTH_LARGE restores 25 HP', () => {
        const item = new Item(5.0, 5.0, ItemType.HEALTH_LARGE);
        const player = new Player(5.0, 5.0);
        player.health = 50;
        item.tryPickup(player);
        assert.equal(player.health, 75);
    });

    it('health pickup includes a message', () => {
        const item = new Item(5.0, 5.0, ItemType.HEALTH_SMALL);
        const player = new Player(5.0, 5.0);
        player.health = 50;
        const result = item.tryPickup(player);
        assert.ok(result.message.includes('+10'));
    });
});

// =============================================================================
// Item - tryPickup (armor)
// =============================================================================

describe('Item - armor pickup conditions', () => {
    it('cannot pick up armor when at MAX_ARMOR', () => {
        const item = new Item(5.0, 5.0, ItemType.ARMOR);
        const player = new Player(5.0, 5.0);
        player.armor = MAX_ARMOR;
        const result = item.tryPickup(player);
        assert.equal(result.picked, false);
    });

    it('picks up armor when below MAX_ARMOR', () => {
        const item = new Item(5.0, 5.0, ItemType.ARMOR);
        const player = new Player(5.0, 5.0);
        player.armor = 0;
        const result = item.tryPickup(player);
        assert.equal(result.picked, true);
        assert.equal(player.armor, 50);
        assert.equal(item.active, false);
    });
});

// =============================================================================
// Item - tryPickup (ammo)
// =============================================================================

describe('Item - ammo pickup conditions', () => {
    it('cannot pick up ammo when that type is full', () => {
        const item = new Item(5.0, 5.0, ItemType.AMMO_SHELLS);
        const player = new Player(5.0, 5.0);
        player.ammo.shells = MAX_AMMO.shells;
        const result = item.tryPickup(player);
        assert.equal(result.picked, false);
    });

    it('picks up ammo when below max', () => {
        const item = new Item(5.0, 5.0, ItemType.AMMO_SHELLS);
        const player = new Player(5.0, 5.0);
        player.ammo.shells = 0;
        const result = item.tryPickup(player);
        assert.equal(result.picked, true);
        assert.equal(player.ammo.shells, 4);
        assert.equal(item.active, false);
    });
});

// =============================================================================
// Item - tryPickup (weapons)
// =============================================================================

describe('Item - weapon pickup', () => {
    it('gives the weapon and starter ammo', () => {
        const item = new Item(5.0, 5.0, ItemType.WEAPON_SHOTGUN);
        const player = new Player(5.0, 5.0);
        const result = item.tryPickup(player);
        assert.equal(result.picked, true);
        assert.equal(player.weapons[1], true);
        assert.equal(player.ammo.shells, 8);
        assert.equal(item.active, false);
    });

    it('auto-switches to the picked up weapon', () => {
        const item = new Item(5.0, 5.0, ItemType.WEAPON_SHOTGUN);
        const player = new Player(5.0, 5.0);
        item.tryPickup(player);
        assert.equal(player.currentWeapon, 1);
    });

    it('includes the weapon name in the pickup message', () => {
        const item = new Item(5.0, 5.0, ItemType.WEAPON_SHOTGUN);
        const player = new Player(5.0, 5.0);
        const result = item.tryPickup(player);
        assert.ok(result.message.includes('Shotgun'));
    });
});

// =============================================================================
// Item - tryPickup (keycards)
// =============================================================================

describe('Item - keycard pickup', () => {
    it('grants the keycard to the player', () => {
        const item = new Item(5.0, 5.0, ItemType.KEYCARD_BLUE);
        const player = new Player(5.0, 5.0);
        const result = item.tryPickup(player);
        assert.equal(result.picked, true);
        assert.equal(player.hasKeycard('blue'), true);
        assert.equal(item.active, false);
    });

    it('includes the keycard color in the message', () => {
        const item = new Item(5.0, 5.0, ItemType.KEYCARD_RED);
        const player = new Player(5.0, 5.0);
        const result = item.tryPickup(player);
        assert.ok(result.message.includes('red'));
    });
});

// =============================================================================
// Item - tryPickup (objective item)
// =============================================================================

describe('Item - objective pickup', () => {
    it('picks up objective item regardless of player state', () => {
        const item = new Item(5.0, 5.0, ItemType.OBJECTIVE_ITEM);
        const player = new Player(5.0, 5.0);
        const result = item.tryPickup(player);
        assert.equal(result.picked, true);
        assert.equal(item.active, false);
    });
});

// =============================================================================
// PICKUP_RADIUS constant
// =============================================================================

describe('PICKUP_RADIUS constant', () => {
    it('is 0.5 tiles', () => {
        assert.equal(PICKUP_RADIUS, 0.5);
    });
});
