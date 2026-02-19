# Best Enemy Killing Strategy

**Best Result**: 10/10 kills on Level 1 (all enemies eliminated in ~45 seconds)

## Target Selection
- Always prioritize the **nearest alive enemy** within line-of-sight (15-tile detection range)
- Use raycasted line-of-sight checks (sample 3x the distance in steps) to verify no walls block the shot
- When no enemies are visible, BFS pathfind to the nearest alive enemy on the map to seek them out

## Aiming
- Calculate angle from player to target: `atan2(enemy.y - player.y, enemy.x - player.x)`
- Compute angular error between current facing angle and target angle
- Apply mouse delta proportional to error: `sign(error) * min(|error / 0.003|, 300)` for fast but stable convergence
- Fire (mouse down) when angular error is within **0.3 radians** (~17 degrees)

## Weapon Selection (priority order)
1. **Shotgun** (weapon 1) at close range (<4 tiles) if shells > 0 - high burst damage
2. **Machine Gun** (weapon 2) at mid range if bullets > 10 - sustained DPS
3. **Plasma Rifle** (weapon 4) if cells > 0 - good all-around
4. **Rocket Launcher** (weapon 3) at long range (>5 tiles) if rockets > 0 - splash damage
5. **Shotgun** as fallback at any range if shells > 0
6. **Pistol** (weapon 0) as last resort - infinite ammo

## Movement During Combat
- **Approach**: Move forward (W) when enemy is >5 tiles away to close distance
- **Retreat**: Move backward (S) when enemy is <1.8 tiles to avoid melee/splash
- **Strafe dodge**: Alternate left (A) and right (D) in 40-frame cycles to dodge enemy projectiles
- This A/D cycle runs continuously during combat regardless of distance

## Navigation to Find Enemies
- BFS pathfinding on the tile grid (32x32) with door awareness
- Locked doors the player can't open are blocked in the BFS graph
- Path cache refreshes every 2 seconds or when target changes
- Advance past waypoints when within 0.6 tiles
- Open doors by pressing E when within 1.6 tiles of a closed door
- Periodic random E presses (10% chance per frame) to interact with anything nearby

## Stuck Recovery
- Track position history over 1.5-second windows
- If player moved <0.4 tiles in 1.5 seconds, trigger recovery:
  - Clear cached path
  - Apply random mouse rotation (-250 to +250 delta)
  - Press random movement key (W/A/S/D)
  - Press E in case stuck on a door
