# Task 06: Write tests for core game systems

## What
Write thorough tests for the core game systems to ensure nothing broke during the multiplayer removal refactor.

## Test areas
- **Raycaster**: DDA algorithm produces correct hit data for known map configurations
- **Player**: Movement, collision detection, health/armor changes, weapon switching
- **Weapons**: Fire rate, damage values, ammo consumption, all weapon definitions
- **Enemies**: Creation, state machine transitions, damage taking, death
- **Level loader**: Parses tile maps correctly, places entities at correct positions
- **Math utils**: Distance calculations, angle normalization, collision helpers
- **Door system**: State transitions (closed → opening → open → closing → closed)
- **Item system**: Pickup behavior, health/armor/ammo restoration

## Acceptance criteria
- Tests cover all listed areas
- All tests pass
- Tests exercise edge cases (zero health, max ammo, wall collisions)
- Test results clearly show what passed and what failed
