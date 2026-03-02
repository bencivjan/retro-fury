# Task 05: Add browser-based test infrastructure

## What
Add a lightweight test framework that works in a static hosting context (no Node.js required for running tests). Create a test HTML page and test runner.

## Requirements
- Create `tests/index.html` that loads and runs all tests in the browser
- Create a minimal test runner utility (assert helpers, test registration, result display)
- Tests should run by opening `tests/index.html` in a browser
- Test results should display pass/fail counts in the page
- Also support running tests via a Node.js script for CI (optional)

## Acceptance criteria
- `tests/index.html` exists and loads the test runner
- A minimal test utility provides `describe`, `it`, `assert` style helpers
- Opening `tests/index.html` in a browser shows test results
- At least one placeholder test passes to verify the infrastructure works
