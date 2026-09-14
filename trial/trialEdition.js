/**
 * What the free trial withholds.
 *
 * TEETH IS OPEN, and that is the whole point. The ratio of teeth sets the ratio
 * of turns, so a trial that cannot change tooth counts cannot demonstrate the
 * one thing this module teaches — it would be a screenshot rather than proof
 * that the simulation is real. A trial learner meshes gears, changes the counts
 * and watches the ratio follow.
 *
 * What is limited is how far past the lesson they can go:
 *
 *   gears.count  a train of three — a driver, an idler and a driven wheel. That
 *                is enough to show an idler reverses direction without changing
 *                the ratio, which a two-gear train cannot make.
 *   gears.spec   module, pressure angle, thickness and bore: the manufacturing
 *                spec, which is depth rather than lesson.
 *   quiz         the LMS-graded exam.
 */
export const TRIAL_LOCKED = [
    'gears.count',
    'gears.spec',
    'quiz',
];
