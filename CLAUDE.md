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
