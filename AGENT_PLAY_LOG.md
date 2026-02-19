# Agent Play Log

## Run 1 - Level 1 (Timeout)
- **Kills**: 10/10 (all enemies on Level 1)
- **Time**: 60.0s (timeout)
- **HP**: 35
- **Result**: Timeout - killed all 10 enemies by ~48s but didn't reach exit in time
- **Strategy**: BFS pathfinding to nearest alive enemy, hitscan combat with angle tracking, strafe dodging in 40-frame cycles. Prioritized shotgun at close range (<4 tiles), machine gun at mid range, plasma rifle as fallback. Approached enemies head-on when >5 tiles away, retreated when <1.8 tiles.

## Run 2 - Level 1 + Level 2 (Timeout on L2)
- **Kills**: 10/10 on Level 1, 12/14 on Level 2
- **Time**: ~60s on L1 (completed), 60s on L2 (timeout)
- **HP**: 55 at L2 timeout
- **Result**: Completed Level 1, advanced to Level 2. Killed 12 of 14 enemies on L2 before timeout. Best run overall (12 kills on hardest level reached).
- **Strategy**: Same BFS-to-nearest-enemy approach. Cleared L1 efficiently (~50s all kills). On L2, navigated the larger map well - enemies spread across more rooms required longer pathing. Took damage from grouped enemies in corridors but sustained HP above 50. Door interaction improved navigation through multi-room layout.

## Run 3 - Level 2 (Timeout, then crash)
- **Kills**: 11/14 on Level 2
- **Time**: 60.0s (timeout)
- **HP**: 46
- **Result**: Restarted on Level 2 from previous timeout. Killed 11 of 14 enemies. Browser crashed after timeout.
- **Strategy**: Consistent performance with Run 2 on Level 2. Slightly fewer kills (11 vs 12) due to different enemy encounter order. Same core strategy - seek nearest alive enemy via BFS, engage with angle-tracking combat, strafe dodge.
