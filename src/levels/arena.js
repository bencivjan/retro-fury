// =============================================================================
// arena.js - "THE ARENA" (1v1 PvP Gun Game Map) for RETRO FURY
// =============================================================================
// A 32x32 tile map designed for balanced 1v1 PvP combat. The layout is roughly
// symmetric across both axes so neither player has an inherent advantage.
//
// Design philosophy:
//   - Central open area where corridors converge (sniper sightlines)
//   - 4 corner rooms with narrow entries (close-quarters combat)
//   - L-shaped corridors connecting quadrants through the center
//   - Pillars/columns in open areas for cover
//   - No dead ends - every path loops back for good flow
//   - 4 spawn points in semi-protected alcoves, one per quadrant
//
// Theme: industrial arena with mixed wall textures
//   1 = brick wall (outer perimeter, corner room walls)
//   2 = concrete wall (corridor walls, interior structure)
//   4 = metal wall (pillars, accent walls)
//   5 = tech panel (corner room accents, spawn alcove walls)
//
// Inspired by arena FPS classics: Quake's The Longest Yard, UT's Deck16
// =============================================================================

// Legend:
//   0 = empty / walkable
//   1 = brick wall (perimeter, corner rooms)
//   2 = concrete wall (corridors, interior)
//   4 = metal wall (pillars, accents)
//   5 = tech panel (spawn alcoves, tech accents)

const arena = {
    name: 'THE ARENA',

    // 32x32 tile map - roughly symmetric for PvP fairness.
    // The map has 4-fold rotational symmetry with minor variations for texture.
    map: [
        // Row 0  (north wall - outer perimeter)
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        // Row 1  - NW corner room top / NE corner room top
        [1,0,0,0,0,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,0,0,0,0,1],
        // Row 2  - NW spawn alcove / NE spawn alcove
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
        // Row 3  - NW corner room
        [1,0,0,0,0,0,1,0,0,0,0,0,2,2,0,0,0,0,2,2,0,0,0,0,0,1,0,0,0,0,0,1],
        // Row 4  - NW room entry / north corridor
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 5  - NW room south wall / north corridor
        [1,5,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,5,1],
        // Row 6  - north corridor / approach to center
        [1,1,1,0,0,0,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,2,0,0,0,1,1,1],
        // Row 7  - north side rooms / corridor
        [1,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1],
        // Row 8  - L-corridor north section
        [1,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 9  - approach to center from north
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 10 - center ring north edge
        [1,0,0,0,2,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,0,0,1],
        // Row 11 - center ring
        [1,0,0,0,2,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,1],
        // Row 12 - center area with pillars
        [1,0,0,2,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,2,0,1],
        // Row 13 - center open area
        [1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,1],
        // Row 14 - center corridor east-west
        [1,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,1],
        // Row 15 - center open area (mid line)
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 16 - center open area (mid line)
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 17 - center corridor east-west (mirror of row 14)
        [1,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,1],
        // Row 18 - center open area (mirror of row 13)
        [1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1],
        // Row 19 - center area with pillars (mirror of row 12)
        [1,0,2,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,2,0,1],
        // Row 20 - center ring (mirror of row 11)
        [1,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,1],
        // Row 21 - center ring south edge (mirror of row 10)
        [1,0,0,2,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,2,2,0,0,0,0,0,0,2,0,0,1],
        // Row 22 - approach to center from south (mirror of row 9)
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 23 - L-corridor south section (mirror of row 8)
        [1,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 24 - south side rooms / corridor (mirror of row 7)
        [1,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1],
        // Row 25 - south corridor (mirror of row 6)
        [1,1,1,0,0,0,2,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,2,0,0,0,1,1,1],
        // Row 26 - SW room north wall (mirror of row 5)
        [1,5,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,5,1],
        // Row 27 - SW room entry / south corridor (mirror of row 4)
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        // Row 28 - SW corner room (mirror of row 3)
        [1,0,0,0,0,0,1,0,0,0,0,0,2,2,0,0,0,0,2,2,0,0,0,0,0,1,0,0,0,0,0,1],
        // Row 29 - SW spawn alcove / SE spawn alcove (mirror of row 2)
        [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
        // Row 30 - SW corner room bottom / SE corner room bottom (mirror of row 1)
        [1,0,0,0,0,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,0,0,0,0,1],
        // Row 31 (south wall - outer perimeter)
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],

    // Spawn points in semi-protected alcoves, one per quadrant.
    // Each faces toward the center of the map for immediate orientation.
    spawnPoints: [
        { x: 3.5, y: 2.5, angle: Math.PI / 4 },         // NW corner alcove
        { x: 28.5, y: 2.5, angle: 3 * Math.PI / 4 },    // NE corner alcove
        { x: 3.5, y: 29.5, angle: -Math.PI / 4 },        // SW corner alcove
        { x: 28.5, y: 29.5, angle: -3 * Math.PI / 4 },   // SE corner alcove
    ],

    palette: {
        ceiling: '#1a1a2a',
        floor: '#2a2a1a',
    },
};

export default arena;
