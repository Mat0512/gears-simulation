# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive spur gear simulator with WebXR hand tracking support for Meta Quest. Users can grab and move gears using hand tracking in VR, replacing traditional mouse/cursor interaction.

## Development

**Vite-based setup** with SSL (required for WebXR).

```bash
# Install dependencies
npm install

# Start dev server (HTTPS)
npm run dev

# Build for production
npm run build

# Tests (node --test over tests/)
npm test

# The free-trial edition
npm run dev:trial
npm run build:trial    # -> dist-trial/ (relative base; runs at any path)
npm run preview:trial
```

Access from Quest: `https://<your-local-ip>:5173`

## Architecture

```
main.js
├── init() → Scene, Camera, Renderer, Lights, Floor
├── setupHands() → OculusHandModel for both hands
├── setupWebXR() → Session with hand-tracking feature
├── createGear() → ExtrudeGeometry with tooth shape
└── render loop
    ├── updateHandInteraction() → Proximity-based grab/release
    └── Gear rotation animation
```

### Hand Interaction Model

- Uses `OculusHandModel` from Three.js (no manual joint iteration)
- `hand.getWorldPosition()` gives hand position each frame
- Gear grabbed when hand enters `GRAB_RADIUS + pitchRadius`
- Gear released when hand moves too far from gear center
- Offset preserved so gear doesn't snap to hand center

## Project Structure

```
gears-module/
├── index.html        # Entry point with VR button
├── main.js           # Three.js + WebXR + hand tracking
├── vite.config.js    # Vite with SSL plugin
├── package.json      # Dependencies
├── public/           # Static assets
└── js/               # Legacy non-VR implementation
    ├── GearGeometry.js
    └── GearSimulator.js
```

## Technologies

- Three.js r150 (WebXR, OculusHandModel)
- Vite 5 with @vitejs/plugin-basic-ssl
- WebXR Hand Tracking API

## Key Constants

- `GRAB_RADIUS`: 0.05m (5cm) - distance threshold for grabbing
- Gear `module`: 0.015m - scales gear size for VR
- Camera height: 1.6m (eye level)

## The free trial

`trial/` is a second Vite root sharing `js/` and `public/` with the full build,
as in the screws and light modules. Output goes to `dist-trial/` (gitignored),
with a RELATIVE base so the folder runs wherever it is dropped — the only thing
it needs is the URL's trailing slash.

**TEETH IS NEVER LOCKED, in any edition.** The ratio of teeth sets the ratio of
turns, and that is the whole subject. A trial that cannot change tooth counts
cannot demonstrate the module — it would be a screenshot rather than proof the
simulation is real. `tests/edition.test.mjs` asserts no feature id ever names
teeth, so this cannot be given away by accident.

What the trial limits instead:

```
gears.count   a train of three — a driver, an idler and a driven wheel, which
              is the smallest train that shows an idler reverses direction
              without changing the ratio
gears.spec    module, pressure angle, thickness, bore — the manufacturing spec,
              which is depth rather than lesson
quiz          the LMS-graded exam
```

Four things are load-bearing:

- **The default is everything unlocked.** The full edition installs no edition,
  so it runs exactly as it did before any of this existed.
- **Unknown ids fail OPEN.** A typo leaves a premium control reachable rather
  than locking a lesson control. The drift test greps `js/` in BOTH directions
  — every gate is declared, and every declared feature is actually gated.
- **The gates are on the ACTION, not the button.** `addGear()` checks the count
  and `adjustGearParam()` checks the parameter, because gears are added from the
  3D panel, from the DOM control and once at start-up, and a gate on each is a
  gate someone forgets.
- **A locked control is grey from the start.** `createParamControl` paints the
  spec buttons grey when the edition locks them; a lit button that refuses to
  work reads as a broken panel rather than a paid feature.

**The offer card is DOM, so it is invisible in an immersive session.** This
module has no panel base to build a 3D card on, and its controls are already
half DOM. In VR a locked control speaks for itself by being grey; the flat page
is where a prospect meets the trial first.

## XR panel design

Two modules, one palette. `css/style.css` defines the tokens; `js/xr/theme.js`
mirrors them as numbers because three.js materials want numbers and a
stylesheet cannot be read from a shader. **If one moves, move the other.**
`ROLE` is the layer above: a button's colour says what the button *is*
(primary, neutral, success, warning, danger, locked), so the choice is never
made by eye.

**Type comes from the workspace, not from this module.** `PX_PER_M` is 1024,
which is what physics, particle, light and periodic-table all use — at gears'
old 1600 a "30px" font here and a "30px" font there were different sizes in the
world. `TYPE` mirrors their scale (title 36 shrinking to 18, buttons 30 to 15,
body 30) in bold sans-serif; Arial regular at this size is thin to read at an
angle. `fitText()` shrinks a label that will not fit rather than letting it
clip, because a clipped label is worse than a smaller one — the learner cannot
tell what it lost.

**The panel's height is derived, never chosen.** `createFlow()` lays rows out
from the top edge downward and `PANEL.height` is what they come to plus padding.
The old layout began at a hand-picked `yPos = 0.48` and stepped by a mixture of
`rowSpacing`, `buttonSpacing + 0.02` and bare literals, none of it tied to the
panel — which is how the content came to stop at y=-0.355 against a bottom edge
at -0.65, leaving almost a quarter of the panel empty and making the whole thing
read as oversized. It is 0.95 now, 27% shorter, with 5mm of slack.

**One content width per panel.** `EDGE`/`CONTENT_W` is the panel minus its
padding, and every row spans exactly it — the full-width buttons, the animation
trio, the RPM stepper, the parameter rows. They used to end at 0.225, 0.215 and
0.300, which is what made the panel look ragged however neat each row was alone.
Section headers are left-aligned across the same width, matching the DOM panel.

**Panels are placed as one arrangement.** Side panels mirrored at ±`sideX` with
equal toe-in, their TOPS on a shared line at eye height; the strip centred under
the gear scene. All of it in `LAYOUT`.

### The layering rules — why a label punched a hole through its own card

A panel is a stack of COPLANAR quads and three.js orders transparent objects by
each object's ORIGIN. Head-on that matches the stack; off-axis it does not, so a
label near the edge sorts *behind* the background it belongs to — and a
transparent material still writes depth by default, so the background then
punches a rectangle clean through the label. It reads as a transparency bug. It
is a depth bug, and it worsens the further a panel is turned away. These are
toed in 28°.

`js/xr/panelLayer.js` applies the same two rules the physics and periodic-table
modules use (`PANEL_LAYERING_FIX.md` at the workspace root):

- **The ground is OPAQUE** (`makePanelGround`), so it leaves the transparent
  pass; the opaque pass runs first and its depth then shields the panel. The
  grounds were `transparent: true, opacity: 0.9`.
- **Every mesh stacked on it** gets `depthWrite: false` and a `renderOrder` from
  its own height in the stack. **Author stacking in millimetres of z** — 0.001
  is one layer up, 0.011 is eleven — and it comes back as draw order. Nothing to
  set at the call site. Z accumulates through nested groups, so a button's label
  sorts above the button it sits on.
- `layerPanel()` **wraps `add`** rather than walking the children once, so a
  mesh built later is covered too.
- Grounds are tracked in a module-private **WeakSet, never a `userData` flag** —
  `Object3D.clone()` deep-copies userData, so a cloned ground would inherit the
  exemption and go straight back to punching holes. `tests/panelLayer.test.mjs`
  pins all of this, including the clone case.
