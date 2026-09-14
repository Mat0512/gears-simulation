# 3D Gear Simulator — User Manual

Complete guide to building, connecting, and simulating spur gear trains in 2D and immersive VR.

## Table of Contents

- Chapter 1 — Overview
  - 1.1 What is the Gear Simulator?
  - 1.2 Interface Layout
  - 1.3 Theme Toggle
- Chapter 2 — Gear Fundamentals
  - 2.1 Gear Parameters
  - 2.2 Adding Gears
  - 2.3 Connecting Gears (Auto-Snap)
  - 2.4 Gear Ratio & Speed Propagation
- Chapter 3 — Desktop Controls
  - 3.1 Selecting Gears
  - 3.2 Moving Gears (XY and Z-Axis)
  - 3.3 Camera Controls
  - 3.4 Left Control Panel
  - 3.5 Right Info Panel
  - 3.6 Animation Playback
  - 3.7 Display Options
- Chapter 4 — Error States & Feedback
  - 4.1 Module Mismatch
  - 4.2 Gear Jamming
  - 4.3 Gear Overlap
  - 4.4 Sound Effects
- Chapter 5 — VR / XR Mode
  - 5.1 Entering and Exiting VR
  - 5.2 Hand Gestures
  - 5.3 VR Floating Panels
  - 5.4 Moving Gears in VR
- Chapter 6 — Quiz Mode
  - 6.1 Activating Quiz Mode
  - 6.2 Quiz Flow
  - 6.3 Question Types & Validation
- Chapter 7 — Quick Reference
  - 7.1 Desktop Shortcuts
  - 7.2 VR Controls Summary
  - 7.3 Gear Parameter Reference

## Chapter 1 — Overview

### 1.1 What is the Gear Simulator?

The **3D Gear Simulator** is an interactive browser application for building and animating spur gear trains. It uses mathematically precise involute tooth profiles and real gear physics to simulate RPM, gear ratios, and rotation direction through connected gear chains.

**Build**

Add gears with custom teeth, module, and size. Drag them together to snap and mesh automatically.

**Simulate**

Set input RPM, press Play. Watch speed and direction propagate through the entire gear train.

**Analyse**

Read live gear ratios, output RPM, rotation direction, and connection count in the info panel.

### 1.2 Interface Layout

The application is divided into three areas:

- **Left Panel** — Gear Controls (manage gears, animation, parameters, display)
- **Centre** — 3D Canvas (the gear scene with an Enter VR button)
- **Right Panel** — Gear Info (live data for the selected gear)

**Left Panel Sections:**

- Manage Gears: Add Gear | Delete | Reset Scene | Select gear color
- Animation: Input RPM | Play | Pause | Reset
- Gear Parameters: Teeth | Module | Pressure Angle | Thickness | Bore Diameter | Color picker (used when clicking Add Gear)
- Position: X | Y | Z coordinates (auto-updates on drag)
- Display: Pitch Circle | Center Marker | Theme Toggle

**Right Panel — Gear Info (example):**

| Field | Value |
|---|---|
| Gear | #1 |
| Teeth | 30 |
| Pitch Dia. | 60 mm |
| Module | 2 |
| RPM | 30.0 |
| Direction | CW |
| Gear Ratio | 30:15 |
| Connected | 1 gear |

### 1.3 Theme Toggle

Click **Toggle Theme** at the bottom of the left panel to switch between:

- **Dark Mode** (default — deep navy background)
- **Light Mode** (white/gray background)

Both modes preserve all functionality.

## Chapter 2 — Gear Fundamentals

### 2.1 Gear Parameters

| Parameter | Default | Range | What it controls |
|---|---|---|---|
| Teeth | 20 | 8 – 100 | Number of teeth. More teeth = larger gear. Must match module to mesh. |
| Module | 2 mm | 0.5 – 10 | Tooth size scale. Two gears must share the same module to mesh. |
| Pressure Angle | 20° | 14.5 – 25° | Contact angle of teeth. 20° is standard. |
| Thickness | 5 mm | 1 – 20 | Depth of the gear (extrusion width). |
| Bore Diameter | 5 mm | 1 – 20 | Diameter of the center hole (shaft size). |
| Color | #4a90d9 | Any color | Visual color of the gear in the 3D view. |

**Key rule:** Two gears can only mesh if their Module values are identical (within ±0.001). If modules differ, the snap will be blocked and an error is shown.

### 2.2 Adding Gears

1. Configure the desired parameters in the Gear Parameters section of the left panel.
2. Click **Add Gear**. The new gear appears in the scene, offset from existing gears.
3. The new gear is automatically selected (green emissive glow).
4. Drag it into position. Parameters can be changed before or after adding.

### 2.3 Connecting Gears (Auto-Snap)

Gears connect automatically when dragged within meshing range. No manual "connect" step is needed.

- **Too Far — No Snap:** gap > 5 units between gears, no connection forms.
- **In Range — Snapping:** ~50 units apart (ideal), alignment begins.
- **Meshed — Rotating:** gears locked at correct mesh distance, rotate in opposite directions with speed ratio applied.

Example: 20T (CW, 30 RPM) meshed with 10T → 10T rotates CCW at 60 RPM.

### 2.4 Gear Ratio & Speed Propagation

When gears are connected, speed propagates through the chain using:

> RPM₂ = RPM₁ × (Teeth₁ ÷ Teeth₂)

**Example Chain:**

| Gear | Teeth | RPM | Direction |
|---|---|---|---|
| Driver | 30 | 30 | CW |
| Gear 2 | 15 | 60 | CCW |
| Gear 3 | 20 | 45 | CW |

30 × (30÷15) = 60   ·   60 × (15÷20) = 45

**Rules:**

- More teeth on output = slower speed, more torque
- Fewer teeth on output = faster speed, less torque
- Meshed gears always rotate in opposite directions
- Speed cascades through the entire connected chain (BFS)

## Chapter 3 — Desktop Controls

### 3.1 Selecting Gears

- Left-click a gear → selects it (green glow + info panel updates)
- Left-click empty canvas → deselects
- Hover over a gear → subtle blue-gray highlight appears

### 3.2 Moving Gears (XY and Z-Axis)

- Left-click + drag → moves gear in the XY plane
- Shift + drag → moves gear along the Z-axis (depth)
- X/Y/Z fields update live as you drag
- Snap check runs on every move; gears auto-connect when close enough

### 3.3 Camera Controls

- Middle-mouse drag → orbit camera around the scene
- Scroll wheel → zoom in / out (range: 20 – 500 units)
- Camera damping (0.05) gives a smooth, inertial feel

### 3.4 Left Control Panel

**Manage Gears:** Add Gear | Delete Selected | Reset Scene | Gear Color: #4a90d9

**Animation:** Input RPM: 30 | Play | Pause | Reset Rot.

**Gear Parameters:** Teeth: 20 | Module: 2 | Pressure Angle: 20° | Thickness: 5 mm | Bore Dia.: 5 mm

**Position** (auto-updates on drag): X: 0.00 | Y: 0.00 | Z: 0.00 — Drag gear to move. Shift+drag for Z-axis.

**Display:** Pitch Circle | Center Marker | Toggle Theme

### 3.5 Right Info Panel

Click any gear to see its live data:

| Field | Description |
|---|---|
| Gear #ID | Unique identifier assigned when gear was added |
| Teeth | Number of teeth as configured |
| Pitch Diameter | Teeth × Module (mm) — calculated automatically |
| Module | Current module value |
| RPM | Live rotation speed (updates during Play) |
| Direction | CW (clockwise) or CCW (counter-clockwise) |
| Gear Ratio | Ratio to each connected gear (e.g. "30:15") |
| Connected | Number of directly meshed gears |

**Error states:** The info panel background changes colour when a problem is detected — red (module mismatch), orange (jamming), or purple (overlap).

### 3.6 Animation Playback

1. Set **Input RPM** (range: 1–1000)
2. Click **Play** — all connected gears start rotating
3. Click **Pause** — rotation stops, angles are preserved
4. Click **Reset Rotation** — all gears return to 0°

### 3.7 Display Options

**Pitch Circle:** Tick "Show Pitch Circle" to draw a dashed green circle around each gear at the theoretical pitch diameter — the ideal meshing contact radius. Turns yellow on the selected gear.

**Center Marker:** Tick "Show Center" to place a small red sphere at the exact rotational centre of each gear. Useful for verifying gear spacing.

**Theme Toggle:** Click "Toggle Theme" to switch between dark (navy) and light (white) UI. The 3D canvas adapts its background colour accordingly.

**Pitch Diameter formula:**

> Pitch Diameter = Teeth × Module
>
> Example: 20 teeth × module 2 = 40 mm

Two gears mesh at exactly: (PitchRadius₁ + PitchRadius₂) centre distance

## Chapter 4 — Error States & Feedback

### 4.1 Module Mismatch

- **Cause:** Two gears with different Module values are dragged together.
- **Visual:** Gear turns red.
- **Message:** "Gears incompatible — modules don't match"
- **Sound:** incompatible-gear.mp3
- **Fix:** Move apart, or change both gears to the same module.

### 4.2 Gear Jamming (Odd Cycle)

- **Cause:** Connecting gears would form a closed loop with an odd number of meshes (e.g. connecting A–B–C–A creates a locked rotation).
- **Visual:** Gear turns orange.
- **Message:** "Gear jamming! Locked gear train cycle."
- **Sound:** jammed-gear.mp3
- **Fix:** Move gear to break the cycle. Play is disabled while jamming exists.

### 4.3 Gear Overlap

- **Cause:** Gears pushed closer than 90% of ideal mesh distance.
- **Visual:** Gear turns purple.
- **Message:** "Gears overlapping! Move gear further apart."
- **Sound:** overlapping-gear.mp3
- **Fix:** Drag gear further away until overlap clears.

### 4.4 Sound Effects

| Sound File | Trigger |
|---|---|
| play-gear.mp3 | Clicking Play — gear rotation begins |
| place-gear.mp3 | Successful gear snap-to-mesh during drag |
| incompatible-gear.mp3 | Module mismatch detected during drag |
| jammed-gear.mp3 | Jamming / odd cycle detected |
| overlapping-gear.mp3 | Gears pushed too close together |
| introduction-gear.mp3 | Entering VR mode |

## Chapter 5 — VR / XR Mode

### 5.1 Entering and Exiting VR

1. Open the app in a WebXR-compatible browser on a Meta Quest headset.
2. Click the **Enter VR** button at the bottom-centre of the page.
3. The 2D desktop panels hide; 3D floating panels appear in the VR world.
4. Intro sound plays; scene brightens for clear visibility in passthrough.
5. To exit, use the Quest system menu or the Exit button on the VR panel.

**VR Requirements:**

- Meta Quest 2 or Quest 3 (hand tracking required)
- App served over HTTPS (WebXR requirement)
- Chrome or Meta Browser on the headset
- Hand tracking enabled in Quest settings

### 5.2 Hand Gestures

**Pinch & Grab Gear**

- Gesture: Thumb + Index finger pinch (distance < 2 cm)
- Action: Grab / Select a gear

**Hold & Move Gear**

- Gesture: Keep pinch and move hand
- Action: Gear follows hand position (scales up 1.02× while held). Release → snap check runs. Haptic pulse on successful snap.

**Two-Hand Z-Axis Control**

- Gesture: Primary hand grabs gear (pinch); other hand grips (squeeze). Move hands apart or together.
- Action: Gear moves along the Z-axis (depth).

**Tip:** The Ray Pointer changes colour as feedback — blue when pointing at empty space, green when hovering over a gear or panel button. Pinch to activate the hovered target.

### 5.3 VR Floating Panels

**Left Control Panel:** Positioned left of the gear scene. Contains all the same controls as the desktop — Add Gear, Delete, Reset, Play, Pause, RPM (with ± buttons), and all gear parameters with increment/decrement buttons.

**Right Info Panel:** Positioned right of the scene. Shows selected gear data live: RPM, direction, ratio, connected count. Background colour changes on error states (red/orange/purple).

**Warning Panel:** Appears in front of the user when an error is detected. Colour-coded by error type. Auto-hides after ~2 seconds or when the gear is moved away from the problem.

### 5.4 Moving Gears in VR

- **XY movement:** Point at gear → pinch + move hand in XY plane.
- **Z movement:** Primary pinch on gear + other hand squeeze → move hands apart (away) or together (toward you).
- **Release:** Open pinch (fingers apart > 4 cm) to release; snap check runs automatically.

## Chapter 6 — Quiz Mode

### 6.1 Activating Quiz Mode

Quiz Mode is activated by adding URL parameters when opening the application:

`https://[your-server]/?user_id=123&exam_id=456`

- **user_id** — the student/learner ID used for score submission
- **exam_id** — which exam/question set to load from the server API
- Without these parameters, the app runs in normal free-build mode.

### 6.2 Quiz Flow

**START → QUESTION → SUBMIT → FEEDBACK → (repeat) → RESULTS**

- **Start:** Shows Exam ID and question count. Click "Start Quiz".
- **Question:** Target properties shown (RPM, ratio, etc.). 3-minute timer starts. Build a matching gear train.
- **Submit:** Click "Submit Answer" button, or wait for timer to expire.
- **Feedback:** Shows "Correct!" or "Incorrect". 1.5 s delay, then next question.
- **Results:** Final score screen shown after all questions are complete.

**Timer colour coding:**

- Green — more than 1:30 remaining
- Orange — 30 s to 1:30 remaining
- Red — under 30 seconds

If time runs out, the answer is auto-submitted as incorrect.

**Results screen shows:**

- Overall percentage (green >70%, orange 40–70%, red <40%)
- Per-question correct/incorrect breakdown
- Submission status (scores sent to server)

### 6.3 Question Types & Validation

| Type | Goal | How to solve | Tolerance |
|---|---|---|---|
| gearRatio | Achieve a target gear ratio (e.g. 3:1) | Build chain where driver teeth ÷ output teeth = target ratio | ±0.1 |
| rpmOut | Achieve target output RPM | Connect gears so output RPM matches — use RPM × (T₁÷T₂) formula | ±0.5 RPM |
| torqueOut | Achieve target output torque (Nm) | Torque = 10 Nm × (output teeth ÷ driver teeth). Larger output gear = more torque | ±0.5 Nm |
| Legacy (combined) | Match multiple properties at once | Read all required fields (teeth count, module, RPM, ratio) and satisfy each | Per-field |

## Chapter 7 — Quick Reference

### 7.1 Desktop Keyboard & Mouse Shortcuts

| Action | Input |
|---|---|
| Select a gear | Left-click on gear |
| Deselect | Left-click on empty canvas |
| Move gear (XY plane) | Left-click + drag on gear |
| Move gear (Z-axis / depth) | Shift + Left-click + drag |
| Orbit camera | Middle-mouse drag |
| Zoom camera | Scroll wheel |
| Add gear | Configure params → click Add Gear |
| Delete selected gear | Select gear → click Delete Selected |
| Clear entire scene | Click Reset Scene |
| Start rotation | Set RPM → click Play |
| Stop rotation | Click Pause |
| Reset rotation angles | Click Reset Rotation |
| Toggle pitch circle | Tick Show Pitch Circle |
| Toggle center marker | Tick Show Center |
| Toggle dark/light theme | Click Toggle Theme |

### 7.2 VR Controls Summary

| Action | Gesture |
|---|---|
| Select / activate panel button | Aim ray (green) at button → pinch |
| Grab and move gear (XY) | Point at gear → pinch + move hand |
| Move gear along Z-axis | Primary pinch + other hand squeeze → hands apart/together |
| Release gear (snap check) | Open pinch (fingers apart > 4 cm) |
| Add gear | Aim at Add Gear button → pinch |
| Delete gear | Select gear → aim at Delete Selected → pinch |
| Play simulation | Aim at Play → pinch |
| Adjust RPM / parameters | Aim at + or − buttons → pinch |

### 7.3 Gear Parameter Reference

| Parameter | Default | Min | Max |
|---|---|---|---|
| Teeth | 20 | 8 | 100 |
| Module (mm) | 2 | 0.5 | 10 |
| Pressure Angle (°) | 20 | 14.5 | 25 |
| Thickness (mm) | 5 | 1 | 20 |
| Bore Diameter (mm) | 5 | 1 | 20 |
| Input RPM | 30 | 1 | 1000 |

**Calculated Values:**

- Pitch Diameter = Teeth × Module
- Pitch Radius = Pitch Diameter ÷ 2
- Addendum = Module
- Dedendum = 1.25 × Module
- Outer Radius = Pitch Radius + Addendum
- Mesh Distance = (PitchRadius₁ + PitchRadius₂)

**Remember:** Module must match exactly between two gears for them to mesh. This is the most common reason snap fails.

3D Gear Simulator — User Manual
