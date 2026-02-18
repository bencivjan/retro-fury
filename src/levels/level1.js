// =============================================================================
// level1.js - "Infiltration" (Military Base) for RETRO FURY
// =============================================================================
// A 32x32 tile map representing a military base perimeter. The player starts
// outside the south wall and must find the blue keycard in an east-wing office,
// then reach the elevator (blue-locked door) at the north end.
//
// Theme: olive green walls (texture 1=brick, 6=crate for variety)
// Enemies: 8-10 Grunts at key intersections and near the keycard
// Items: Shotgun in a guard room, health kits near combat, shell ammo
// Objective: reach_exit (requires blue keycard via elevator)
// Par time: 180 seconds
// =============================================================================

// Legend:
//   0 = empty / walkable
//   1 = brick wall (primary military base wall)
//   2 = concrete wall
//   6 = crate / storage wall
//   9 = unlocked door
//  10 = blue-locked door (elevator)

const level1 = {
    name: 'Infiltration',

    briefing:
        'MISSION 1: INFILTRATION\n\n' +
        'INFILTRATE THE MILITARY BASE PERIMETER.\n' +
        'FIND THE BLUE KEYCARD IN THE EAST WING.\n' +
        'REACH THE ELEVATOR TO PROCEED.\n\n' +
        'EXPECT LIGHT RESISTANCE - GRUNTS ONLY.',

    // 32x32 tile map - row 0 is north (top), row 31 is south (bottom).
    // Player starts near the south entrance and works northward.
    map: [
        // Row 0  (north wall)
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        // Row 1
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,10,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
        // Row 2  - elevator room (north)
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
        // Row 3
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,6,6,0,0,6,6,0,0,1],
        // Row 4
        [1,0,0,0,0,0,9,0,0,0,0,0,0,0,9,0,0,0,0,0,9,0,0,6,0,0,0,0,6,0,0,1],
        // Row 5
        [1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,9,1,1,1,0,0,0,0,0,0,0,0,0,0,1],
        // Row 6  - north corridor
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 7
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 8
        [1,0,0,1,1,1,1,1,9,1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,1,9,1,1,0,0,1],
        // Row 9  - rooms north
        [1,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,1],
        // Row 10
        [1,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,1],
        // Row 11
        [1,0,0,1,0,0,6,0,6,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,6,0,0,1,0,0,1],
        // Row 12
        [1,0,0,1,0,0,0,0,0,0,0,1,0,0,9,0,0,0,0,9,0,0,1,0,0,0,0,0,1,0,0,1],
        // Row 13
        [1,0,0,1,1,1,1,9,1,1,1,1,0,0,1,0,0,0,0,1,0,0,1,1,1,9,1,1,1,0,0,1],
        // Row 14  - central east-west corridor
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 15
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,9,1,1,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 16
        [1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1],
        // Row 17  - south section - west side rooms and east wing
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
        // Row 18
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
        // Row 19
        [1,0,6,6,0,0,1,0,0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0,9,0,0,0,0,0,0,1],
        // Row 20  - guard room (west), east wing office with keycard
        [1,0,0,0,0,0,9,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1,0,0,0,0,0,0,1],
        // Row 21
        [1,0,0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1,0,6,0,6,0,0,1],
        // Row 22
        [1,0,0,0,0,0,1,0,0,1,0,0,0,9,0,0,0,0,9,0,0,0,1,0,1,0,0,0,0,0,0,1],
        // Row 23
        [1,1,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0,1,1,1,9,1,1,1,1],
        // Row 24  - south open area
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
        // Row 25
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
        // Row 26
        [1,0,0,6,0,0,0,0,0,6,0,0,0,6,0,0,0,0,6,0,0,0,0,0,1,0,0,0,0,0,0,1],
        // Row 27
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],
        // Row 28
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 29
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 30  - spawn corridor
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 31  (south wall with entrance gap)
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],

    // Player starts just inside the south entrance, facing north.
    playerStart: { x: 16.5, y: 30.5, angle: -Math.PI / 2 },

    // 10 Grunts placed at key locations.
    enemies: [
        // South yard - light patrol
        { type: 'grunt', x: 10.5, y: 26.5 },
        { type: 'grunt', x: 20.5, y: 25.5 },
        // Guard room entrance (west)
        { type: 'grunt', x: 3.5,  y: 18.5 },
        // Central corridor
        { type: 'grunt', x: 8.5,  y: 14.5 },
        { type: 'grunt', x: 15.5, y: 17.5 },
        // East wing office (guarding keycard area)
        { type: 'grunt', x: 27.5, y: 20.5 },
        { type: 'grunt', x: 28.5, y: 25.5 },
        // North section
        { type: 'grunt', x: 7.5,  y: 7.5 },
        { type: 'grunt', x: 16.5, y: 6.5 },
        // Near the elevator
        { type: 'grunt', x: 17.5, y: 2.5 },
    ],

    // Items: Shotgun reward, health kits, ammo.
    items: [
        // Shotgun in the west guard room (reward for exploring)
        { type: 'WEAPON_SHOTGUN', x: 3.5, y: 20.5 },
        // Health packs near combat areas
        { type: 'HEALTH_SMALL',   x: 8.5, y: 26.5 },
        { type: 'HEALTH_LARGE',   x: 1.5, y: 14.5 },
        { type: 'HEALTH_SMALL',   x: 22.5, y: 17.5 },
        { type: 'HEALTH_SMALL',   x: 16.5, y: 10.5 },
        // Shell ammo near the shotgun and in the east wing
        { type: 'AMMO_SHELLS',    x: 4.5, y: 21.5 },
        { type: 'AMMO_SHELLS',    x: 25.5, y: 14.5 },
        { type: 'AMMO_SHELLS',    x: 12.5, y: 7.5 },
        // Bullet ammo scattered
        { type: 'AMMO_BULLETS',   x: 5.5, y: 10.5 },
        { type: 'AMMO_BULLETS',   x: 20.5, y: 6.5 },
        // Blue keycard in the east wing office
        { type: 'KEYCARD_BLUE',   x: 27.5, y: 24.5 },
        // Health near elevator for the push
        { type: 'HEALTH_LARGE',   x: 8.5, y: 2.5 },
        // Armor in the storage room (north east)
        { type: 'ARMOR',          x: 25.5, y: 4.5 },
    ],

    // Single objective: reach the elevator exit.
    objectives: [
        {
            type: 'reach_exit',
            x: 17.5,
            y: 1.5,
            description: 'FIND THE BLUE KEYCARD AND REACH THE ELEVATOR',
        },
    ],

    // Exit trigger at the elevator (row 1, col 17) - behind the blue door.
    exitTrigger: { x: 17.5, y: 1.5, requiredObjectives: 0 },

    palette: {
        ceiling: '#2a3a2a',
        floor:   '#3a4a3a',
        fog:     '#1a2a1a',
    },

    parTime: 180,

    hints: [
        {
            trigger: 'time',
            delay: 60,
            text: 'CHECK THE OFFICE IN THE EAST WING FOR THE KEYCARD',
        },
        {
            trigger: 'time',
            delay: 120,
            text: 'THE ELEVATOR IS AT THE NORTH END OF THE BASE',
        },
    ],
};

export default level1;
