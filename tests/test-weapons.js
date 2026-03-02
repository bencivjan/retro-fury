// =============================================================================
// test-weapons.js - Tests for src/game/weapon.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import { WEAPON_DEFS, WeaponSystem, WeaponState } from '../src/game/weapon.js';

// =============================================================================
// WEAPON_DEFS - Static weapon data
// =============================================================================

describe('WEAPON_DEFS - weapon count', () => {
    it('has exactly 7 weapons defined', () => {
        assert.equal(WEAPON_DEFS.length, 7);
    });
});

describe('WEAPON_DEFS - required properties', () => {
    const requiredProps = ['name', 'damage', 'fireRate', 'ammoType', 'ammoPerShot', 'isProjectile', 'spriteId'];

    for (let i = 0; i < 7; i++) {
        it(`weapon index ${i} has all required properties`, () => {
            const def = WEAPON_DEFS[i];
            assert.ok(def, `WEAPON_DEFS[${i}] should exist`);
            for (const prop of requiredProps) {
                assert.ok(prop in def, `weapon ${i} (${def.name}) missing property "${prop}"`);
            }
        });
    }
});

describe('WEAPON_DEFS - weapon names and order', () => {
    it('index 0 is Pistol', () => {
        assert.equal(WEAPON_DEFS[0].name, 'Pistol');
    });

    it('index 1 is Shotgun', () => {
        assert.equal(WEAPON_DEFS[1].name, 'Shotgun');
    });

    it('index 2 is Machine Gun', () => {
        assert.equal(WEAPON_DEFS[2].name, 'Machine Gun');
    });

    it('index 3 is Rocket Launcher', () => {
        assert.equal(WEAPON_DEFS[3].name, 'Rocket Launcher');
    });

    it('index 4 is Plasma Rifle', () => {
        assert.equal(WEAPON_DEFS[4].name, 'Plasma Rifle');
    });

    it('index 5 is Sniper Rifle', () => {
        assert.equal(WEAPON_DEFS[5].name, 'Sniper Rifle');
    });

    it('index 6 is Knife', () => {
        assert.equal(WEAPON_DEFS[6].name, 'Knife');
    });
});

describe('WEAPON_DEFS - damage values', () => {
    it('Pistol deals 10 damage', () => {
        assert.equal(WEAPON_DEFS[0].damage, 10);
    });

    it('Shotgun deals 8 damage per pellet', () => {
        assert.equal(WEAPON_DEFS[1].damage, 8);
    });

    it('Machine Gun deals 8 damage', () => {
        assert.equal(WEAPON_DEFS[2].damage, 8);
    });

    it('Rocket Launcher deals 80 damage', () => {
        assert.equal(WEAPON_DEFS[3].damage, 80);
    });

    it('Plasma Rifle deals 25 damage', () => {
        assert.equal(WEAPON_DEFS[4].damage, 25);
    });

    it('Sniper Rifle deals 100 damage', () => {
        assert.equal(WEAPON_DEFS[5].damage, 100);
    });

    it('Knife deals 200 damage', () => {
        assert.equal(WEAPON_DEFS[6].damage, 200);
    });
});

describe('WEAPON_DEFS - fire rates', () => {
    it('Pistol fires at 3 shots/sec', () => {
        assert.equal(WEAPON_DEFS[0].fireRate, 3);
    });

    it('Machine Gun fires at 10 shots/sec', () => {
        assert.equal(WEAPON_DEFS[2].fireRate, 10);
    });

    it('Shotgun fires at 1.2 shots/sec', () => {
        assert.equal(WEAPON_DEFS[1].fireRate, 1.2);
    });
});

describe('WEAPON_DEFS - ammo consumption', () => {
    it('Pistol has infinite ammo (ammoPerShot = 0)', () => {
        assert.equal(WEAPON_DEFS[0].ammoPerShot, 0);
    });

    it('Shotgun consumes 1 shell per shot', () => {
        assert.equal(WEAPON_DEFS[1].ammoPerShot, 1);
        assert.equal(WEAPON_DEFS[1].ammoType, 'shells');
    });

    it('Machine Gun consumes 1 bullet per shot', () => {
        assert.equal(WEAPON_DEFS[2].ammoPerShot, 1);
        assert.equal(WEAPON_DEFS[2].ammoType, 'bullets');
    });

    it('Sniper Rifle has infinite ammo (ammoPerShot = 0)', () => {
        assert.equal(WEAPON_DEFS[5].ammoPerShot, 0);
    });

    it('Knife has infinite ammo (ammoPerShot = 0)', () => {
        assert.equal(WEAPON_DEFS[6].ammoPerShot, 0);
    });
});

describe('WEAPON_DEFS - shotgun pellets and spread', () => {
    it('Shotgun fires 5 pellets', () => {
        assert.equal(WEAPON_DEFS[1].pellets, 5);
    });

    it('Shotgun has 0.15 radian spread', () => {
        assert.equal(WEAPON_DEFS[1].spread, 0.15);
    });

    it('Pistol has 0 spread', () => {
        assert.equal(WEAPON_DEFS[0].spread, 0);
    });
});

describe('WEAPON_DEFS - projectile weapons', () => {
    it('Rocket Launcher is a projectile weapon', () => {
        assert.equal(WEAPON_DEFS[3].isProjectile, true);
    });

    it('Plasma Rifle is a projectile weapon', () => {
        assert.equal(WEAPON_DEFS[4].isProjectile, true);
    });

    it('Pistol is not a projectile weapon', () => {
        assert.equal(WEAPON_DEFS[0].isProjectile, false);
    });

    it('Rocket Launcher has splash damage and radius', () => {
        assert.equal(WEAPON_DEFS[3].splashDamage, 40);
        assert.equal(WEAPON_DEFS[3].splashRadius, 2.0);
    });

    it('Rocket Launcher projectile speed is 8', () => {
        assert.equal(WEAPON_DEFS[3].projSpeed, 8);
    });

    it('Plasma Rifle projectile speed is 12', () => {
        assert.equal(WEAPON_DEFS[4].projSpeed, 12);
    });
});

describe('WEAPON_DEFS - Knife melee range', () => {
    it('Knife has a maxRange of 1.2 tiles', () => {
        assert.equal(WEAPON_DEFS[6].maxRange, 1.2);
    });

    it('Pistol has no explicit maxRange (uses default hitscan range)', () => {
        assert.ok(WEAPON_DEFS[0].maxRange === undefined);
    });
});

// =============================================================================
// WeaponSystem - Constructor and initial state
// =============================================================================

describe('WeaponSystem - constructor', () => {
    it('starts with weapon index 0', () => {
        const ws = new WeaponSystem();
        assert.equal(ws.currentWeapon, 0);
    });

    it('starts in IDLE state', () => {
        const ws = new WeaponSystem();
        assert.equal(ws.state, WeaponState.IDLE);
    });

    it('starts with zero fire timer', () => {
        const ws = new WeaponSystem();
        assert.equal(ws.fireTimer, 0);
    });

    it('starts with animation frame 0 (idle)', () => {
        const ws = new WeaponSystem();
        assert.equal(ws.animFrame, 0);
    });
});

// =============================================================================
// WeaponSystem - Weapon switching
// =============================================================================

describe('WeaponSystem - switchWeapon', () => {
    it('switches to a weapon the player has', () => {
        const ws = new WeaponSystem();
        const player = {
            currentWeapon: 0,
            weapons: [true, true, false, false, false, false, false],
        };
        const result = ws.switchWeapon(1, player);
        assert.equal(result, true);
        assert.equal(ws.currentWeapon, 1);
        assert.equal(player.currentWeapon, 1);
    });

    it('refuses to switch to a weapon the player does not have', () => {
        const ws = new WeaponSystem();
        const player = {
            currentWeapon: 0,
            weapons: [true, false, false, false, false, false, false],
        };
        const result = ws.switchWeapon(1, player);
        assert.equal(result, false);
        assert.equal(ws.currentWeapon, 0);
    });

    it('refuses to switch to the same weapon', () => {
        const ws = new WeaponSystem();
        const player = {
            currentWeapon: 0,
            weapons: [true, true, false, false, false, false, false],
        };
        const result = ws.switchWeapon(0, player);
        assert.equal(result, false);
    });

    it('refuses to switch to out-of-range index', () => {
        const ws = new WeaponSystem();
        const player = {
            currentWeapon: 0,
            weapons: [true, true, false, false, false, false, false],
        };
        assert.equal(ws.switchWeapon(-1, player), false);
        assert.equal(ws.switchWeapon(7, player), false);
        assert.equal(ws.switchWeapon(99, player), false);
    });

    it('resets fire state on weapon switch', () => {
        const ws = new WeaponSystem();
        ws.state = WeaponState.FIRING;
        ws.fireTimer = 0.5;
        ws.animFrame = 2;

        const player = {
            currentWeapon: 0,
            weapons: [true, true, false, false, false, false, false],
        };
        ws.switchWeapon(1, player);

        assert.equal(ws.state, WeaponState.IDLE);
        assert.equal(ws.fireTimer, 0);
        assert.equal(ws.animFrame, 0);
    });
});

// =============================================================================
// WeaponSystem - Firing
// =============================================================================

describe('WeaponSystem - fire', () => {
    it('consumes ammo when firing a weapon with ammoPerShot > 0', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 1; // Shotgun
        const player = {
            currentWeapon: 1,
            pos: { x: 5, y: 5 },
            angle: 0,
            alive: true,
            ammo: { bullets: Infinity, shells: 10, rockets: 0, cells: 0 },
            weapons: [true, true, false, false, false, false, false],
        };
        const map = { grid: [[0, 0], [0, 0]], width: 2, height: 2 };

        ws.fire(player, [], map);
        assert.equal(player.ammo.shells, 9);
    });

    it('does not consume ammo for infinite-ammo weapons (ammoPerShot = 0)', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 0; // Pistol
        const player = {
            currentWeapon: 0,
            pos: { x: 5, y: 5 },
            angle: 0,
            alive: true,
            ammo: { bullets: Infinity, shells: 0, rockets: 0, cells: 0 },
            weapons: [true, false, false, false, false, false, false],
        };
        const map = { grid: [[0, 0], [0, 0]], width: 2, height: 2 };

        ws.fire(player, [], map);
        assert.equal(player.ammo.bullets, Infinity);
    });

    it('returns empty flag when not enough ammo', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 1; // Shotgun
        const player = {
            currentWeapon: 1,
            pos: { x: 5, y: 5 },
            angle: 0,
            alive: true,
            ammo: { bullets: Infinity, shells: 0, rockets: 0, cells: 0 },
            weapons: [true, true, false, false, false, false, false],
        };
        const map = { grid: [[0, 0], [0, 0]], width: 2, height: 2 };

        const result = ws.fire(player, [], map);
        assert.ok(result.empty);
    });

    it('sets weapon state to FIRING after a successful shot', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 0; // Pistol
        const player = {
            currentWeapon: 0,
            pos: { x: 5, y: 5 },
            angle: 0,
            alive: true,
            ammo: { bullets: Infinity, shells: 0, rockets: 0, cells: 0 },
            weapons: [true, false, false, false, false, false, false],
        };
        const map = { grid: [[0, 0], [0, 0]], width: 2, height: 2 };

        ws.fire(player, [], map);
        assert.equal(ws.state, WeaponState.FIRING);
    });

    it('sets fire timer based on weapon fire rate', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 0; // Pistol, fireRate = 3
        const player = {
            currentWeapon: 0,
            pos: { x: 5, y: 5 },
            angle: 0,
            alive: true,
            ammo: { bullets: Infinity, shells: 0, rockets: 0, cells: 0 },
            weapons: [true, false, false, false, false, false, false],
        };
        const map = { grid: [[0, 0], [0, 0]], width: 2, height: 2 };

        ws.fire(player, [], map);
        assert.closeTo(ws.fireTimer, 1.0 / 3.0, 1e-9);
    });

    it('returns a projectile object for projectile weapons', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 3; // Rocket Launcher
        const player = {
            currentWeapon: 3,
            pos: { x: 5, y: 5 },
            angle: 0,
            alive: true,
            ammo: { bullets: Infinity, shells: 0, rockets: 10, cells: 0 },
            weapons: [true, false, false, true, false, false, false],
        };
        const map = { grid: [[0, 0], [0, 0]], width: 2, height: 2 };

        const result = ws.fire(player, [], map);
        assert.ok(result.projectile, 'should return a projectile object');
        assert.equal(result.projectile.damage, 80);
        assert.equal(result.projectile.speed, 8);
        assert.equal(result.projectile.splashDamage, 40);
        assert.equal(result.projectile.splashRadius, 2.0);
        assert.equal(result.projectile.owner, 'player');
    });

    it('returns hitscan result for non-projectile weapons', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 0; // Pistol
        const player = {
            currentWeapon: 0,
            pos: { x: 5, y: 5 },
            angle: 0,
            alive: true,
            ammo: { bullets: Infinity, shells: 0, rockets: 0, cells: 0 },
            weapons: [true, false, false, false, false, false, false],
        };
        // 10x10 open map
        const grid = [];
        for (let r = 0; r < 10; r++) {
            grid.push(new Array(10).fill(0));
        }
        const map = { grid, width: 10, height: 10 };

        const result = ws.fire(player, [], map);
        assert.ok('hit' in result, 'hitscan result should have hit property');
        assert.ok('enemies' in result, 'hitscan result should have enemies array');
    });
});

// =============================================================================
// WeaponSystem - getCurrentDef and getAnimFrame
// =============================================================================

describe('WeaponSystem - getCurrentDef', () => {
    it('returns the definition for the current weapon', () => {
        const ws = new WeaponSystem();
        ws.currentWeapon = 3;
        const def = ws.getCurrentDef();
        assert.equal(def.name, 'Rocket Launcher');
    });
});

describe('WeaponSystem - getAnimFrame', () => {
    it('returns the current animation frame', () => {
        const ws = new WeaponSystem();
        assert.equal(ws.getAnimFrame(), 0);
        ws.animFrame = 2;
        assert.equal(ws.getAnimFrame(), 2);
    });
});

// =============================================================================
// WeaponSystem - getBobOffset
// =============================================================================

describe('WeaponSystem - getBobOffset', () => {
    it('returns zero offset when not moving and phase is 0', () => {
        const ws = new WeaponSystem();
        const offset = ws.getBobOffset(false, 0.016);
        // sin(0) = 0, |cos(0)| * amplitude = amplitude
        assert.closeTo(offset.x, 0, 0.01);
    });

    it('accumulates bob phase when moving', () => {
        const ws = new WeaponSystem();
        ws.getBobOffset(true, 0.1);
        assert.ok(ws.bobPhase > 0, 'bob phase should increase when moving');
    });

    it('resets bob phase to 0 when stationary', () => {
        const ws = new WeaponSystem();
        ws.bobPhase = 5.0;
        ws.getBobOffset(false, 0.016);
        assert.equal(ws.bobPhase, 0);
    });
});

// =============================================================================
// WeaponState enum
// =============================================================================

describe('WeaponState enum', () => {
    it('has IDLE, FIRING, and COOLDOWN states', () => {
        assert.equal(WeaponState.IDLE, 0);
        assert.equal(WeaponState.FIRING, 1);
        assert.equal(WeaponState.COOLDOWN, 2);
    });

    it('is frozen (immutable)', () => {
        assert.ok(Object.isFrozen(WeaponState));
    });
});
