// =============================================================================
// test-runner.js - Minimal browser-based test framework for RETRO FURY
// =============================================================================

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
    const suite = { name, tests: [], passed: 0, failed: 0, errors: [] };
    suites.push(suite);
    currentSuite = suite;
    fn();
    currentSuite = null;
}

export function it(name, fn) {
    if (!currentSuite) throw new Error('it() must be called inside describe()');
    currentSuite.tests.push({ name, fn });
}

export const assert = {
    ok(value, msg) {
        if (!value) throw new Error(msg || `Expected truthy, got ${JSON.stringify(value)}`);
    },
    equal(actual, expected, msg) {
        if (actual !== expected) {
            throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    },
    deepEqual(actual, expected, msg) {
        const a = JSON.stringify(actual);
        const e = JSON.stringify(expected);
        if (a !== e) {
            throw new Error(msg || `Expected ${e}, got ${a}`);
        }
    },
    closeTo(actual, expected, tolerance = 1e-9, msg) {
        if (Math.abs(actual - expected) > tolerance) {
            throw new Error(msg || `Expected ${expected} +/- ${tolerance}, got ${actual}`);
        }
    },
    throws(fn, msg) {
        let threw = false;
        try { fn(); } catch (_) { threw = true; }
        if (!threw) throw new Error(msg || 'Expected function to throw');
    },
};

export async function runAll() {
    let totalPassed = 0;
    let totalFailed = 0;

    for (const suite of suites) {
        console.group(`%c${suite.name}`, 'font-weight:bold');
        for (const test of suite.tests) {
            try {
                await test.fn();
                suite.passed++;
                totalPassed++;
                console.log(`  %c PASS %c ${test.name}`, 'background:green;color:white', '');
            } catch (err) {
                suite.failed++;
                totalFailed++;
                suite.errors.push({ test: test.name, error: err.message });
                console.log(`  %c FAIL %c ${test.name} -- ${err.message}`, 'background:red;color:white', 'color:red');
            }
        }
        console.groupEnd();
    }

    console.log(
        `%c ${totalPassed} passed, ${totalFailed} failed `,
        totalFailed ? 'background:red;color:white;font-size:14px' : 'background:green;color:white;font-size:14px'
    );

    renderResults(totalPassed, totalFailed);
    return { passed: totalPassed, failed: totalFailed };
}

function renderResults(totalPassed, totalFailed) {
    const root = document.getElementById('results');
    if (!root) return;

    const allGood = totalFailed === 0;
    const banner = document.createElement('div');
    banner.className = allGood ? 'banner pass' : 'banner fail';
    banner.textContent = `${totalPassed} passed, ${totalFailed} failed`;
    root.appendChild(banner);

    for (const suite of suites) {
        const section = document.createElement('details');
        section.open = suite.failed > 0;
        const summary = document.createElement('summary');
        summary.className = suite.failed ? 'suite-fail' : 'suite-pass';
        summary.textContent = `${suite.name}  (${suite.passed}/${suite.tests.length})`;
        section.appendChild(summary);

        for (const test of suite.tests) {
            const failInfo = suite.errors.find(e => e.test === test.name);
            const row = document.createElement('div');
            row.className = failInfo ? 'test fail' : 'test pass';
            row.textContent = failInfo
                ? `  FAIL  ${test.name} -- ${failInfo.error}`
                : `  PASS  ${test.name}`;
            section.appendChild(row);
        }
        root.appendChild(section);
    }
}
