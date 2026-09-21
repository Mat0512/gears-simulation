/**
 * Every control that an edition may lock.
 *
 * Ids live in js/ because js/ is where they are REFERENCED — each one is a gate
 * on a control or a route. What an edition does with them, and what is being
 * sold, lives in `trial/`.
 *
 * The list is canonical: tests/edition.test.mjs asserts that every id used at a
 * call site appears here, which is what stops a typo reaching a build given
 * that unknown ids deliberately fail open.
 *
 * TEETH IS NOT IN THIS LIST AND MUST NOT BE. The ratio of teeth sets the ratio
 * of turns — the first half of the lesson, and the half a trial does teach — so
 * a trial that could not change tooth counts would teach nothing at all. What a
 * trial limits is how big a train may get (a pair, so the idler is the half it
 * does not finish) and how much of the manufacturing spec it may touch.
 */
export const FEATURES = [
    'gears.count',   // adding beyond the trial's gear limit
    'gears.spec',    // module, pressure angle, thickness, bore
    'quiz',          // the LMS-graded exam
];

/** How far a limited edition may go. Read by the gates, not by the edition. */
export const TRIAL_LIMITS = {
    /**
     * A driver and a driven wheel: enough to show that the teeth set the ratio
     * of turns, which is the first half of the lesson. A third gear is an idler,
     * and what it teaches — it reverses direction without changing the ratio —
     * is the half a trial learner does not get to finish.
     */
    maxGears: 2,
};
