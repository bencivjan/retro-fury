// =============================================================================
// level2.js - "Lockdown" (Research Lab) for RETRO FURY
// =============================================================================
// A 40x40 tile map representing an underground research lab. The elevator
// opens to a central hub area with three wings branching off (west, north,
// east). Each wing contains a data drive to collect. The player must retrieve
// all three and bring them to the exit terminal.
//
// Theme: lab tiles (texture 3), tech panels (texture 5)
// Enemies: 12-15 (Grunts + Soldiers)
// Items: Machine Gun in first wing, ammo/health throughout
// Objectives: 3 collect objectives (data drives)
// Par time: 240 seconds
// =============================================================================

// Legend:
//   0 = empty / walkable
//   3 = lab tile wall (white/teal)
//   5 = tech panel wall (blue/silver)
//   6 = crate
//   9 = unlocked door

const level2 = {
    name: 'Lockdown',

    briefing:
        'MISSION 2: LOCKDOWN\n\n' +
        'THE UNDERGROUND LAB IS IN LOCKDOWN.\n' +
        'COLLECT 3 DATA DRIVES FROM THE LAB WINGS.\n' +
        'BRING THEM TO THE EXIT TERMINAL.\n\n' +
        'NEW THREAT: SOLDIERS - THEY STRAFE AND USE COVER.',

    // 40x40 tile map.
    map: [
        // Row 0  (north wall)
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 1  - north wing top
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,0,0,0,0,0,0,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 2
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 3
        [3,0,0,5,5,0,0,5,5,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,5,5,0,0,5,5,0,0,3],
        // Row 4
        [3,0,0,5,0,0,0,0,5,0,0,0,0,3,0,0,5,0,0,0,0,0,0,5,0,0,3,0,0,0,0,5,0,0,0,0,5,0,0,3],
        // Row 5  - north wing server rooms
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 6
        [3,0,0,5,0,0,0,0,5,0,0,0,0,3,0,0,0,0,5,5,5,5,0,0,0,0,3,0,0,0,0,5,0,0,0,0,5,0,0,3],
        // Row 7
        [3,0,0,5,5,0,0,5,5,0,0,0,0,3,0,0,0,0,5,0,0,5,0,0,0,0,3,0,0,0,0,5,5,0,0,5,5,0,0,3],
        // Row 8
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,5,0,0,5,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 9
        [3,0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 10
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 11  - north wing corridor to hub
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 12
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 13
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,9,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 14  - west wing and east wing connected to hub
        [3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 15
        [3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 16
        [3,0,0,5,0,0,5,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,5,0,0,5,0,0,3],
        // Row 17  - west lab areas          hub center            east lab areas
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 18
        [3,0,0,5,0,0,5,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,0,0,0,5,0,0,5,0,0,3],
        // Row 19
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,6,0,0,0,0,6,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 20  - hub center
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 21
        [3,0,0,5,0,0,5,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,5,0,0,5,0,0,3],
        // Row 22
        [3,0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 23
        [3,0,0,5,0,0,5,0,0,0,0,0,0,3,0,0,0,6,0,0,0,0,6,0,0,0,3,0,0,0,0,0,0,5,0,0,5,0,0,3],
        // Row 24
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 25
        [3,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,9,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,3],
        // Row 26
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 27  - south corridor to exit
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 28
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 29
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 30
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 31  - elevator arrival area / start
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 32
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 33
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,0,0,0,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 34  - exit terminal area
        [3,3,3,3,3,3,3,3,3,3,3,3,3,5,0,0,0,0,0,0,0,0,0,0,0,5,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 35
        [3,3,3,3,3,3,3,3,3,3,3,3,3,5,0,0,0,0,0,0,0,0,0,0,0,5,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 36
        [3,3,3,3,3,3,3,3,3,3,3,3,3,5,0,0,0,0,0,0,0,0,0,0,0,5,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 37
        [3,3,3,3,3,3,3,3,3,3,3,3,3,5,0,0,0,0,0,0,0,0,0,0,0,5,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 38
        [3,3,3,3,3,3,3,3,3,3,3,3,3,5,5,5,5,5,5,5,5,5,5,5,5,5,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
        // Row 39  (south wall)
        [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    ],

    // Player starts in the south elevator arrival area, facing north.
    playerStart: { x: 19.5, y: 36.5, angle: -Math.PI / 2 },

    // 14 enemies: Grunts and Soldiers.
    enemies: [
        // Start corridor
        { type: 'grunt',   x: 19.5, y: 30.5 },
        // Hub area - soldiers in strategic positions
        { type: 'soldier', x: 17.5, y: 20.5 },
        { type: 'soldier', x: 22.5, y: 20.5 },
        { type: 'grunt',   x: 19.5, y: 15.5 },
        // West wing
        { type: 'grunt',   x: 6.5,  y: 14.5 },
        { type: 'soldier', x: 4.5,  y: 18.5 },
        { type: 'grunt',   x: 8.5,  y: 22.5 },
        { type: 'grunt',   x: 5.5,  y: 24.5 },
        // East wing
        { type: 'soldier', x: 35.5, y: 14.5 },
        { type: 'grunt',   x: 34.5, y: 18.5 },
        { type: 'grunt',   x: 37.5, y: 22.5 },
        // North wing
        { type: 'soldier', x: 19.5, y: 7.5 },
        { type: 'grunt',   x: 5.5,  y: 5.5 },
        { type: 'grunt',   x: 35.5, y: 5.5 },
    ],

    // Items spread across the three wings.
    items: [
        // Machine Gun in the west wing (first wing most players explore)
        { type: 'WEAPON_MACHINEGUN', x: 2.5,  y: 16.5 },
        // Data drives (objective items) - one in each wing
        { type: 'OBJECTIVE_ITEM', x: 6.5,  y: 24.5 },   // West wing data drive
        { type: 'OBJECTIVE_ITEM', x: 19.5, y: 2.5 },    // North wing data drive (server room)
        { type: 'OBJECTIVE_ITEM', x: 35.5, y: 24.5 },   // East wing data drive
        // Health kits near combat areas
        { type: 'HEALTH_LARGE', x: 19.5, y: 19.5 },  // Hub center
        { type: 'HEALTH_SMALL', x: 10.5, y: 14.5 },  // West corridor
        { type: 'HEALTH_SMALL', x: 30.5, y: 14.5 },  // East corridor
        { type: 'HEALTH_SMALL', x: 19.5, y: 11.5 },  // North corridor
        { type: 'HEALTH_LARGE', x: 2.5,  y: 2.5 },   // NW server room (exploration reward)
        { type: 'HEALTH_LARGE', x: 37.5, y: 2.5 },   // NE server room (exploration reward)
        // Ammo
        { type: 'AMMO_BULLETS', x: 8.5,  y: 17.5 },
        { type: 'AMMO_BULLETS', x: 33.5, y: 17.5 },
        { type: 'AMMO_BULLETS', x: 19.5, y: 5.5 },
        { type: 'AMMO_SHELLS',  x: 5.5,  y: 20.5 },
        { type: 'AMMO_SHELLS',  x: 36.5, y: 20.5 },
        // Armor in a strategic location
        { type: 'ARMOR', x: 19.5, y: 24.5 },
    ],

    // Three collection objectives.
    objectives: [
        {
            type: 'collect',
            x: 6.5,
            y: 24.5,
            description: 'COLLECT DATA DRIVE - WEST LAB',
        },
        {
            type: 'collect',
            x: 19.5,
            y: 2.5,
            description: 'COLLECT DATA DRIVE - NORTH SERVER ROOM',
        },
        {
            type: 'collect',
            x: 35.5,
            y: 24.5,
            description: 'COLLECT DATA DRIVE - EAST LAB',
        },
    ],

    // Exit terminal at the south end.
    exitTrigger: { x: 19.5, y: 35.5, requiredObjectives: 3 },

    palette: {
        ceiling: '#1a2a2a',
        floor:   '#2a3a3a',
        fog:     '#0a1a1a',
    },

    parTime: 240,

    hints: [
        {
            trigger: 'time',
            delay: 45,
            text: 'DATA DRIVES ARE IN THE WEST, NORTH, AND EAST WINGS',
        },
        {
            trigger: 'time',
            delay: 120,
            text: 'RETURN TO THE SOUTH EXIT ONCE YOU HAVE ALL 3 DRIVES',
        },
    ],
};

export default level2;
