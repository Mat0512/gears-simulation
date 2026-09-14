/**
 * examLink — take the exam link out of the address bar without losing it.
 *
 * The portal launches a sitting with `?user_id=6&exam_id=45`. Those ids are a
 * student's identity for that sitting, and on a shared headset they have no
 * business being on screen: the next person can read them, and editing one digit
 * submits somebody else's exam. The ids still have to reach the quiz, so they
 * are captured on load, kept in sessionStorage, and removed from the URL.
 *
 * sessionStorage rather than nothing, so an accidental reload mid-exam resumes
 * instead of silently dropping out of quiz mode. It is cleared as soon as scores
 * are saved — a tab left open after a finished exam must not hand the next
 * student the previous one's identity.
 *
 * `loc`, `store` and `hist` are injected so every path here — including the
 * failures, which are the ones worth testing — can be driven from Node.
 */

const KEY = 'gears:exam-link';

/** The query parameters that turn a visit into an exam sitting. */
const PARAMS = { user: 'user_id', exam: 'exam_id' };

/** What the portal's explore page attaches to say "this is not a sitting". */
const EXPLORE = { param: 'mode', value: 'explore' };

/** Both ids, or neither — a half link is not a sitting. */
function hasBothIds(params) {
    return params.has(PARAMS.user) && params.has(PARAMS.exam);
}

function read(store) {
    try {
        return store?.getItem(KEY) ?? '';
    } catch {
        // Storage can throw outright when disabled, not just return null.
        return '';
    }
}

/**
 * Capture the exam link and strip it from the address bar.
 *
 * @returns {string} the search string to parse — '' means no sitting.
 */
export function captureExamLink({
    loc = globalThis.location,
    store = globalThis.sessionStorage,
    hist = globalThis.history,
} = {}) {
    const search = loc?.search ?? '';
    const params = new URLSearchParams(search);

    // The portal's explore page: browse only, whatever else the link says.
    // Checked before the ids so the fail-safe reading wins — a link carrying both
    // markers grades nobody rather than grading the wrong person.
    //
    // It also drops the stored sitting, which is the whole point. The fallback
    // below cannot tell a reload from a fresh visit, so a student who backed out
    // of an exam was handed it straight back the next time they opened the same
    // module from Explore — in the same tab, so sessionStorage survived.
    if (params.get(EXPLORE.param) === EXPLORE.value) {
        try {
            store?.removeItem(KEY);
        } catch {
            // Storage disabled — then nothing was stored to hand back either.
        }
        return '';
    }

    // A reload or a direct visit: nothing to capture, so fall back to whatever
    // was stored by the launch that started this tab.
    if (!hasBothIds(params)) return read(store) || search;

    const link = new URLSearchParams({
        [PARAMS.user]: params.get(PARAMS.user),
        [PARAMS.exam]: params.get(PARAMS.exam),
    }).toString();

    try {
        store?.setItem(KEY, `?${link}`);
    } catch {
        // Out of quota, or storage disabled. The sitting still works; only
        // surviving a reload is lost, so this must not be fatal.
    }

    // Only the two ids go. Anything else the URL carries is somebody else's.
    params.delete(PARAMS.user);
    params.delete(PARAMS.exam);
    const rest = params.toString();

    try {
        hist?.replaceState(
            null,
            '',
            `${loc.pathname}${rest ? `?${rest}` : ''}${loc.hash ?? ''}`,
        );
    } catch {
        // replaceState throws on a file:// origin. Leaving the ids visible is worse
        // than nothing, but it is not worth failing to boot over.
    }

    return `?${link}`;
}

/**
 * True when the portal opened this as a browse-only visit.
 *
 * Safe to call in either order with `captureExamLink`: the explore branch there
 * returns before the address bar is rewritten, so the marker is still on the
 * URL — and it stays there, so a reload is browse-only too.
 */
export function isExploreVisit({ loc = globalThis.location } = {}) {
    const params = new URLSearchParams(loc?.search ?? '');
    return params.get(EXPLORE.param) === EXPLORE.value;
}

/** Forget the sitting. Called once the score is safely recorded. */
export function clearExamLink({ store = globalThis.sessionStorage } = {}) {
    try {
        store?.removeItem(KEY);
    } catch {
        /* nothing to do — the tab is closing on it either way */
    }
}
