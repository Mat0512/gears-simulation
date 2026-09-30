import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PANEL, ROW, EDGE, CONTENT_W, GAP, PX_PER_M, TYPE, FONT_STACK,
    createFlow, fitText, fontSizePx, css, COLOR,
} from '../js/xr/theme.js';

// A 2D context stand-in: fitText only ever sets `font` and measures. Widths are
// a rough Arial-like average, which is enough to exercise the shrink loop.
function stubCtx() {
    return {
        font: '',
        measureText(text) {
            const px = fontSizePx(this.font);
            return { width: String(text).length * px * 0.55 };
        },
    };
}

test('fontSizePx reads a size out of a bold font string', () => {
    // THE bug this exists for: parseInt('bold 30px sans-serif') is NaN, a NaN
    // line height gives a NaN baseline, and fillText at a NaN y draws NOTHING —
    // silently. It blanked the info panel's body while its single-line title,
    // which never touches lineHeight, kept rendering.
    assert.equal(fontSizePx('bold 30px sans-serif'), 30);
    assert.equal(fontSizePx('14px Arial'), 14);
    assert.equal(fontSizePx('italic bold 12.5px serif'), 12.5);
});

test('fontSizePx never returns NaN, whatever it is handed', () => {
    for (const font of ['', 'sans-serif', 'bold sans-serif', undefined, null]) {
        const size = fontSizePx(font);
        assert.ok(Number.isFinite(size) && size > 0,
            `${JSON.stringify(font)} produced ${size}, which would draw nothing`);
    }
});

test('every font in the type scale survives being parsed back', () => {
    const fonts = [
        `bold ${TYPE.title.preferred}px ${FONT_STACK}`,
        `bold ${TYPE.sectionLabel}px ${FONT_STACK}`,
        `bold ${TYPE.button.preferred}px ${FONT_STACK}`,
        `bold ${TYPE.body}px ${FONT_STACK}`,
    ];
    for (const font of fonts) {
        assert.ok(Number.isFinite(fontSizePx(font) * 1.4),
            `${font} gives a NaN line height`);
    }
});

test('fitText shrinks to fit and stops at the minimum', () => {
    const ctx = stubCtx();
    const roomy = fitText(ctx, 'OK', 400, TYPE.button.preferred, TYPE.button.min);
    assert.equal(roomy, TYPE.button.preferred, 'given room, use the full size');

    const cramped = fitText(ctx, 'A very long button label indeed', 60,
        TYPE.button.preferred, TYPE.button.min);
    assert.ok(cramped < TYPE.button.preferred, 'a long label must shrink');
    assert.ok(cramped >= TYPE.button.min, 'but never below the floor');
});

test('the flow lays rows downward and ends inside the panel', () => {
    const flow = createFlow();
    const first = flow.row(ROW.title);
    const second = flow.row(ROW.button, ROW.gap);
    assert.ok(second < first, 'rows descend');

    for (let i = 0; i < 2; i++) flow.row(ROW.button, ROW.gap);
    for (const rows of [1, 1, 5]) {
        flow.row(ROW.sectionLabel, ROW.sectionGap);
        for (let i = 0; i < rows; i++) flow.row(ROW.control, ROW.gap);
    }
    assert.ok(flow.slack >= 0,
        `content overflows the panel by ${(-flow.slack * 1000).toFixed(0)}mm`);
    assert.ok(flow.slack < 0.06,
        `${(flow.slack * 1000).toFixed(0)}mm of empty panel — size it to the content`);
});

test('the density is the one the other modules use', () => {
    // physics, particle, light and periodic-table all draw at 1024 px/m. At a
    // different density the same "30px" is a different size in the world.
    assert.equal(PX_PER_M, 1024);
});

test('a parameter row fits between the label and the panel edge', () => {
    const W = { '+': 584, '-': 333, '.': 278, '0': 556, '5': 556, '1': 556 };
    const fit = (s) => [...s].reduce((t, c) => t + (W[c] ?? 556), 0)
        / 1000 * TYPE.button.preferred / PX_PER_M + 0.022;
    const strip = ['-5', '-0.5', '+0.5', '+5'].reduce((t, l) => t + fit(l), 0)
        + 0.08 + GAP * 4;
    const startsAt = EDGE - strip;
    assert.ok(startsAt > -0.165,
        `the widest strip starts at ${startsAt.toFixed(3)} and would overrun the label`);
    assert.ok(strip <= CONTENT_W, 'a row cannot be wider than the content width');
});


test('css() gives back the palette token as a string, padded', () => {
    assert.equal(css(COLOR.success), '#4caf50');
    assert.equal(css(0x0a0a1a), '#0a0a1a', 'a leading zero survives');
    // The canvas side must never carry its own literal — that is how a panel
    // ends up a green that is not the token.
    assert.equal(css(COLOR.success).length, 7);
});

test('nobody passes metres to fontSizePx', async () => {
    // It READS a px size out of a font string; it does not convert. Given a
    // number it silently returns the fallback, so every line on a card gets
    // the same size and they stack on each other. It cost a headset pass on
    // the HOW TO USE card, 2026-09-30.
    assert.equal(fontSizePx(0.026), 16, 'the trap itself');
    assert.equal(fontSizePx('bold 26px sans-serif'), 26);

    const { readdir, readFile } = await import('node:fs/promises');
    const roots = ['js', 'js/xr', 'js/tour', 'js/content', 'js/edition'];
    for (const dir of roots) {
        for (const name of await readdir(dir)) {
            if (!name.endsWith('.js')) continue;
            const src = await readFile(`${dir}/${name}`, 'utf8');
            const bad = src.match(/fontSizePx\(\s*[0-9.]/g);
            assert.equal(bad, null, `${dir}/${name} passes a number to fontSizePx`);
        }
    }
});
