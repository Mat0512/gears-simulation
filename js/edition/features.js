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
 * TEETH IS NOT IN THIS LIST AND MUST NOT BE. The whole lesson is that the ratio
 * of teeth sets the ratio of turns, so a trial that cannot change tooth counts
 * cannot demonstrate the one thing the module teaches — it would be a
 * screenshot. What a trial limits is how big a train may get and how much of
 * the manufacturing spec it may touch.
 */
export const FEATURES = [
    'gears.count',   // adding beyond the trial's gear limit
    'gears.spec',    // module, pressure angle, thickness, bore
    'quiz',          // the LMS-graded exam
];

/** How far a limited edition may go. Read by the gates, not by the edition. */
export const TRIAL_LIMITS = {
    /**
     * Three gears is a driver, an idler and a driven wheel — enough to show
     * that an idler reverses direction without changing the ratio, which is
     * the point a two-gear train cannot make.
     */
    maxGears: 3,
};
