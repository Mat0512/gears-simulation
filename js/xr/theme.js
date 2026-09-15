/**
 * The XR panels' design tokens, and the layout grid they sit on.
 *
 * The colours are the SAME ONES css/style.css already defines as custom
 * properties. They are repeated here as numbers because three.js materials want
 * numbers and a stylesheet cannot be read from a shader — but they are a
 * mirror, not a second palette. If one moves, move the other.
 *
 * Before this existed the XR code used seven of the eleven tokens plus a
 * handful of ad-hoc greys, a purple that appears nowhere in the CSS, and a
 * green that was not the success token. That is how a panel ends up looking
 * assembled rather than designed.
 */

/** Mirrors the :root block in css/style.css. */
export const COLOR = {
    bgPrimary:     0x1a1a2e,   // --bg-primary   (the scene behind everything)
    bgSecondary:   0x16213e,   // --bg-secondary (a panel's own inset rows)
    bgPanel:       0x0f3460,   // --bg-panel
    border:        0x2a4a6a,   // --border
    accent:        0x4a90d9,   // --accent
    accentHover:   0x5ba0e9,   // --accent-hover
    success:       0x4caf50,   // --success
    warning:       0xff9800,   // --warning
    danger:        0xf44336,   // --danger
};

/** Text, as CSS strings — these go to a 2D canvas, not a material. */
export const INK = {
    primary:   '#e8e8e8',      // --text-primary
    secondary: '#a0a0a0',      // --text-secondary
    accent:    '#4a90d9',      // --accent
};

/**
 * What a button's colour MEANS, so the choice is never made by eye again.
 *
 * `neutral` replaces the run of 0x555555 / 0x666666 / 0x9e9e9e greys, which
 * differed by a few points for no reason anyone recorded. `locked` is the muted
 * state a trial paints a withheld control.
 */
export const ROLE = {
    primary: COLOR.accent,       // the thing you came to press — Add Gear
    neutral: 0x24456b,           // steps, toggles: present, not shouting
    success: COLOR.success,      // Play
    warning: COLOR.warning,      // Pause, Reset Scene
    danger:  COLOR.danger,       // Delete
    locked:  0x2b3442,           // withheld by the edition
};

/**
 * The layout grid for the left control panel.
 *
 * ONE content width. Every row — the full-width buttons, the animation row and
 * the parameter rows — spans exactly this, so they share a left and a right
 * edge. They previously ended at 0.225, 0.215 and 0.300 respectively, which is
 * what made the panel look ragged no matter how neat each row was on its own.
 */
export const PANEL = {
    width: 0.65,
    height: 1.3,
    /** Space between the panel edge and any content. */
    padding: 0.04,
};

/** Half the content width: every row runs from -EDGE to +EDGE. */
export const EDGE = PANEL.width / 2 - PANEL.padding;   // 0.285
export const CONTENT_W = EDGE * 2;                      // 0.57

/** Gap between side-by-side controls in a row. */
export const GAP = 0.012;

/**
 * Where the panels sit, as one arrangement rather than three guesses.
 *
 * The gear scene sits at (0, 1.0, -0.5) in XR, so the panels share that plane
 * and flank it. The two side panels are MIRRORED — same x magnitude, same
 * toe-in — and their TOPS share a line at eye height, which is the horizontal
 * the eye actually picks up. Before this the left was at x=-1.0 turned 30° and
 * the right at x=+0.8 turned 22.5°, with a comment claiming 30°.
 */
export const LAYOUT = {
    /** Eye height. Both side panels' top edges land here. */
    topLine: 1.60,
    sideX: 0.92,
    z: -0.5,
    /** Toe-in for the side panels, mirrored. */
    toeIn: Math.PI * 28 / 180,
    /** The bottom strip leans back toward the user rather than lying flat. */
    stripTilt: Math.PI * 20 / 180,
    stripY: 0.68,
    stripZ: -0.46,
};

/** Centre y for a panel of this height whose top sits on the shared line. */
export const centreForTop = (height) => LAYOUT.topLine - height / 2;
