// The bench's HOW TO USE steps, checked as data: the copy is fit to be read
// aloud later, each done rule fires on the change it describes, and the trial
// leaves out the step whose control it withholds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { GEARS_STEPS } from '../js/content/howToSteps.js';
import { TourRunner, tourSteps } from '../js/tour/tourRunner.js';
import { hasSeen, markSeen } from '../js/tour/seenStore.js';
import { FEATURES } from '../js/edition/features.js';
import { TRIAL_LOCKED } from '../trial/trialEdition.js';

const byId = (id) => GEARS_STEPS.find((s) => s.id === id);
const state = (over = {}) => ({ gears: 1, playing: false, teeth: '20', ...over });

test('the tour has steps, each with an id, a heading and a rule', () => {
    assert.ok(GEARS_STEPS.length >= 3);
    assert.equal(new Set(GEARS_STEPS.map((s) => s.id)).size, GEARS_STEPS.length);
    for (const s of GEARS_STEPS) {
        assert.equal(s.heading, s.heading.toUpperCase(), s.heading);
        assert.match(String(s.aim), /^[a-z][a-z0-9-]*$/, `${s.heading} has no aim id`);
        assert.equal(typeof s.done, 'function');
        assert.ok(!/[×→✓\n]/.test(s.body), `"${s.heading}" body has a symbol a voice would stumble on`);
    }
});

test('every step that needs a feature names a declared one', () => {
    // An unknown id fails OPEN, so the step would show in the trial and send
    // the learner to a control that only raises the offer.
    for (const s of GEARS_STEPS.filter((x) => x.needs)) {
        assert.ok(FEATURES.includes(s.needs), `"${s.heading}" needs unknown "${s.needs}"`);
    }
});

test('the trial drops the teeth step, because it withholds that control', () => {
    const kept = tourSteps(GEARS_STEPS, (id) => TRIAL_LOCKED.includes(id)).map((s) => s.id);
    assert.deepEqual(kept, ['add', 'play', 'ratio']);
    assert.equal(tourSteps(GEARS_STEPS, () => false).length, GEARS_STEPS.length);
});

test('the rules fire on what each step describes, and nothing else', () => {
    assert.equal(byId('add').done(state({ gears: 2 })), true);
    assert.equal(byId('add').done(state({ playing: true })), false);
    assert.equal(byId('play').done(state({ playing: true })), true);
    assert.equal(byId('play').done(state({ gears: 3 })), false);
    assert.equal(byId('teeth').done(state({ teeth: '20,18' }), state()), true);
    assert.equal(byId('teeth').done(state(), state()), false);
    assert.equal(byId('ratio').done(state(), state()), true, 'a reading step');
});

test('a step compares against the state it started from, and never self-advances', () => {
    const r = new TourRunner(GEARS_STEPS);
    r.index = GEARS_STEPS.findIndex((s) => s.id === 'teeth');
    r.begin(state({ teeth: '20,20' }));
    assert.equal(r.done, false);
    for (let i = 0; i < 20; i++) r.tick(state({ teeth: '20,20' }));
    assert.equal(r.index, GEARS_STEPS.findIndex((s) => s.id === 'teeth'));
    assert.equal(r.tick(state({ teeth: '20,14' })), true);
});

test('seen is remembered per page, and a blocked store reads as not seen', () => {
    const m = new Map();
    const fake = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
    assert.equal(hasSeen('gears', fake), false);
    markSeen('gears', fake);
    assert.equal(hasSeen('gears', fake), true);
    const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.equal(hasSeen('gears', bad), false);
    assert.doesNotThrow(() => markSeen('gears', bad));
});
