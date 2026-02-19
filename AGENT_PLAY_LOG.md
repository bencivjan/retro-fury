# Agent Play Log

## Run 1 - Level 1 (Timeout)
- **Kills**: 10/10 (all enemies)
- **Time**: 60.0s (timeout)
- **HP**: 95
- **Result**: Timeout - killed all enemies but didn't reach exit in time
- **Strategy**: BFS pathfinding to nearest alive enemy, hitscan combat with angle tracking, strafe dodging in 40-frame cycles. Prioritized shotgun at close range (<4 tiles), machine gun at mid range, plasma rifle as fallback. Approached enemies head-on when >5 tiles away, retreated when <1.8 tiles.

## Run 2 - Level 1 (Timeout)
- **Kills**: 10/10 (all enemies)
- **Time**: 60.0s (timeout)
- **HP**: 90
- **Result**: Timeout - killed all enemies but didn't reach exit in time
- **Strategy**: Same BFS-to-nearest-enemy approach. All 10 enemies eliminated by ~46 seconds. Remaining time spent navigating toward objectives/exit but got stuck in maze corridors. Door opening via KeyE when within 1.6 tiles helped traverse locked areas.

## Run 3 - Level 1 (Timeout)
- **Kills**: 10/10 (all enemies)
- **Time**: 60.0s (timeout)
- **HP**: 75
- **Result**: Timeout - killed all enemies, took more damage this run from enemy clusters
- **Strategy**: Same core strategy. Took more damage due to encountering grouped enemies simultaneously. Strafe dodging helped reduce incoming damage. Enemy prioritization by distance kept engagements manageable.
