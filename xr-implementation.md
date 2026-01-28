# Gear Simulator WebXR Features & Specifications

## Overview

This document specifies the WebXR implementation for the Gear Simulator, replacing traditional mouse/cursor interactions with immersive VR grabbing mechanics and in-world 3D control panels.

---

## 1. WebXR Session Configuration

### XR Button Setup
```javascript
XRButton.createButton(renderer, {
    requiredFeatures: ['hand-tracking'],
    optionalFeatures: ['local-floor', 'bounded-floor', 'depth-sensing'],
    depthSensing: {
        usagePreference: ['gpu-optimized'],
        dataFormatPreference: []
    }
})
```

### Session Properties
| Property | Value | Description |
|----------|-------|-------------|
| Reference Space | 'local-floor' | Floor-level tracking |
| Frame Rate | 72-90 Hz | Device dependent |
| Hand Tracking | Required | Primary interaction method |
| Controllers | Supported | Fallback interaction |

---

## 2. XR Input Sources

### Controllers
| Controller | Index | Primary Use |
|------------|-------|-------------|
| Left Controller | 0 | UI interaction, secondary grab |
| Right Controller | 1 | Primary grab, gear manipulation |

### Controller Components
```javascript
controller = renderer.xr.getController(index)
controllerGrip = renderer.xr.getControllerGrip(index)
```

### Controller Visual Model
| Property | Value |
|----------|-------|
| Geometry | CylinderGeometry(0.005, 0.005, 0.1) |
| Material Color | 0x4a90d9 |
| Ray Length | 3 units |
| Ray Opacity | 0.5 |

### Hand Tracking
| Hand | Index | Model |
|------|-------|-------|
| Left Hand | 0 | OculusHandModel / XRHandMeshModel |
| Right Hand | 1 | OculusHandModel / XRHandMeshModel |

### Hand Joint Tracking
| Joint | Use |
|-------|-----|
| index-finger-tip | Pointing, UI interaction |
| thumb-tip | Pinch detection |
| wrist | Hand position reference |

---

## 3. Grab Interaction System

### Grab Detection Methods

#### Controller Grab
| Event | Action |
|-------|--------|
| selectstart | Begin grab attempt |
| selectend | Release grabbed object |
| squeezestart | Secondary grab (two-handed) |
| squeezeend | Release secondary grab |

#### Hand Pinch Grab
| Gesture | Detection | Threshold |
|---------|-----------|-----------|
| Pinch Start | thumb-tip to index-finger-tip distance | < 0.02 meters |
| Pinch End | thumb-tip to index-finger-tip distance | > 0.04 meters |
| Pinch Strength | Linear interpolation | 0.0 - 1.0 |

```javascript
// Pinch detection pseudocode
const thumbTip = hand.joints['thumb-tip']
const indexTip = hand.joints['index-finger-tip']
const pinchDistance = thumbTip.position.distanceTo(indexTip.position)
const isPinching = pinchDistance < 0.02
```

### Grab States
| State | Description |
|-------|-------------|
| IDLE | No interaction |
| HOVER | Hand/controller near grabbable object |
| GRABBING | Object attached to hand/controller |
| DRAGGING | Moving grabbed object |
| RELEASED | Just released, checking snap |

### Grabbable Object Properties
```javascript
gear.userData = {
    grabbable: true,
    isGrabbed: false,
    grabOffset: new THREE.Vector3(),
    grabQuaternion: new THREE.Quaternion(),
    originalParent: null,
    grabHand: null  // 'left' | 'right' | null
}
```

---

## 4. Gear Interaction Mapping

### Mouse → XR Interaction Conversion

| Mouse Action | XR Equivalent | Implementation |
|--------------|---------------|----------------|
| Click to select | Point + Pinch/Trigger | Ray intersection + select event |
| Click and drag XY | Grab + Move hand | Parent gear to controller/hand |
| Shift + drag Z | Two-hand grab + pull/push | Distance between hands changes Z |
| Hover highlight | Ray intersection | Continuous ray-cast check |
| Double-click | Quick double pinch | Time-based gesture detection |

### Gear Selection (XR)
| Method | Trigger | Visual Feedback |
|--------|---------|-----------------|
| Controller Ray | Trigger press on intersection | Ray turns green, gear highlight |
| Hand Point | Index finger ray + pinch | Finger glow, gear highlight |
| Direct Touch | Hand collider enters gear | Haptic feedback, gear pulse |

### Gear Grabbing (XR)
```javascript
// Grab sequence
1. Detect intersection (ray or collision)
2. On pinch/trigger:
   - Store grab offset (gear.position - hand.position)
   - Store grab rotation (gear.quaternion relative to hand)
   - Set gear.userData.isGrabbed = true
   - Attach gear to hand/controller space
3. During grab:
   - Update gear position = hand.position + grabOffset
   - Optional: Match hand rotation
4. On release:
   - Detach from hand
   - Check snap-to-mesh
   - Apply final position
```

### Gear Movement Constraints
| Axis | Single Hand | Two Hands |
|------|-------------|-----------|
| X | Free movement | Free movement |
| Y | Free movement | Free movement |
| Z | Locked | Hand distance maps to Z |

### Two-Hand Z-Axis Control
```javascript
// Z-axis manipulation with two hands
const leftHandPos = leftController.position
const rightHandPos = rightController.position
const handDistance = leftHandPos.distanceTo(rightHandPos)
const initialHandDistance = /* stored on grab start */
const zDelta = (handDistance - initialHandDistance) * zSensitivity

gear.position.z = initialGearZ + zDelta
```

| Property | Value |
|----------|-------|
| Z Sensitivity | 2.0 (distance to units) |
| Min Hand Distance | 0.1 meters |
| Max Z Range | ±50 units |

---

## 5. Snap-to-Mesh (XR)

### Snap Behavior on Release
| Parameter | Value | Description |
|-----------|-------|-------------|
| Snap Threshold | 0.1 meters (XR scale) | Distance to trigger snap |
| Mesh Detection | 0.05 meters | Tolerance for mesh connection |
| Haptic Feedback | 0.5 intensity, 50ms | On successful snap |
| Visual Feedback | Green flash | Gear pulses on connection |

### Snap Sequence
```javascript
1. On release, check nearby gears
2. Calculate ideal mesh distance for each candidate
3. If within snap threshold:
   - Animate gear to snap position (200ms tween)
   - Trigger haptic pulse
   - Play snap sound (optional)
   - Update connectedTo arrays
4. If no snap:
   - Gear stays at release position
```

---

## 6. In-World Control Panels

### Panel Positioning (World Space)

| Panel | Position | Rotation | Description |
|-------|----------|----------|-------------|
| Left Panel (Controls) | (-0.8, 1.2, -0.5) | Y: 30° | Main gear controls |
| Right Panel (Info) | (0.8, 1.2, -0.5) | Y: -30° | Selected gear info |
| Top Panel (Quick Actions) | (0, 1.8, -0.6) | X: -15° | Play/Pause/Reset |

### Panel Attachment Options
| Mode | Behavior |
|------|----------|
| World-Fixed | Panels stay in world position |
| Head-Follow | Panels follow user head with lag |
| Wrist-Attached | Panels appear on wrist look |

### Panel Dimensions
| Panel | Width | Height | Depth |
|-------|-------|--------|-------|
| Left (Controls) | 0.5m | 0.8m | 0.02m |
| Right (Info) | 0.4m | 0.5m | 0.02m |
| Top (Quick) | 0.6m | 0.15m | 0.02m |

---

## 7. Left Panel: Gear Controls (3D UI)

### Panel Layout (Top to Bottom)

#### Header Section
| Element | Position Y | Size | Content |
|---------|------------|------|---------|
| Title | 0.36m | 0.08m | "⚙ Gear Simulator" |
| Gradient BG | - | Full width | Blue gradient (#4a90d9 → #667eea) |

#### Manage Gears Section (Y: 0.28m to 0.18m)
| Button | Color | Size | Action |
|--------|-------|------|--------|
| Add Gear | 0x27ae60 (green) | 0.14m × 0.05m | Spawn gear at hand position |
| Delete Selected | 0xe74c3c (red) | 0.14m × 0.05m | Remove current gear |
| Reset Scene | 0xe67e22 (orange) | 0.3m × 0.05m | Clear all gears |

#### Animation Section (Y: 0.12m to -0.02m)
| Control | Type | Default | Description |
|---------|------|---------|-------------|
| RPM Label | Text | "Input RPM" | - |
| RPM Slider | 3D Slider | 30 | Range: 1-1000 |
| Play Button | Icon Button | ▶ | Start animation |
| Pause Button | Icon Button | ⏸ | Pause animation |
| Reset Button | Icon Button | ↺ | Reset rotations |

#### Parameters Section (Y: -0.08m to -0.28m)
| Parameter | Control Type | Range |
|-----------|--------------|-------|
| Teeth | Number Dial | 8-100 |
| Module | Slider | 0.5-10 |
| Pressure Angle | Slider | 14.5-25 |
| Thickness | Slider | 1-20 |
| Bore Diameter | Slider | 1-20 |
| Color | Color Wheel | Full spectrum |

#### Display Toggles (Y: -0.32m to -0.38m)
| Toggle | Default | Visual |
|--------|---------|--------|
| Pitch Circles | OFF | Switch button |
| Centers | OFF | Switch button |
| Theme | Dark | Toggle pill |

---

## 8. Right Panel: Gear Info (3D UI)

### Dynamic Content Display
| Field | Position Y | Update Trigger |
|-------|------------|----------------|
| "Selected Gear" title | 0.22m | Static |
| Teeth value | 0.15m | On selection |
| Pitch Diameter | 0.10m | On selection/param change |
| Module | 0.05m | On selection |
| RPM | 0.00m | Every frame (animated) |
| Direction indicator | -0.05m | On selection/mesh change |
| Gear Ratio | -0.10m | On mesh connection |
| Connected count | -0.15m | On mesh connection |

### Visual Indicators
| Indicator | Condition | Color |
|-----------|-----------|-------|
| Direction Arrow | CW | 0x27ae60 (green) |
| Direction Arrow | CCW | 0xe67e22 (orange) |
| Connection Badge | Connected | 0x3498db (blue) |
| Connection Badge | Isolated | 0x95a5a6 (gray) |

---

## 9. 3D UI Components Specification

### 3D Button
```javascript
{
    geometry: BoxGeometry(width, height, 0.01),
    material: MeshStandardMaterial({
        color: buttonColor,
        roughness: 0.5,
        metalness: 0.2
    }),
    states: {
        idle: { emissive: 0x000000, scale: 1.0 },
        hover: { emissive: 0x222222, scale: 1.05 },
        pressed: { emissive: 0x000000, scale: 0.95 },
        disabled: { opacity: 0.5, scale: 1.0 }
    },
    label: CanvasTexture // Rendered text
}
```

### 3D Slider
```javascript
{
    track: {
        geometry: BoxGeometry(trackLength, 0.015, 0.005),
        color: 0xcccccc
    },
    handle: {
        geometry: SphereGeometry(0.02),
        color: 0x4a90d9,
        grabbable: true
    },
    fill: {
        geometry: BoxGeometry(fillLength, 0.012, 0.004),
        color: 0x4a90d9
    },
    valueDisplay: CanvasTexture,
    range: { min, max, step },
    onValueChange: callback
}
```

### 3D Number Dial
```javascript
{
    geometry: CylinderGeometry(0.03, 0.03, 0.015, 32),
    rotation: { 
        axis: 'local-y',
        sensitivity: 0.01 // radians per value unit
    },
    display: CanvasTexture,
    range: { min, max, step },
    hapticTicks: true // Haptic feedback at each step
}
```

### 3D Toggle Switch
```javascript
{
    track: {
        geometry: CapsuleGeometry(0.01, 0.04),
        colorOff: 0x666666,
        colorOn: 0x27ae60
    },
    handle: {
        geometry: SphereGeometry(0.012),
        color: 0xffffff,
        positionOff: -0.015,
        positionOn: 0.015,
        animationDuration: 100 // ms
    }
}
```

### 3D Color Picker
```javascript
{
    wheel: {
        geometry: CircleGeometry(0.05, 32),
        texture: HSV color wheel
    },
    brightness: {
        geometry: BoxGeometry(0.08, 0.015, 0.005),
        gradient: Black to current hue
    },
    preview: {
        geometry: SphereGeometry(0.02),
        material: Updates in real-time
    }
}
```

---

## 10. UI Interaction Methods

### Button Press Detection
| Method | Detection | Feedback |
|--------|-----------|----------|
| Controller Ray + Trigger | Ray intersects + selectstart | Visual press + haptic |
| Hand Poke | Index fingertip collision | Visual press + haptic |
| Hand Pinch on Button | Pinch while pointing at button | Visual press + haptic |

### Slider Manipulation
| Method | Behavior |
|--------|----------|
| Controller | Point at handle, trigger to grab, move controller |
| Hand | Pinch handle, move hand along track axis |
| Two-finger | Pinch track anywhere, slide along |

### Dial Rotation
| Method | Behavior |
|--------|----------|
| Controller | Grab dial, rotate controller wrist |
| Hand | Pinch dial edge, rotate hand |
| Swipe | Quick swipe gesture for large changes |

---

## 11. Haptic Feedback Patterns

| Event | Duration | Intensity | Pattern |
|-------|----------|-----------|---------|
| Button hover | 10ms | 0.1 | Single pulse |
| Button press | 30ms | 0.4 | Single pulse |
| Gear grab | 50ms | 0.3 | Single pulse |
| Gear release | 30ms | 0.2 | Single pulse |
| Snap to mesh | 100ms | 0.6 | Double pulse |
| Slider tick | 5ms | 0.1 | Per step |
| Dial tick | 5ms | 0.15 | Per step |
| Invalid action | 200ms | 0.8 | Triple pulse |

```javascript
// Haptic feedback implementation
function triggerHaptic(controller, intensity, duration) {
    const gamepad = controller.userData.gamepad
    if (gamepad && gamepad.hapticActuators) {
        gamepad.hapticActuators[0].pulse(intensity, duration)
    }
}
```

---

## 12. Visual Feedback System

### Gear States (XR)
| State | Emissive | Scale | Additional |
|-------|----------|-------|------------|
| Idle | 0x000000 | 1.0 | - |
| Hover | 0x333333 | 1.0 | Outline glow |
| Selected | 0x444444 | 1.0 | Yellow pitch circle |
| Grabbed | 0x555555 | 1.02 | Slight transparency |
| Snap Preview | 0x00ff00 | 1.0 | Ghost at snap position |

### Controller/Hand Feedback
| State | Visual |
|-------|--------|
| Idle | Blue ray (0x4a90d9) |
| Pointing at interactive | Green ray (0x27ae60) |
| Grabbing | No ray, hand glow |
| Invalid target | Red ray flash (0xe74c3c) |

### Panel Feedback
| Event | Animation |
|-------|-----------|
| Panel appear | Fade in + scale from 0.8 to 1.0 (300ms) |
| Panel dismiss | Fade out + scale to 0.8 (200ms) |
| Button press | Scale to 0.95 and back (100ms) |
| Slider change | Fill bar animates (50ms) |

---

## 13. Audio Feedback (Optional)

| Event | Sound | Volume |
|-------|-------|--------|
| Gear grab | Soft click | 0.3 |
| Gear release | Soft thud | 0.2 |
| Snap to mesh | Mechanical click | 0.5 |
| Button press | UI click | 0.4 |
| Slider move | Soft tick | 0.1 |
| Error/Invalid | Buzz | 0.3 |

---

## 14. XR Scene Adjustments

### Scale Conversion
| Desktop | XR | Ratio |
|---------|-----|-------|
| 1 unit | 0.01 meters | 1:100 |
| Grid 200 | 2 meters | Workspace size |
| Gear module 2 | 0.02m (2cm) | Realistic scale |

### Camera/User Position
| Property | Value |
|----------|-------|
| Initial Position | (0, 0, 0) floor level |
| Workspace Center | (0, 1.2, -0.5) |
| Recommended Standing Area | 2m × 2m |

### Lighting Adjustments for XR
| Light | XR Intensity | Position |
|-------|--------------|----------|
| Ambient | 0.5 | - |
| Directional (main) | 0.7 | (1, 2, 1) |
| Directional (fill) | 0.3 | (-1, 1, 0.5) |

### Environment
| Feature | Implementation |
|---------|----------------|
| Floor Grid | GridHelper at Y=0 |
| Skybox | Gradient sphere or HDR environment |
| Workbench (optional) | Flat surface at Y=0.8m |

---

## 15. Teleportation (Optional)

### Locomotion Options
| Method | Trigger | Description |
|--------|---------|-------------|
| Teleport | Thumbstick + release | Arc ray, teleport to valid floor |
| Snap Turn | Thumbstick left/right | 45° rotation |
| Continuous Move | Thumbstick forward | Smooth locomotion |

### Valid Teleport Surfaces
- Floor plane (Y = 0)
- Marked teleport pads

---

## 16. Implementation Checklist

### Required Three.js Imports
```javascript
import { XRButton } from 'three/examples/jsm/webxr/XRButton.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { OculusHandModel } from 'three/examples/jsm/webxr/OculusHandModel.js'
import { OculusHandPointerModel } from 'three/examples/jsm/webxr/OculusHandPointerModel.js'
// OR for generic hands:
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'
```

### Setup Checklist
- [ ] Enable WebXR on renderer (`renderer.xr.enabled = true`)
- [ ] Add XRButton to DOM
- [ ] Set up controllers (getController, getControllerGrip)
- [ ] Set up hand tracking (getHand)
- [ ] Add controller models (XRControllerModelFactory)
- [ ] Add hand models (OculusHandModel or XRHandModelFactory)
- [ ] Implement grab system
- [ ] Create 3D UI panels
- [ ] Implement UI interaction detection
- [ ] Add haptic feedback
- [ ] Scale scene appropriately
- [ ] Test on target devices

### Event Listeners
```javascript
controller.addEventListener('selectstart', onSelectStart)
controller.addEventListener('selectend', onSelectEnd)
controller.addEventListener('squeezestart', onSqueezeStart)
controller.addEventListener('squeezeend', onSqueezeEnd)
controller.addEventListener('connected', onControllerConnected)
controller.addEventListener('disconnected', onControllerDisconnected)
```

---

## 17. Performance Considerations

| Optimization | Implementation |
|--------------|----------------|
| UI Update Rate | 30 Hz (not every frame) |
| Gear LOD | Simplified geometry when distant |
| Ray-cast Throttle | Every 2nd frame for UI |
| Haptic Batching | Debounce rapid triggers |
| Panel Culling | Hide panels when user looks away |

---

## 18. Fallback Behavior

### When Hand Tracking Unavailable
- Use controller ray interaction
- All gestures map to trigger/grip buttons

### When Controllers Unavailable
- Display error message
- Suggest connecting controllers

### Desktop Mode
- Standard mouse/keyboard controls
- HTML UI panels
- Click and drag interaction

---

## 19. Accessibility

| Feature | Implementation |
|---------|----------------|
| Large UI targets | Minimum 0.05m touch area |
| High contrast | Clear color differentiation |
| Audio cues | Optional sound feedback |
| Reduced motion | Option to disable animations |
| Seated mode | Lower panel positions |

---

## Summary: Mouse → XR Mapping

| Desktop Action | XR Action | Input |
|----------------|-----------|-------|
| Click | Pinch / Trigger | Select event |
| Drag | Grab + Move | Pinch hold + hand movement |
| Shift+Drag | Two-hand pull/push | Both hands pinch + distance |
| Hover | Point ray | Continuous intersection |
| Scroll | Thumbstick / Hand swipe | Slider interaction |
| Right-click | Squeeze / Long pinch | Context menu (if any) |
| Keyboard input | Virtual keyboard / Voice | Number entry |
