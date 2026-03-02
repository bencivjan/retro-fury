# Task 07: Verify static hosting and play-test

## What
Verify the game works correctly when served from a static file server. Check for console errors, test all 5 campaign levels load, and ensure gameplay is functional.

## Verification steps
- Serve the game with `python3 -m http.server`
- Open in browser and verify no console errors
- Verify title screen loads with only single-player option
- Start level 1 and verify gameplay works (movement, shooting, enemies, items)
- Verify level transitions work
- Check that all textures render correctly
- Check that audio plays correctly
- Run the test suite and confirm all tests pass

## Acceptance criteria
- Game loads without errors from static server
- Title menu shows only single-player
- Level 1 is fully playable
- No JavaScript console errors
- Test suite passes
