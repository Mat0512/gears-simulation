🦾 Three.js WebXR Gear Generator & Simulator (Meta Quest)
🎯 Product Goal

Build an immersive WebXR-based spur gear generator and simulator using Three.js, designed primarily for Meta Quest (Oculus) headsets. Users can create, position, assemble, and animate gears in a 3D VR environment, interacting via hand tracking or controllers, with all UI rendered as Three.js mesh-based panels inside the scene.

The application is fully client-side, framework-free, and intended for education, prototyping, and mechanical visualization.

1️⃣ Core Features
1.1 Spur Gear Generation

Support external spur gears only.

Adjustable parameters:

Number of teeth

Module (or Diametral Pitch)

Pressure angle

Gear thickness (Z depth)

Bore (center hole) diameter

Gear color / material

Behavior:

Real-time geometry updates when parameters change

Validation to prevent invalid or impossible gear values

Visual feedback when constraints are violated

Technical Requirements:

Gear geometry generated via:

THREE.Shape

THREE.ExtrudeGeometry

Involute tooth profile approximated mathematically

Geometry recalculated only when parameters change

2️⃣ 3D Workspace & XR Environment
2.1 WebXR Scene Setup

Three.js WebGLRenderer with renderer.xr.enabled = true

WebXR VR mode compatible with Meta Quest Browser

Floor-aligned reference space

VR entry button (WebXR standard)

Camera & Environment:

Perspective camera

Ground/grid plane for spatial reference

Ambient + directional lighting optimized for VR depth perception

3️⃣ Gear Placement & Assembly
3.1 Gear Interaction

Grab, move, and rotate gears in 3D space using:

Oculus controllers or

Native WebXR hand tracking

No physics engine; transformations are direct and deterministic

3.2 Snapping & Meshing

Automatic snap when gears are close enough to mesh

Snap distance based on pitch diameter

Maintain correct center-to-center distance

Rotation axes automatically aligned

3.3 Multi-Gear Systems

Support 20–30 gears in a single scene

Track connected gears via parent-child or graph-based relationships

Automatic:

Direction reversal

Speed ratio calculation

Synchronized rotation

Technical Notes:

Gears tracked in a central registry/array

Gear connections computed programmatically

No rigid-body physics or torque simulation

4️⃣ Animation & Simulation
4.1 Rotation Simulation

Play / Pause / Reset simulation

Adjustable input RPM for selected “driver” gear

Automatic propagation of RPM and direction to meshed gears

4.2 Visual Feedback

Smooth real-time rotation using requestAnimationFrame

Highlight selected gear

Optional visual overlays (toggleable):

Pitch circle

Gear center

Tooth count labels

5️⃣ In-Scene UI (Mesh-Based, No HTML)
5.1 Control Panel (3D Mesh UI)

All controls exist inside the 3D scene, rendered as Three.js meshes, not HTML.

Features:

Floating or wrist-mounted control panel

Buttons and sliders as 3D elements:

Add gear

Delete gear

Reset scene

Play / Pause simulation

Parameter controls for selected gear:

Teeth count

Module / DP

Thickness

Bore

Color

Interaction:

Ray-based selection (controller or hand ray)

Hover highlighting

Press / drag interactions

No DOM overlays in XR mode

5.2 Gear Info Panel (3D HUD)

Displayed as a floating info panel near the selected gear.

Displayed Information:

Teeth count

Pitch diameter

Module / DP

Current RPM

Rotation direction

Gear ratio (relative to connected gears)

Behavior:

Live updates during parameter edits and animation

Follows the selected gear or remains world-anchored

Readable at VR scale (comfort-first design)

6️⃣ Hand Tracking & Oculus Support
6.1 Input Support

Primary target: Meta Quest (Oculus)

Supported inputs:

Oculus Touch controllers

Native WebXR hand tracking (XRHand)

6.2 Hand Tracking Behavior

Use default WebXR hand tracking data

Track hand or joint poses (e.g., wrist or index tip)

No pinch gesture detection

No custom gesture recognition logic

Usage:

Hand ray or direct hand position replaces mouse cursor

Used for:

Selecting gears

Dragging gears

Interacting with 3D UI panels

7️⃣ Performance Requirements

Stable 60+ FPS on Meta Quest hardware

Efficient rendering for up to 30 gears

Geometry reuse for identical gear parameters

Minimal draw calls

Optimization Strategies:

Reuse BufferGeometry when possible

Avoid unnecessary geometry regeneration

Efficient animation loop tied to XR frame updates

8️⃣ Technical Stack & Constraints

Stack:

Three.js (r145+ recommended)

Vanilla JavaScript

WebXR API

Vite (HTTPS required for XR)

Project Structure:

/index.html      → Entry point (ES module)
/main.js         → Three.js + WebXR + XR input logic
/vite.config.js  → HTTPS + dev server config
/public/         → Static assets


Constraints:

Client-side only

No backend

No frameworks

No physics engine

9️⃣ Explicit Exclusions

❌ No file exports
❌ No monetization
❌ No sharing or collaboration
❌ No helical, bevel, or worm gears
❌ No physics-based torque or stress simulation

🔟 MVP Success Criteria

User can create accurate spur gears in VR

Gears snap, mesh, and rotate correctly

Speed ratios and directions are mathematically correct

All UI is usable inside VR

Hand tracking works reliably on Meta Quest

Scene remains stable and performant with multiple gears