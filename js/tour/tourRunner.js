/**
 * TourRunner — which step of a HOW TO USE tour is current, and whether it is
 * done. No THREE, no DOM: the card draws, this decides, and Node tests it.
 *
 * A step is done when `step.done(state, start)` is true, where `start` is a
 * shallow copy of the page's tourState() taken when the step began. Comparing
 * against the start is what makes "change the element" mean "change it now",
 * and re-taking it on every step is what stops a step inheriting the last one's
 * change.
 *
 * It NEVER advances by itself. The light module's tour moved on 1.4 s after a
 * slider first moved, and drew the old step's model over the new one; here a
 * finished step only waits for NEXT.
 */
export class TourRunner {
    constructor(steps) {
        if (!steps?.length) throw new Error('TourRunner needs at least one step');
        this.steps = steps;
        this.index = 0;
        this.done = false;
        this.started = false;
        this._start = null;
    }

    get step() { return this.steps[this.index]; }
    get total() { return this.steps.length; }
    get isLast() { return this.index === this.steps.length - 1; }

    /** Start the current step from this state. A step already true is done at once. */
    begin(state) {
        this._start = { ...state };
        this.started = true;
        this.done = !!this.step.done(state, this._start);
    }

    /** @returns {boolean} true only on the call that completes the step */
    tick(state) {
        if (!this.started || this.done) return false;
        if (!this.step.done(state, this._start)) return false;
        this.done = true;
        return true;
    }

    /** NEXT — allowed whether or not the step is done. */
    next(state) {
        if (this.isLast) {
            this.index = 0;
            this.started = false;
            this.done = false;
            return 'finished';
        }
        this.index++;
        this.begin(state);
        return 'advanced';
    }
}

/**
 * The steps this edition can actually do. A step whose control is locked would
 * send a trial learner to a button that only raises the offer, so it is left
 * out — and when a later trial cut locks something new, the tours follow.
 */
export function tourSteps(steps, isLocked) {
    return steps.filter((s) => !(s.needs && isLocked(s.needs)));
}
