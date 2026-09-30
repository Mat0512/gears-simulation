/**
 * Has this page's tour already opened in this tab?
 *
 * sessionStorage, not localStorage: a classroom headset is shared, and the next
 * student opens a new tab and should meet the tour fresh, while one student
 * moving between the four pages should not be shown it again on each.
 *
 * Every failure reads as "not seen". Storage can be blocked, or the accessor
 * itself can throw, and a card that opens once too often costs a press of SKIP;
 * one that never opens costs the learner the tour. Resolved inside the try for
 * that reason — reading globalThis.sessionStorage is the part that throws.
 */
const key = (page) => `gears.howto.seen.${page}`;

function session(storage) {
    try { return storage === undefined ? globalThis.sessionStorage : storage; } catch { return null; }
}

export function hasSeen(page, storage) {
    try { return session(storage)?.getItem(key(page)) === '1'; } catch { return false; }
}

export function markSeen(page, storage) {
    try { session(storage)?.setItem(key(page), '1'); } catch { /* opens again next time */ }
}
