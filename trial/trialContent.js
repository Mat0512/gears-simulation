/**
 * Every learner-facing string the trial adds, and the only place a URL lives.
 *
 * This file is the reason js/ stays free of selling copy: shared code knows
 * what a lock is and nothing about what is being sold.
 */

/**
 * Where a learner goes to buy the full edition. One constant, one edit.
 *
 * Two forms because they are read by different things: `PREMIUM_URL` is handed
 * to window.open and needs the scheme, `PREMIUM_URL_SHOWN` is drawn on the card
 * and is easier to read and to type without it. Keep them in step.
 */
export const PREMIUM_URL = 'https://www.parallaxed.ph/contact';
export const PREMIUM_URL_SHOWN = 'www.parallaxed.ph/contact';

export const TRIAL = {
    url: PREMIUM_URL,
    urlShown: PREMIUM_URL_SHOWN,

    welcome: {
        title: 'FREE TRIAL',
        heading: 'Unlock the full workshop',
        body: [
            'Mesh a pair and change their teeth freely —',
            'the ratio is yours to explore.',
        ],
        includes: [
            'Idlers and gear trains of any length, not just a pair',
            'The full spec — module, pressure angle, thickness, bore',
            'The graded quiz, marked and returned to your LMS',
        ],
        cta: 'CONTINUE IN TRIAL',
        buy: 'GET FULL ACCESS',
    },

    blocked: {
        title: 'FULL EDITION',
        heading: 'That one is premium',
        cta: 'BACK TO THE TRIAL',
    },

    /**
     * What to call each locked control when a learner reaches for it. Keyed by
     * feature id so js/ never has to carry a display name for a paid feature.
     */
    featureNames: {
        'gears.count': 'A third gear — the idler',
        'gears.spec':  'The gear specification',
        'quiz':        'The graded quiz',
    },
};
