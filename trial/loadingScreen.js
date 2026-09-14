/**
 * The trial's loading screen — the half of it that runs once the bundle does.
 *
 * The markup and the styles live in index.html rather than here, and that is
 * the point: the splash is on screen with the first byte of the document. A
 * loading screen that waits for a 750 kB module bundle to download and parse
 * before it appears has missed the part it was there for.
 *
 * The inline script in index.html owns the stretch of the bar this file cannot
 * reach. The bundle download is 85-96% of the wait on a slow link and it
 * finishes before any of this code exists, so that script fetches the bundle
 * itself and fills the bar from real bytes. This file picks the bar up wherever
 * it was left — it reads the width rather than assuming a number, so there is
 * no shared constant for the two halves to disagree about — divides what
 * remains between the module's genuine async startup steps, and takes the
 * screen away.
 *
 * Nothing here runs on a timer. A bar that fills on a fixed schedule tells the
 * learner something false about what the module is doing.
 */

/** Matches #loading-screen's opacity transition in index.html. Keep in step. */
const FADE_MS = 800;

/** How long the full bar is held before the fade starts. */
const HOLD_MS = 600;

/**
 * Put the loading screen under this module's control.
 *
 * Call at the very top of boot(). Then `progress()` as synchronous work
 * completes, `track()` on the real async steps, and `done()` once the simulator
 * is running. `done()` and `fail()` are both safe to call more than once.
 *
 * @param {object} [opts]
 * @param {number} [opts.capMs] Leave anyway after this long. A learner staring
 *   at a bar because one fetch stalled is worse off than a learner looking at a
 *   scene that is still settling.
 * @returns {{ progress: (pct: number) => void,
 *             track: (steps: Array<Promise<unknown>>) => Promise<void>,
 *             done: () => void,
 *             fail: (message: string) => void }}
 */
export function installLoadingScreen({ capMs = 12000 } = {}) {
    // Stand the document's own watchdog down: the bundle loaded and boot() is
    // running, so the only failures left are ones the cap below can cover. The
    // watchdog is inline in index.html because the failure it exists for is
    // this bundle never arriving, which no timer in here could ever catch.
    window.pxLoadStarted?.();

    const el = document.getElementById('loading-screen');
    const bar = document.getElementById('loading-bar');
    if (!el) return { progress() {}, track: async () => {}, done() {}, fail() {} };

    let finished = false;
    // Wherever the inline script's byte-driven fill got to. Empty on the dev
    // server, which serves the module graph unbundled and so has no single
    // download to measure.
    let pct = parseFloat(bar?.style.width) || 0;

    /** Monotonic: a bar that goes backwards reads as a fault. */
    const progress = (value) => {
        pct = Math.max(pct, Math.min(100, value));
        if (bar) bar.style.width = `${pct}%`;
    };

    const hide = () => el.classList.add('px-gone');

    /**
     * Await the module's real async startup steps, advancing the bar as each
     * settles, and stop short of 100 so `done()` owns the last step.
     *
     * A step that fails does not hold the screen: narration degrades to
     * captions and a missing model degrades to no model, both by design, so
     * neither is a reason to keep a learner looking at a bar.
     */
    const track = async (steps) => {
        const list = steps.filter(Boolean);
        if (!list.length) return;
        const span = (99 - pct) / list.length;
        await Promise.all(list.map((step) => Promise.resolve(step)
            .catch(() => {})
            .then(() => progress(pct + span))));
    };

    const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(cap);
        progress(100);
        // Two frames before the hold begins. start() only schedules the render
        // loop; it does not mean anything has been drawn yet, and uncovering an
        // empty canvas is the one thing this has to avoid.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setTimeout(() => {
                el.style.opacity = '0';
                // transitionend is the exact moment the fade finishes. The timer
                // is what covers a browser running with transitions turned off,
                // where it never fires at all. The screen has to reach
                // display:none and not merely opacity:0, or it stays in the
                // layout and silently swallows clicks and XR input.
                el.addEventListener('transitionend', (e) => {
                    if (e.target === el && e.propertyName === 'opacity') hide();
                });
                setTimeout(hide, FADE_MS + 100);
            }, HOLD_MS);
        }));
    };

    /** Surface a failed startup step on the screen rather than freezing the bar. */
    const fail = (message) => {
        if (finished) return;
        finished = true;
        clearTimeout(cap);
        // The inline script owns the error UI, so there is one implementation
        // of it and a bundle that never loaded can still use it.
        window.pxLoadFailed?.(message);
    };

    const cap = setTimeout(done, capMs);
    return { progress, track, done, fail };
}
