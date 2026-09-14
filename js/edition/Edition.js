import { FEATURES } from './features.js';

export { FEATURES };

/**
 * Edition — which features this build withholds, and who to tell when a learner
 * reaches for one.
 *
 * A module-level singleton rather than something threaded through constructors:
 * the alternative touches every panel signature in the module to carry a value
 * that changes once, at boot, and never again.
 *
 * **The default is everything unlocked.** The full edition installs no edition
 * at all, so it runs exactly as it did before any of this existed. That is not
 * a convenience — it is what makes this safe to add to a shipped product.
 */

const FULL = { locked: new Set(), onLocked: null };

let current = FULL;

/**
 * @param {string[]} [locked] feature ids to withhold
 * @param {(id: string) => void} [onLocked] called when a locked control is pressed
 */
export function setEdition({ locked = [], onLocked = null } = {}) {
    current = { locked: new Set(locked), onLocked };
}

/** Back to the full edition. Used by tests, and by anything undoing a trial. */
export function resetEdition() {
    current = FULL;
}

/**
 * Unknown ids are UNLOCKED, deliberately.
 *
 * A mistyped id therefore leaves a premium feature reachable in the trial,
 * rather than locking something that was meant to work. Lost revenue is
 * recoverable; a trial that dead-ends in a classroom is not. The drift test in
 * tests/edition.test.mjs is what stops a typo surviving to a build.
 */
export function isLocked(id) {
    return !!id && current.locked.has(id);
}

/** Tell the edition a learner just reached for a locked control. */
export function reportLocked(id) {
    current.onLocked?.(id);
}
