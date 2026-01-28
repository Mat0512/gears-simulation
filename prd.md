Three.js Gear Generator & Simulator (Vanilla JS)
🎯 Product Goal

Build a web-based interactive spur gear generator and simulator using Three.js, allowing users to visually design, place, and animate gears in real time for learning, prototyping, and demonstration purposes. No frameworks or backend required, fully client-side.

1️⃣ Core Features
1.1 Spur Gear Generation

Create external spur gears only

Adjustable parameters:

Number of teeth

Module / diametral pitch

Pressure angle

Gear thickness (3D depth)

Bore (center hole) diameter

Gear color

Instant geometry updates on parameter changes

Input validation (no impossible values)

Technical Implementation:

Generate gear geometry using Three.js Shape + ExtrudeGeometry

Approximate involute profile mathematically

2️⃣ Gear Placement & Assembly
2.1 3D Workspace

Three.js WebGLRenderer

Perspective camera with orbit controls

Grid plane for alignment

Zoom, pan, rotate camera

Lighting for realistic 3D view (ambient + directional)

2.2 Gear Positioning

Drag & drop gears in 3D scene

Snap-to-mesh when gears are close to engage

Manual adjustment of X, Y, Z positions

Rotation alignment control

2.3 Multi-Gear Systems

Support multiple gears in one scene

Parent-child relationship for connected gears

Automatic direction reversal when gears mesh

Maintain correct center distance based on pitch diameter

Technical Implementation:

Track gear meshes in an array

Update positions and rotations per frame

Compute gear ratio and rotation direction programmatically

3️⃣ Animation & Simulation
3.1 Rotation Simulation

Play / Pause / Reset animation

Adjustable input RPM for selected gear

Automatic speed ratio calculation for connected gears

Clockwise / counter-clockwise handling

3.2 Visual Feedback

Smooth real-time rotation (via requestAnimationFrame)

Highlight selected gear

Optional display toggles:

Pitch circle

Gear center

Teeth count labels

Technical Implementation:

Animate rotation by updating mesh.rotation.z per frame

Apply speed multiplier from gear ratio

4️⃣ Measurement & Info Panel

Display gear info for selected gear:

Teeth count

Pitch diameter

Module / DP

RPM

Rotation direction

Gear ratio display for meshed gears

Live updates during parameter changes

Technical Implementation:

Simple HTML overlay (div) for parameters

Update DOM elements dynamically in JS

5️⃣ UI / UX Requirements

Controls Panel:

Add gear

Delete gear

Reset scene

Parameter inputs (number, slider, color picker)

Click to select gear

Hover highlighting

Keyboard shortcuts for quick actions (optional)

Light & dark mode toggle

Minimal, engineering-style UI

Technical Implementation:

Vanilla HTML + CSS + JS

Event listeners for clicks, inputs, sliders

6️⃣ Performance Requirements

Smooth 60 FPS interaction

Support 20–30 gears in one scene

Efficient reuse of geometries

Lightweight, no external frameworks

Technical Implementation:

Reuse BufferGeometry for identical gears

Optimize render loop using requestAnimationFrame

7️⃣ Technical Stack & Constraints

Three.js (r145+ recommended)

Vanilla JS, HTML, CSS only

Client-side only (no backend)

Gear profiles computed mathematically

No physics engine (basic rotation only)

Exclusions:
❌ No exports
❌ No monetization
❌ No sharing
❌ No advanced gear types
❌ No physics-based torque simulation

8️⃣ MVP Success Criteria

User can create spur gears with correct geometry

Gears mesh and rotate correctly

Speed ratios are accurate

UI is intuitive and responsive

Scene is stable with multiple gears