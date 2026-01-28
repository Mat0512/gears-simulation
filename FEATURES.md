# Gear Simulator Features & Defaults

## Gear Parameters

| Parameter | Default | Min | Max | Step | Unit |
|-----------|---------|-----|-----|------|------|
| Teeth | 20 | 8 | 100 | 1 | count |
| Module | 2 | 0.5 | 10 | 0.5 | mm |
| Pressure Angle | 20 | 14.5 | 25 | 0.5 | degrees |
| Thickness | 5 | 1 | 20 | 1 | mm |
| Bore Diameter | 5 | 1 | 20 | 1 | mm |
| Color | #4a90d9 | - | - | - | hex |

## Calculated Gear Properties

These are computed automatically from the parameters above:

| Property | Formula |
|----------|---------|
| Pitch Diameter | `teeth * module` |
| Pitch Radius | `pitchDiameter / 2` |
| Base Radius | `pitchRadius * cos(pressureAngle)` |
| Addendum | `module` |
| Dedendum | `1.25 * module` |
| Outer Radius | `pitchRadius + addendum` |
| Root Radius | `pitchRadius - dedendum` |
| Bore Radius | `boreDiameter / 2` (clamped to 50% of rootRadius if too large) |

## Gear Object Properties (Runtime)

| Property | Default | Description |
|----------|---------|-------------|
| rpm | 0 | Current rotation speed |
| rotationDirection | 1 | 1 = CW, -1 = CCW |
| connectedTo | [] | Array of meshed gears |
| isDriver | true (first gear) | Controls if gear drives the system |

---

## Control Panels

### Left Panel: Gear Controls

#### Manage Gears Section
| Button | Action |
|--------|--------|
| Add Gear | Creates new gear with current parameter values |
| Delete Selected | Removes currently selected gear |
| Reset Scene | Clears all gears from scene |

#### Animation Section
| Control | Default | Range | Description |
|---------|---------|-------|-------------|
| Input RPM | 30 | 1-1000 | Driver gear rotation speed |
| Play | - | - | Start rotation simulation |
| Pause | - | - | Stop rotation simulation |
| Reset Rotation | - | - | Reset all gear rotations to 0 |

#### Gear Parameters Section
- Teeth input (number)
- Module input (number)
- Pressure Angle input (number)
- Thickness input (number)
- Bore Diameter input (number)
- Color picker

#### Position Section
| Control | Default | Description |
|---------|---------|-------------|
| X | 0 | Horizontal position |
| Y | 0 | Vertical position |
| Z | 0 | Depth position |

**Interaction hint:** Drag gear to move in XY plane. Shift+drag for Z-axis.

#### Display Section
| Toggle | Default | Description |
|--------|---------|-------------|
| Show Pitch Circle | OFF | Green circle at pitch radius |
| Show Center | OFF | Red sphere at gear center |
| Show Labels | OFF | (Not implemented) |
| Toggle Theme | Dark | Switch between dark/light mode |

---

### Right Panel: Gear Info

Displays for selected gear:

| Field | Description |
|-------|-------------|
| Teeth | Number of teeth |
| Pitch Diameter | Calculated pitch diameter (mm) |
| Module | Module value |
| RPM | Current rotation speed |
| Direction | CW (green) or CCW (orange) |
| Gear Ratio | Ratio with connected gears (e.g., "20:30") |
| Connected | Number of meshed gears |

---

## Interaction Features

### Gear Selection
- Click gear to select
- Selected gear shows emissive highlight (0x444444)
- Pitch circle turns yellow when selected

### Gear Dragging
- Left-click and drag moves gear in XY plane
- Shift + drag moves gear along Z-axis
- Z sensitivity: 0.5 (pixels to units)

### Snap-to-Mesh
- Snap threshold: 5 units
- Mesh detection threshold: 3 units
- Automatically connects gears at correct pitch distance
- Ideal distance = `(pitchDiameter1 + pitchDiameter2) / 2`

### Hover Highlighting
- Non-selected gears show subtle emissive (0x333333) on hover

---

## Simulation Features

### Gear Speed Propagation
- Uses BFS algorithm from driver gear
- Gear ratio: `rpm2 = rpm1 * (teeth1 / teeth2)`
- Connected gears rotate in opposite directions

### Material Properties
| Property | Value |
|----------|-------|
| Metalness | 0.3 |
| Roughness | 0.7 |

### Geometry Settings
| Setting | Value |
|---------|-------|
| Bevel Enabled | true |
| Bevel Thickness | 0.5 |
| Bevel Size | 0.3 |
| Bevel Segments | 2 |

---

## Scene Defaults

### Camera
| Property | Value |
|----------|-------|
| Type | PerspectiveCamera |
| FOV | 50 |
| Position | (0, 0, 150) |
| Near | 0.1 |
| Far | 1000 |

### Orbit Controls
| Property | Value |
|----------|-------|
| Damping | enabled |
| Damping Factor | 0.05 |
| Min Distance | 20 |
| Max Distance | 500 |

### Lighting
| Light | Intensity | Position |
|-------|-----------|----------|
| Ambient | 0.4 | - |
| Directional (main) | 0.8 | (50, 50, 100) |
| Directional (fill) | 0.3 | (-50, -50, 50) |

### Grid
- Size: 200 x 200
- Divisions: 40
- Colors: 0x444444 / 0x333333

### Theme Colors
| Mode | Background |
|------|------------|
| Dark (default) | 0x1a1a2e |
| Light | 0xf5f5f5 |
