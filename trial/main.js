import { GearSimulator } from '../js/GearSimulator.js';
import { setEdition } from '../js/edition/Edition.js';
import { captureExamLink } from '../js/examLink.js';
import { TRIAL_LOCKED } from './trialEdition.js';
import { OfferCard } from './OfferCard.js';
import { installLoadingScreen } from './loadingScreen.js';

/**
 * The free trial's entry point.
 *
 * The only difference from js/main.js is the edition: this one installs a set
 * of locked feature ids and an offer card to explain them. Everything else —
 * the workshop, the gears, the teeth counts — is the same code running
 * unmodified, which is the point. A trial built from a fork would drift from
 * the product it is selling.
 */
async function boot() {
    const loader = installLoadingScreen();

    let sim = null;
    let offer = null;

    // Set BEFORE the simulator is built: the parameter panel paints its locked
    // controls grey while constructing them, and that happens in the
    // GearSimulator constructor.
    setEdition({
        locked: TRIAL_LOCKED,
        onLocked: (id) => offer?.showBlocked(id),
    });

    try {
        // The link is captured and DISCARDED. Capturing still matters — it
        // takes the ids out of the address bar, so a shared headset does not
        // show the next learner the last one's identity — but the ids are not
        // passed on: a trial has no LMS behind it, and quiz mode would take
        // over the scene waiting for a paper that can never arrive.
        captureExamLink();

        const canvas = document.getElementById('canvas');
        sim = new GearSimulator(canvas);

        // The constructor is synchronous and blocks the main thread throughout,
        // so the bar could not have moved during it — this one bump is the
        // honest way to report it.
        loader.progress(90);

        offer = new OfferCard({
            // Ending the immersive session is what makes the link reachable —
            // see openPremiumPage.
            getSession: () => sim.renderer?.xr?.getSession?.() ?? null,
        });

        // The sandbox's opening gear, exactly as the full edition does.
        sim.addGear();

        loader.done();
        offer.showWelcome();
    } catch (err) {
        // A failed startup step belongs on the screen, not frozen behind a bar
        // that stopped moving with nothing to explain it.
        loader.fail(`Failed to load: ${err.message}`);
        throw err;
    }

    window.gearSimulator = sim;
}

boot();
