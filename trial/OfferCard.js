import { TRIAL } from './trialContent.js';

/**
 * OfferCard — the trial's call to action, as a DOM overlay.
 *
 * DOM rather than a 3D panel: this module has no panel base to build one on,
 * and its controls are already half DOM. Copying a card in the simulator's own
 * canvas idiom would be a second layout system to keep in step.
 *
 * It injects its own stylesheet and markup, so none of the four HTML files
 * needs editing and the full edition ships neither.
 *
 * WHAT THIS DOES NOT COVER: an immersive session. A DOM overlay is invisible
 * once the headset is presenting, so in VR a locked control has to speak for
 * itself — which is why the gates grey their buttons and mark them PREMIUM
 * rather than relying on this card. This is the flat page's surface, and the
 * flat page is where a prospect meets the trial first.
 */

const STYLE = `
.px-offer-backdrop {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(4, 6, 16, 0.72);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem; box-sizing: border-box;
    font-family: "Segoe UI", system-ui, sans-serif;
}
.px-offer-backdrop[hidden] { display: none; }
.px-offer {
    background: #0e1426; color: #e8f1ff;
    border: 1px solid rgba(120, 200, 170, 0.5);
    border-radius: 14px; padding: 1.5rem 1.6rem;
    max-width: 30rem; width: 100%;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
}
.px-offer .px-kicker {
    font-size: 0.72rem; letter-spacing: 0.18em;
    color: #9fe8c8; margin: 0 0 0.4rem;
}
.px-offer h2 { margin: 0 0 0.9rem; font-size: 1.35rem; color: #ffd56b; font-weight: 600; }
.px-offer p  { margin: 0 0 0.5rem; font-size: 0.95rem; line-height: 1.45; }
.px-offer ul { margin: 0.9rem 0 1.1rem; padding: 0; list-style: none; }
.px-offer li { font-size: 0.9rem; line-height: 1.5; padding-left: 1.2rem; position: relative; }
.px-offer li::before { content: "+"; position: absolute; left: 0; color: #5fcf9f; font-weight: 700; }
.px-offer .px-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.px-offer button {
    font: inherit; font-size: 0.9rem; cursor: pointer;
    border-radius: 8px; padding: 0.55rem 1rem; border: 1px solid transparent;
}
.px-offer .px-buy   { background: #1a7a4a; color: #fff; flex: 1 1 11rem; }
.px-offer .px-close { background: transparent; color: #b9cbe8; border-color: #33405e; flex: 1 1 9rem; }
.px-offer .px-url { margin: 0.9rem 0 0; font-size: 0.78rem; color: #7f9ccc; }
`;

/**
 * Leave the headset, then go to the page where the full edition is bought.
 *
 * Ending the session first is the whole trick. A WebXR `select` is not a DOM
 * user activation, so `window.open` from inside an immersive session is blocked
 * outright — and even when it is not, a headset has nowhere to put a new tab.
 *
 * Every step is guarded: a blocked popup returns null rather than throwing, a
 * hardened browser can throw outright, and `end()` rejects if the session is
 * already going away. None of that should take the card down.
 */
async function openPremiumPage(getSession) {
    const session = getSession?.();
    if (session) {
        try { await session.end(); } catch { /* already ending; carry on */ }
    }
    try {
        if (window.open(TRIAL.url, '_blank', 'noopener,noreferrer')) return;
    } catch { /* popup blocked or refused — fall through */ }
    try {
        window.location.assign(TRIAL.url);
    } catch (err) {
        console.warn('[trial] could not reach', TRIAL.url, err);
    }
}

export class OfferCard {
    /** @param {{ getSession?: () => (XRSession|null) }} [opts] */
    constructor({ getSession = () => null } = {}) {
        this.getSession = getSession;

        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.appendChild(style);

        this.root = document.createElement('div');
        this.root.className = 'px-offer-backdrop';
        this.root.hidden = true;
        this.root.innerHTML = `
            <div class="px-offer" role="dialog" aria-modal="true">
                <p class="px-kicker"></p>
                <h2></h2>
                <div class="px-body"></div>
                <div class="px-actions">
                    <button type="button" class="px-buy"></button>
                    <button type="button" class="px-close"></button>
                </div>
                <p class="px-url"></p>
            </div>`;
        document.body.appendChild(this.root);

        this._kicker = this.root.querySelector('.px-kicker');
        this._title = this.root.querySelector('h2');
        this._body = this.root.querySelector('.px-body');
        this._buy = this.root.querySelector('.px-buy');
        this._close = this.root.querySelector('.px-close');
        this.root.querySelector('.px-url').textContent = TRIAL.urlShown;

        this._buy.textContent = TRIAL.welcome.buy;
        this._buy.addEventListener('click', () => openPremiumPage(this.getSession));
        this._close.addEventListener('click', () => this.hide());
        // Clicking the backdrop dismisses, but a click inside the card must not
        // — otherwise selecting text closes the offer.
        this.root.addEventListener('click', (e) => {
            if (e.target === this.root) this.hide();
        });
    }

    showWelcome() {
        const c = TRIAL.welcome;
        this._kicker.textContent = c.title;
        this._title.textContent = c.heading;
        this._body.innerHTML =
            c.body.map((line) => `<p></p>`).join('')
            + `<ul>${c.includes.map(() => '<li></li>').join('')}</ul>`;
        // Set as TEXT, never as markup — the copy is ours today, and a card
        // that interpolates HTML is one edit away from not being.
        this._body.querySelectorAll('p').forEach((el, i) => { el.textContent = c.body[i]; });
        this._body.querySelectorAll('li').forEach((el, i) => { el.textContent = c.includes[i]; });
        this._close.textContent = c.cta;
        this.root.hidden = false;
    }

    /** @param {string} featureId the locked id the learner just reached for */
    showBlocked(featureId) {
        const c = TRIAL.blocked;
        const name = TRIAL.featureNames[featureId] ?? 'That control';
        this._kicker.textContent = c.title;
        this._title.textContent = c.heading;
        this._body.innerHTML = '<p></p><p></p>';
        const [first, second] = this._body.querySelectorAll('p');
        first.textContent = `${name} is part of the full edition.`;
        second.textContent = 'Everything else stays open — keep exploring.';
        this._close.textContent = c.cta;
        this.root.hidden = false;
    }

    hide() { this.root.hidden = true; }

    get isOpen() { return !this.root.hidden; }
}
