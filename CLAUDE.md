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
