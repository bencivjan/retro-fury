// =============================================================================
// level3.js - "Rescue Op" (Prison Block) for RETRO FURY
// =============================================================================
// A 40x40 tile map representing a prison facility. The player progresses
// linearly through 4 cell blocks (A, B, C, D), each containing a prisoner
// to rescue. Enemies guard each block more heavily than the last. Scouts are
// introduced here -- they rush from dark corridors.
//
// Theme: prison metal (texture 4), brick (texture 1) for cell walls
// Enemies: 15-18 (Grunts + Soldiers + Scouts)
// Items: Rocket Launcher in a secret alcove, health/ammo
// Objectives: 4 rescue objectives (prisoners in cells)
// Par time: 300 seconds
// =============================================================================

// Legend:
//   0 = empty / walkable
//   1 = brick wall (cell walls)
//   4 = prison metal wall (corridors, structural)
//   6 = crate
//   9 = unlocked door

const level3 = {
    name: 'Rescue Op',

    briefing:
        'MISSION 3: RESCUE OP\n\n' +
        'PRISONERS ARE HELD IN 4 CELL BLOCKS.\n' +
        'FIGHT THROUGH AND FREE THEM ALL.\n' +
        'GET EVERYONE OUT ALIVE.\n\n' +
        'WARNING: SCOUTS DETECTED - FAST AND AGGRESSIVE.',

    // 40x40 tile map. Linear progression south to north through 4 blocks.
    map: [
        // Row 0  (north wall - exit)
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 1  - exit room
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 2
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 3
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 4  - BLOCK D corridor (north-most)
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 5
        [4,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,0,0,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,4],
        // Row 6  - cells D
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 7
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,6,0,0,0,6,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 8
        [4,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,4],
        // Row 9
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 10
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 11  - connector corridor D->C
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 12
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 13  - BLOCK C
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 14
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 15
        [4,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,0,0,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,4],
        // Row 16  - cells C
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 17
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,6,0,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 18
        [4,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,4],
        // Row 19
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 20
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 21  - connector corridor C->B
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 22
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 23  - BLOCK B
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 24
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 25
        [4,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,0,0,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,4],
        // Row 26  - cells B
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 27
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,6,0,6,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 28
        [4,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,4],
        // Row 29
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 30
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 31  - connector B->A
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 32
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
        // Row 33  - BLOCK A (first block, easiest)
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 34
        [4,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,0,0,0,0,1,1,9,1,1,0,0,1,1,9,1,1,0,0,0,0,4],
        // Row 35  - cells A
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 36
        [4,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,0,0,4],
        // Row 37
        [4,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,4],
        // Row 38  - entrance area
        [4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4],
        // Row 39  (south wall with entrance)
        [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
    ],

    // Player starts at the south entrance, facing north.
    playerStart: { x: 18.5, y: 38.5, angle: -Math.PI / 2 },

    // 17 enemies: Grunts, Soldiers, and Scouts (introduced this level).
    enemies: [
        // Block A (easiest - mostly grunts)
        { type: 'grunt',   x: 8.5,  y: 33.5 },
        { type: 'grunt',   x: 28.5, y: 33.5 },
        { type: 'grunt',   x: 19.5, y: 35.5 },
        // Block A->B connector
        { type: 'scout',   x: 18.5, y: 31.5 },
        // Block B (grunts + first soldier)
        { type: 'grunt',   x: 5.5,  y: 24.5 },
        { type: 'soldier', x: 30.5, y: 24.5 },
        { type: 'grunt',   x: 19.5, y: 26.5 },
        // Block B->C connector
        { type: 'scout',   x: 18.5, y: 21.5 },
        // Block C (soldiers + scouts)
        { type: 'soldier', x: 8.5,  y: 14.5 },
        { type: 'scout',   x: 32.5, y: 14.5 },
        { type: 'grunt',   x: 19.5, y: 16.5 },
        { type: 'soldier', x: 25.5, y: 13.5 },
        // Block C->D connector
        { type: 'scout',   x: 18.5, y: 11.5 },
        // Block D (hardest - soldiers + scouts guarding last prisoner)
        { type: 'soldier', x: 8.5,  y: 4.5 },
        { type: 'scout',   x: 30.5, y: 4.5 },
        { type: 'soldier', x: 19.5, y: 6.5 },
        { type: 'scout',   x: 37.5, y: 7.5 },
    ],

    // Items spread through the blocks.
    items: [
        // Rocket Launcher in a hidden alcove near block B (exploration reward)
        { type: 'WEAPON_ROCKET', x: 37.5, y: 27.5 },
        // Prisoners (objective items) - one per block at specific cells
        // Block A prisoner - east cell row
        { type: 'OBJECTIVE_ITEM', x: 25.5, y: 35.5 },
        // Block B prisoner - west cell row
        { type: 'OBJECTIVE_ITEM', x: 5.5,  y: 26.5 },
        // Block C prisoner - east cell row
        { type: 'OBJECTIVE_ITEM', x: 32.5, y: 16.5 },
        // Block D prisoner - west cell row
        { type: 'OBJECTIVE_ITEM', x: 5.5,  y: 6.5 },
        // Health and ammo - progressively more in later blocks
        { type: 'HEALTH_SMALL', x: 15.5, y: 38.5 },
        { type: 'HEALTH_SMALL', x: 19.5, y: 29.5 },
        { type: 'HEALTH_LARGE', x: 19.5, y: 19.5 },
        { type: 'HEALTH_LARGE', x: 19.5, y: 9.5 },
        { type: 'HEALTH_SMALL', x: 37.5, y: 14.5 },
        { type: 'HEALTH_LARGE', x: 19.5, y: 1.5 },
        // Ammo
        { type: 'AMMO_SHELLS',   x: 10.5, y: 33.5 },
        { type: 'AMMO_SHELLS',   x: 30.5, y: 14.5 },
        { type: 'AMMO_BULLETS',  x: 10.5, y: 23.5 },
        { type: 'AMMO_BULLETS',  x: 30.5, y: 4.5 },
        { type: 'AMMO_ROCKETS',  x: 37.5, y: 4.5 },
        { type: 'AMMO_ROCKETS',  x: 1.5,  y: 14.5 },
        // Armor
        { type: 'ARMOR', x: 19.5, y: 23.5 },
        { type: 'ARMOR', x: 1.5,  y: 4.5 },
    ],

    // Four rescue objectives.
    objectives: [
        {
            type: 'rescue',
            x: 25.5,
            y: 35.5,
            description: 'RESCUE PRISONER - BLOCK A',
        },
        {
            type: 'rescue',
            x: 5.5,
            y: 26.5,
            description: 'RESCUE PRISONER - BLOCK B',
        },
        {
            type: 'rescue',
            x: 32.5,
            y: 16.5,
            description: 'RESCUE PRISONER - BLOCK C',
        },
        {
            type: 'rescue',
            x: 5.5,
            y: 6.5,
            description: 'RESCUE PRISONER - BLOCK D',
        },
    ],

    // Exit at the north end after all prisoners are rescued.
    exitTrigger: { x: 19.5, y: 1.5, requiredObjectives: 4 },

    palette: {
        ceiling: '#1a1a1a',
        floor:   '#2a2020',
        fog:     '#0a0a0a',
    },

    parTime: 300,

    hints: [
        {
            trigger: 'time',
            delay: 30,
            text: 'PRISONERS DETECTED IN 4 CELL BLOCKS',
        },
        {
            trigger: 'time',
            delay: 90,
            text: 'CHECK EACH CELL BLOCK FOR PRISONERS',
        },
        {
            trigger: 'time',
            delay: 180,
            text: 'WATCH FOR SCOUTS - THEY RUSH FROM THE SHADOWS',
        },
    ],
};

export default level3;
