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
 * Canvas density, in pixels per metre.
 *
 * 1024 is what physics, particle, light and periodic-table all use. gears was
 * at 1600, which is not wrong in itself but means a "30px" font here and a
 * "30px" font there are different sizes in the world — and every type decision
 * in this file was being made against a different ruler from the rest of the
 * workspace.
 */
export const PX_PER_M = 1024;

/**
 * The type scale, in canvas pixels at PX_PER_M.
 *
 * Taken from the sibling modules rather than invented: they set titles at 36
 * shrinking to 18, button labels in the low 30s shrinking to about 15, and body
 * text at 30. Bold sans-serif throughout — a headset panel is read at a glance
 * and at an angle, and Arial regular at this size is thin.
 */
export const TYPE = {
    title:        { preferred: 36, min: 18 },
    sectionLabel: 26,
    button:       { preferred: 30, min: 15 },
    value:        28,
    body:         30,
};

export const FONT_STACK = 'sans-serif';

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
    /**
     * Derived from the rows, not chosen. At 1.3 the content ran out at y=-0.355
     * against a bottom edge at -0.65, so nearly a quarter of the panel was
     * empty and the whole thing read as oversized. The rows below come to
     * 0.865, plus padding is 0.945 — so this is the content, and nothing more.
     */
    height: 0.95,
    /** Space between the panel edge and any content. */
    padding: 0.04,
};

/** Row heights and the gaps between them, so the flow is one description. */
export const ROW = {
    button: 0.05,
    control: 0.045,
    sectionLabel: 0.04,
    title: 0.06,
    /** Between rows inside a section. */
    gap: 0.013,
    /** Before a new section heading. */
    sectionGap: 0.030,
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

/**
 * Lay rows out from the top of the panel downward.
 *
 * The positions used to be a running `yPos` starting at a hand-picked 0.48 and
 * decremented by a mixture of `rowSpacing`, `buttonSpacing + 0.02` and bare
 * numbers. Nothing tied that to the panel's height, which is how the content
 * came to stop 0.3 m short of the bottom edge without anyone noticing.
 */
export function createFlow(height = PANEL.height, padding = PANEL.padding) {
    let cursor = height / 2 - padding;
    return {
        /** Centre y for a row of this height, advancing past it. */
        row(rowHeight, gapBefore = 0) {
            cursor -= gapBefore;
            const centre = cursor - rowHeight / 2;
            cursor -= rowHeight;
            return centre;
        },
        /** Metres of unused panel below the last row. Should be near zero. */
        get slack() { return cursor - (-height / 2 + padding); },
    };
}

/**
 * Largest size at or below `preferred` that fits `text` into `w` canvas pixels,
 * never going under `minimum`.
 *
 * The sibling modules all have this. Without it a label is simply clipped, and
 * a clipped label on a headset panel is worse than a smaller one — the learner
 * cannot tell whether it says "Reset" or "Reset Rotation".
 */
export function fitText(ctx, text, w, preferred, minimum) {
    let size = preferred;
    ctx.font = `bold ${size}px ${FONT_STACK}`;
    while (size > minimum && ctx.measureText(String(text)).width > w * 0.92) {
        size -= 1;
        ctx.font = `bold ${size}px ${FONT_STACK}`;
    }
    return size;
}

/**
 * The pixel size out of a CSS font string.
 *
 * `parseInt(font)` looks like it does this and does NOT: parseInt('bold 30px
 * sans-serif') is NaN, because the string starts with a word. Any arithmetic on
 * that NaN spreads — a NaN line height gives a NaN baseline, and fillText at a
 * NaN y draws NOTHING AT ALL. A whole multi-line block disappears in silence,
 * with no error anywhere.
 *
 * The particle module hit this exact fault and recorded it; this is the same
 * fix, kept here so both canvases in this module read a size the same way.
 */
export function fontSizePx(font, fallback = 16) {
    const match = /(\d+(?:\.\d+)?)px/.exec(String(font));
    return match ? parseFloat(match[1]) : fallback;
}
