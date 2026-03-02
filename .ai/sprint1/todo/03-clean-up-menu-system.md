# Task 03: Remove multiplayer option from menu system

## What
Update the title menu and any other menu screens to remove the "Multiplayer" option. The title screen should only show single-player campaign entry.

## Changes required
- Remove the "Multiplayer" menu option from the title screen in `src/ui/menu.js`
- Remove any multiplayer-related menu rendering or selection handling
- Ensure menu navigation still works correctly with remaining options
- Clean up any references to multiplayer states in menu callbacks

## Acceptance criteria
- Title screen has no "Multiplayer" option
- Menu selection and navigation works for all remaining options
- No dead code referencing multiplayer states
