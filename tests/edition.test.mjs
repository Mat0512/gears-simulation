// The trial gate, checked as data. Nothing here imports THREE or touches the
// DOM, so the whole edition path is testable without a browser or a headset.
//
// The full edition installs no edition at all, so the default has to be
// "everything unlocked" — that default is what guarantees the paid product is
// unaffected by any of this, and it is the first thing asserted below.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    FEATURES, setEdition, resetEdition, isLocked, reportLocked,
} from '../js/edition/Edition.js';
import { TRIAL_LIMITS } from '../js/edition/features.js';
import { TRIAL_LOCKED } from '../trial/trialEdition.js';
import { TRIAL } from '../trial/trialContent.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = path.join(ROOT, 'js', 'edition');

/** Every id gated at a call site under js/, both directions of the drift test. */
function gatedIds() {
    const found = new Set();
    const walk = (dir) => {
        if (dir === SKIP) return;      // features.js would satisfy its own test
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); continue; }
            if (!entry.name.endsWith('.js')) continue;
            const src = fs.readFileSync(full, 'utf8');
            for (const m of src.matchAll(/\b(?:isLocked|reportLocked)\(\s*["']([^"']+)["']\s*\)/g)) {
                found.add(m[1]);
            }
        }
    };
    walk(path.join(ROOT, 'js'));
    return found;
}

test('with no edition installed, nothing is locked', () => {
    resetEdition();
    for (const id of FEATURES) {
        assert.equal(isLocked(id), false, `${id} should be unlocked by default`);
    }
});

test('an installed edition locks exactly what it names', () => {
    setEdition({ locked: ['quiz'] });
    assert.equal(isLocked('quiz'), true);
    assert.equal(isLocked('gears.count'), false);
    resetEdition();
});

test('an unknown id is unlocked — a typo costs a lock, never a broken trial', () => {
    setEdition({ locked: ['gears.counts'] });      // deliberate typo
    assert.equal(isLocked('gears.count'), false);
    resetEdition();
});

test('an empty or missing id is never locked', () => {
    setEdition({ locked: FEATURES });
    assert.equal(isLocked(''), false);
    assert.equal(isLocked(undefined), false);
    assert.equal(isLocked(null), false);
    resetEdition();
});

test('pressing a locked feature reports it to the edition', () => {
    const seen = [];
    setEdition({ locked: ['gears.spec'], onLocked: (id) => seen.push(id) });
    reportLocked('gears.spec');
    assert.deepEqual(seen, ['gears.spec']);
    resetEdition();
});

test('reporting with no handler installed does not throw', () => {
    resetEdition();
    assert.doesNotThrow(() => reportLocked('quiz'));
});

test('the trial locks only ids the code knows about', () => {
    for (const id of TRIAL_LOCKED) {
        assert.ok(FEATURES.includes(id),
            `trial locks "${id}", which is not in FEATURES — it would fail open`);
    }
});

test('every locked id has a name to show the learner', () => {
    for (const id of TRIAL_LOCKED) {
        assert.ok(TRIAL.featureNames[id],
            `no display name for "${id}" — the offer would say "That control"`);
    }
});

// Unknown ids fail OPEN by design, so a typo at a call site silently leaves a
// premium control reachable. Nothing at runtime can catch that; this does.
test('every feature id gated in js/ is declared in FEATURES', () => {
    const used = gatedIds();
    assert.ok(used.size > 0, 'found no gates at all — has the edition been removed?');
    for (const id of used) {
        assert.ok(FEATURES.includes(id), `js/ gates on "${id}", which FEATURES does not declare`);
    }
});

test('every declared feature is actually gated somewhere', () => {
    const used = gatedIds();
    for (const id of FEATURES) {
        assert.ok(used.has(id), `FEATURES lists "${id}" but no gate in js/ uses it`);
    }
});

test('TEETH is never lockable — it is the lesson', () => {
    // The ratio of teeth to teeth is the whole subject. If a feature id for it
    // ever appears, the trial has been allowed to withhold the thing it exists
    // to demonstrate.
    for (const id of FEATURES) {
        assert.ok(!/teeth/i.test(id), `"${id}" would let an edition lock tooth counts`);
    }
});

test('the gear limit stops the lesson at a pair', () => {
    // Two gears are the first half of the lesson: teeth set the ratio of turns.
    // The third gear is the idler, and what it teaches — it reverses direction
    // without changing the ratio — is the half a trial learner does not finish.
    // Below two there is no ratio to see at all.
    assert.equal(TRIAL_LIMITS.maxGears, 2,
        `maxGears is ${TRIAL_LIMITS.maxGears} — a pair shows the ratio, an idler is the full edition`);
});
