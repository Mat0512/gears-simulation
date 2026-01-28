import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { OculusHandModel } from 'three/addons/webxr/OculusHandModel.js';
import { GearGeometry } from './GearGeometry.js';

/**
 * Main gear simulator application
 */
export class GearSimulator {
    constructor(canvas) {
        this.canvas = canvas;
        this.gears = [];
        this.selectedGear = null;
        this.isPlaying = false;
        this.inputRPM = 30;
        this.isDarkMode = true;

        // Display options
        this.showPitchCircle = false;
        this.showCenter = false;
        this.showLabels = false;

        // XR state
        this.isXRPresenting = false;
        this.xrScale = 0.01; // 1:100 scale for VR (1 unit = 0.01m)

        // XR controllers and hands
        this.controller1 = null;
        this.controller2 = null;
        this.controllerGrip1 = null;
        this.controllerGrip2 = null;
        this.hand1 = null;
        this.hand2 = null;
        this.handModel1 = null;
        this.handModel2 = null;
        this.controllerRay1 = null;
        this.controllerRay2 = null;

        // XR grab state (per hand)
        this.grabState = {
            left: { isGrabbing: false, grabbedGear: null, grabOffset: new THREE.Vector3() },
            right: { isGrabbing: false, grabbedGear: null, grabOffset: new THREE.Vector3() }
        };

        // XR pinch state (per hand)
        this.pinchState = {
            left: { isPinching: false, pinchStrength: 0 },
            right: { isPinching: false, pinchStrength: 0 }
        };

        // Two-hand grab for Z-axis control
        this.twoHandGrab = {
            active: false,
            gear: null,
            initialHandDistance: 0,
            initialGearZ: 0
        };

        // XR 3D UI panels
        this.xrPanels = {
            left: null,
            right: null,
            top: null
        };

        // XR interaction state
        this.xrRaycaster = new THREE.Raycaster();
        this.hoveredXRButton = null;

        // Drag state
        this.isDragging = false;
        this.dragPlaneXY = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.dragPlaneZ = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // For Z-axis dragging
        this.dragOffset = new THREE.Vector3();
        this.dragStartY = 0; // For Z-axis drag tracking
        this.dragStartZ = 0;

        // Raycaster for selection
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.init();
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.createGrid();
        this.createControls();
        this.setupEventListeners();
        this.animate();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
    }

    createCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 150);
        this.camera.lookAt(0, 0, 0);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Enable WebXR
        this.renderer.xr.enabled = true;
        this.setupWebXR();
    }

    setupWebXR() {
        // Add VR button to DOM
        const vrButton = VRButton.createButton(this.renderer);
        document.body.appendChild(vrButton);

        // Setup controllers and hands
        this.setupControllers();
        this.setupHands();

        // XR session events
        this.renderer.xr.addEventListener('sessionstart', () => this.onXRSessionStart());
        this.renderer.xr.addEventListener('sessionend', () => this.onXRSessionEnd());
    }

    setupControllers() {
        const controllerModelFactory = new XRControllerModelFactory();

        // Controller 0 (typically right hand)
        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.userData.handedness = 'right';
        this.controller1.addEventListener('selectstart', (e) => this.onSelectStart(e, 'right'));
        this.controller1.addEventListener('selectend', (e) => this.onSelectEnd(e, 'right'));
        this.controller1.addEventListener('squeezestart', (e) => this.onSqueezeStart(e, 'right'));
        this.controller1.addEventListener('squeezeend', (e) => this.onSqueezeEnd(e, 'right'));
        this.scene.add(this.controller1);

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        this.controllerGrip1.add(controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.scene.add(this.controllerGrip1);

        // Controller 1 (typically left hand)
        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.userData.handedness = 'left';
        this.controller2.addEventListener('selectstart', (e) => this.onSelectStart(e, 'left'));
        this.controller2.addEventListener('selectend', (e) => this.onSelectEnd(e, 'left'));
        this.controller2.addEventListener('squeezestart', (e) => this.onSqueezeStart(e, 'left'));
        this.controller2.addEventListener('squeezeend', (e) => this.onSqueezeEnd(e, 'left'));
        this.scene.add(this.controller2);

        this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
        this.controllerGrip2.add(controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.scene.add(this.controllerGrip2);

        // Create controller rays
        this.controllerRay1 = this.createControllerRay();
        this.controller1.add(this.controllerRay1);

        this.controllerRay2 = this.createControllerRay();
        this.controller2.add(this.controllerRay2);
    }

    createControllerRay() {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -3) // 3 units length
        ]);
        const material = new THREE.LineBasicMaterial({
            color: 0x4a90d9, // Blue idle color
            linewidth: 2
        });
        const ray = new THREE.Line(geometry, material);
        ray.name = 'controllerRay';
        ray.visible = true;
        return ray;
    }

    setupHands() {
        // Hand 0 (right)
        this.hand1 = this.renderer.xr.getHand(0);
        this.hand1.userData.handedness = 'right';
        this.handModel1 = new OculusHandModel(this.hand1);
        this.hand1.add(this.handModel1);
        this.scene.add(this.hand1);

        // Hand 1 (left)
        this.hand2 = this.renderer.xr.getHand(1);
        this.hand2.userData.handedness = 'left';
        this.handModel2 = new OculusHandModel(this.hand2);
        this.hand2.add(this.handModel2);
        this.scene.add(this.hand2);
    }

    onXRSessionStart() {
        this.isXRPresenting = true;
        document.body.classList.add('xr-presenting');

        // Hide HTML panels
        const controlsPanel = document.getElementById('controls-panel');
        const infoPanel = document.getElementById('info-panel');
        if (controlsPanel) controlsPanel.style.display = 'none';
        if (infoPanel) infoPanel.style.display = 'none';

        // Create 3D UI panels
        this.createXRPanels();

        // Disable orbit controls in XR
        if (this.orbitControls) {
            this.orbitControls.enabled = false;
        }
    }

    onXRSessionEnd() {
        this.isXRPresenting = false;
        document.body.classList.remove('xr-presenting');

        // Show HTML panels
        const controlsPanel = document.getElementById('controls-panel');
        const infoPanel = document.getElementById('info-panel');
        if (controlsPanel) controlsPanel.style.display = '';
        if (infoPanel) infoPanel.style.display = '';

        // Remove 3D UI panels
        this.removeXRPanels();

        // Re-enable orbit controls
        if (this.orbitControls) {
            this.orbitControls.enabled = true;
        }

        // Clear grab states
        this.grabState.left = { isGrabbing: false, grabbedGear: null, grabOffset: new THREE.Vector3() };
        this.grabState.right = { isGrabbing: false, grabbedGear: null, grabOffset: new THREE.Vector3() };
        this.twoHandGrab.active = false;
    }

    // ==================== XR INTERACTION METHODS ====================

    onSelectStart(event, handedness) {
        const controller = handedness === 'right' ? this.controller1 : this.controller2;
        const ray = handedness === 'right' ? this.controllerRay1 : this.controllerRay2;

        // Get controller position and direction
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(controller.matrixWorld);

        const origin = new THREE.Vector3();
        controller.getWorldPosition(origin);

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyMatrix4(tempMatrix);

        this.xrRaycaster.set(origin, direction);

        // Check for gear intersection
        const gearMeshes = this.gears.map(g => g.mesh);
        const intersects = this.xrRaycaster.intersectObjects(gearMeshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const gear = this.gears.find(g => g.mesh === clickedMesh);

            if (gear) {
                this.beginGrab(gear, handedness, intersects[0].point, controller);
                // Hide ray while grabbing
                if (ray) ray.visible = false;
            }
        } else {
            // Check for UI button intersection
            this.checkXRButtonPress(origin, direction, handedness);
        }
    }

    onSelectEnd(event, handedness) {
        const ray = handedness === 'right' ? this.controllerRay1 : this.controllerRay2;

        if (this.grabState[handedness].isGrabbing) {
            this.releaseGrab(handedness);
        }

        // Show ray again
        if (ray) ray.visible = true;
    }

    beginGrab(gear, handedness, grabPoint, controller) {
        const state = this.grabState[handedness];

        state.isGrabbing = true;
        state.grabbedGear = gear;

        // Calculate offset from controller to gear center
        const controllerPos = new THREE.Vector3();
        controller.getWorldPosition(controllerPos);
        state.grabOffset.copy(gear.mesh.position).sub(controllerPos);

        // Mark gear as grabbed
        gear.mesh.userData.isGrabbed = true;
        gear.mesh.userData.grabHand = handedness;

        // Visual feedback - scale up slightly and increase emissive
        gear.mesh.scale.set(1.02, 1.02, 1.02);
        gear.mesh.material.emissive.setHex(0x555555);

        // Haptic feedback
        this.triggerHaptic(handedness, 0.3, 50);

        // Select this gear
        this.selectGear(gear);
    }

    releaseGrab(handedness) {
        const state = this.grabState[handedness];

        if (!state.isGrabbing || !state.grabbedGear) return;

        const gear = state.grabbedGear;

        // Check for snap-to-mesh
        const snapped = this.checkSnapToMesh(gear);

        if (snapped) {
            // Strong haptic for snap
            this.triggerHaptic(handedness, 0.6, 100);
            setTimeout(() => this.triggerHaptic(handedness, 0.6, 100), 120);
        } else {
            // Light haptic for release
            this.triggerHaptic(handedness, 0.2, 30);
        }

        // Reset gear visual state
        gear.mesh.scale.set(1, 1, 1);
        if (gear === this.selectedGear) {
            gear.mesh.material.emissive.setHex(0x444444);
        } else {
            gear.mesh.material.emissive.setHex(0x000000);
        }

        gear.mesh.userData.isGrabbed = false;
        gear.mesh.userData.grabHand = null;

        // Clear state
        state.isGrabbing = false;
        state.grabbedGear = null;
        state.grabOffset.set(0, 0, 0);

        // Update connections
        this.updateConnections();
    }

    updateXRInteraction() {
        // Update controller/hand grabbing
        this.updateGrabbing('right', this.controller1, this.hand1);
        this.updateGrabbing('left', this.controller2, this.hand2);

        // Update hand pinch detection
        if (this.hand1 && this.hand1.joints && Object.keys(this.hand1.joints).length > 0) {
            this.updatePinchDetection(this.hand1, 'right');
        }
        if (this.hand2 && this.hand2.joints && Object.keys(this.hand2.joints).length > 0) {
            this.updatePinchDetection(this.hand2, 'left');
        }

        // Update two-hand grab
        if (this.twoHandGrab.active) {
            this.updateTwoHandGrab();
        }

        // Update controller ray colors based on intersection
        this.updateControllerRays();
    }

    updateGrabbing(handedness, controller, hand) {
        const state = this.grabState[handedness];

        if (!state.isGrabbing || !state.grabbedGear) return;

        // Get current position from controller or hand
        const currentPos = new THREE.Vector3();

        // Prefer hand position if available, otherwise use controller
        if (hand && hand.joints && hand.joints['wrist']) {
            hand.joints['wrist'].getWorldPosition(currentPos);
        } else if (controller) {
            controller.getWorldPosition(currentPos);
        } else {
            return;
        }

        // Move gear to follow hand/controller with offset
        state.grabbedGear.mesh.position.copy(currentPos).add(state.grabOffset);
    }

    updatePinchDetection(hand, handedness) {
        const state = this.pinchState[handedness];

        // Get thumb tip and index tip positions
        const thumbTip = hand.joints['thumb-tip'];
        const indexTip = hand.joints['index-finger-tip'];

        if (!thumbTip || !indexTip) return;

        const thumbPos = new THREE.Vector3();
        const indexPos = new THREE.Vector3();
        thumbTip.getWorldPosition(thumbPos);
        indexTip.getWorldPosition(indexPos);

        const distance = thumbPos.distanceTo(indexPos);

        // Pinch start threshold: < 0.02m
        // Pinch end threshold: > 0.04m
        if (!state.isPinching && distance < 0.02) {
            state.isPinching = true;
            this.onPinchStart(hand, handedness);
        } else if (state.isPinching && distance > 0.04) {
            state.isPinching = false;
            this.onPinchEnd(hand, handedness);
        }

        state.pinchStrength = Math.max(0, 1 - (distance / 0.04));
    }

    onPinchStart(hand, handedness) {
        // Get pinch position (midpoint between thumb and index)
        const thumbTip = hand.joints['thumb-tip'];
        const indexTip = hand.joints['index-finger-tip'];

        if (!thumbTip || !indexTip) return;

        const thumbPos = new THREE.Vector3();
        const indexPos = new THREE.Vector3();
        thumbTip.getWorldPosition(thumbPos);
        indexTip.getWorldPosition(indexPos);

        const pinchPos = thumbPos.clone().add(indexPos).multiplyScalar(0.5);

        // Find nearest gear
        let nearestGear = null;
        let nearestDist = Infinity;

        for (const gear of this.gears) {
            const dist = gear.mesh.position.distanceTo(pinchPos);
            const grabRadius = 0.05 + (gear.params.pitchDiameter * this.xrScale / 2);

            if (dist < grabRadius && dist < nearestDist) {
                nearestDist = dist;
                nearestGear = gear;
            }
        }

        if (nearestGear) {
            // Create a pseudo-controller object for hand
            const handController = {
                getWorldPosition: (target) => {
                    const wrist = hand.joints['wrist'];
                    if (wrist) {
                        wrist.getWorldPosition(target);
                    }
                    return target;
                }
            };

            this.beginGrab(nearestGear, handedness, pinchPos, handController);
        }
    }

    onPinchEnd(hand, handedness) {
        if (this.grabState[handedness].isGrabbing) {
            this.releaseGrab(handedness);
        }
    }

    updateControllerRays() {
        // Update ray colors based on what they're pointing at
        [
            { controller: this.controller1, ray: this.controllerRay1, handedness: 'right' },
            { controller: this.controller2, ray: this.controllerRay2, handedness: 'left' }
        ].forEach(({ controller, ray, handedness }) => {
            if (!controller || !ray || !ray.visible) return;

            const tempMatrix = new THREE.Matrix4();
            tempMatrix.identity().extractRotation(controller.matrixWorld);

            const origin = new THREE.Vector3();
            controller.getWorldPosition(origin);

            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyMatrix4(tempMatrix);

            this.xrRaycaster.set(origin, direction);

            // Check for intersections with gears and UI
            const gearMeshes = this.gears.map(g => g.mesh);
            const allInteractables = [...gearMeshes];

            // Add UI buttons if panels exist
            if (this.xrPanels.left) {
                this.xrPanels.left.traverse(child => {
                    if (child.userData.isButton || child.userData.isSlider) {
                        allInteractables.push(child);
                    }
                });
            }
            if (this.xrPanels.right) {
                this.xrPanels.right.traverse(child => {
                    if (child.userData.isButton || child.userData.isSlider) {
                        allInteractables.push(child);
                    }
                });
            }
            if (this.xrPanels.top) {
                this.xrPanels.top.traverse(child => {
                    if (child.userData.isButton || child.userData.isSlider) {
                        allInteractables.push(child);
                    }
                });
            }

            const intersects = this.xrRaycaster.intersectObjects(allInteractables);

            if (intersects.length > 0) {
                // Green when hovering interactive object
                ray.material.color.setHex(0x27ae60);
            } else {
                // Blue idle
                ray.material.color.setHex(0x4a90d9);
            }
        });
    }

    triggerHaptic(handedness, intensity, duration) {
        const controller = handedness === 'right' ? this.controller1 : this.controller2;

        if (!controller) return;

        const session = this.renderer.xr.getSession();
        if (!session) return;

        // Find the gamepad for this controller
        const inputSource = session.inputSources.find(source => {
            return source.handedness === handedness;
        });

        if (inputSource && inputSource.gamepad && inputSource.gamepad.hapticActuators) {
            const actuator = inputSource.gamepad.hapticActuators[0];
            if (actuator) {
                actuator.pulse(intensity, duration);
            }
        }
    }

    // ==================== TWO-HAND Z-AXIS CONTROL ====================

    onSqueezeStart(event, handedness) {
        // Check if other hand is already grabbing a gear
        const otherHand = handedness === 'right' ? 'left' : 'right';
        const otherState = this.grabState[otherHand];

        if (otherState.isGrabbing && otherState.grabbedGear) {
            // Start two-hand mode for Z-axis control
            this.twoHandGrab.active = true;
            this.twoHandGrab.gear = otherState.grabbedGear;

            // Calculate initial hand distance
            const controller1Pos = new THREE.Vector3();
            const controller2Pos = new THREE.Vector3();
            this.controller1.getWorldPosition(controller1Pos);
            this.controller2.getWorldPosition(controller2Pos);

            this.twoHandGrab.initialHandDistance = controller1Pos.distanceTo(controller2Pos);
            this.twoHandGrab.initialGearZ = otherState.grabbedGear.mesh.position.z;

            // Haptic feedback for entering two-hand mode
            this.triggerHaptic('left', 0.4, 50);
            this.triggerHaptic('right', 0.4, 50);
        }
    }

    onSqueezeEnd(event, handedness) {
        if (this.twoHandGrab.active) {
            // End two-hand mode
            this.twoHandGrab.active = false;
            this.twoHandGrab.gear = null;

            // Light haptic for exiting two-hand mode
            this.triggerHaptic(handedness, 0.2, 30);
        }
    }

    updateTwoHandGrab() {
        if (!this.twoHandGrab.active || !this.twoHandGrab.gear) return;

        // Get current hand distance
        const controller1Pos = new THREE.Vector3();
        const controller2Pos = new THREE.Vector3();
        this.controller1.getWorldPosition(controller1Pos);
        this.controller2.getWorldPosition(controller2Pos);

        const currentDistance = controller1Pos.distanceTo(controller2Pos);

        // Map distance change to Z position
        // Moving hands apart = positive Z, moving hands together = negative Z
        const distanceDelta = currentDistance - this.twoHandGrab.initialHandDistance;
        const zSensitivity = 100; // Adjust for finer/coarser control

        this.twoHandGrab.gear.mesh.position.z = this.twoHandGrab.initialGearZ + distanceDelta * zSensitivity;
    }

    // ==================== XR UI BUTTON INTERACTION ====================

    checkXRButtonPress(origin, direction, handedness) {
        if (!this.xrPanels.left && !this.xrPanels.right && !this.xrPanels.top) return;

        this.xrRaycaster.set(origin, direction);

        const buttons = [];
        const collectButtons = (panel) => {
            if (!panel) return;
            panel.traverse(child => {
                if (child.userData.isButton) {
                    buttons.push(child);
                }
            });
        };

        collectButtons(this.xrPanels.left);
        collectButtons(this.xrPanels.right);
        collectButtons(this.xrPanels.top);

        const intersects = this.xrRaycaster.intersectObjects(buttons);

        if (intersects.length > 0) {
            const button = intersects[0].object;
            if (button.userData.onClick) {
                button.userData.onClick();
                this.triggerHaptic(handedness, 0.4, 30);

                // Visual feedback - briefly change color
                const originalColor = button.material.color.getHex();
                button.material.color.setHex(0x88ff88);
                setTimeout(() => {
                    button.material.color.setHex(originalColor);
                }, 100);
            }
        }
    }

    // ==================== XR 3D UI PANELS ====================

    createXRPanels() {
        // Create left control panel
        this.xrPanels.left = this.createControlsPanel();
        this.scene.add(this.xrPanels.left);

        // Create right info panel
        this.xrPanels.right = this.createInfoPanel();
        this.scene.add(this.xrPanels.right);

        // Create top quick actions panel
        this.xrPanels.top = this.createQuickActionsPanel();
        this.scene.add(this.xrPanels.top);
    }

    removeXRPanels() {
        if (this.xrPanels.left) {
            this.scene.remove(this.xrPanels.left);
            this.xrPanels.left = null;
        }
        if (this.xrPanels.right) {
            this.scene.remove(this.xrPanels.right);
            this.xrPanels.right = null;
        }
        if (this.xrPanels.top) {
            this.scene.remove(this.xrPanels.top);
            this.xrPanels.top = null;
        }
    }

    createControlsPanel() {
        const panel = new THREE.Group();
        panel.name = 'controlsPanel';

        // Panel background
        const bgGeometry = new THREE.PlaneGeometry(0.5, 0.7);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        panel.add(background);

        // Title
        const titleCanvas = this.createTextCanvas('Gear Controls', 200, 30, '18px Arial', '#4a90d9');
        const titleTexture = new THREE.CanvasTexture(titleCanvas);
        const titleMaterial = new THREE.MeshBasicMaterial({ map: titleTexture, transparent: true });
        const titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.06), titleMaterial);
        titleMesh.position.set(0, 0.3, 0.01);
        panel.add(titleMesh);

        // Gear Management buttons
        let yPos = 0.2;
        const buttonSpacing = 0.08;

        const addGearBtn = this.create3DButton(0.4, 0.06, 'Add Gear', 0x4a90d9, () => this.addGear());
        addGearBtn.position.set(0, yPos, 0.01);
        panel.add(addGearBtn);

        yPos -= buttonSpacing;
        const deleteBtn = this.create3DButton(0.4, 0.06, 'Delete Selected', 0xf44336, () => this.deleteSelectedGear());
        deleteBtn.position.set(0, yPos, 0.01);
        panel.add(deleteBtn);

        yPos -= buttonSpacing;
        const resetBtn = this.create3DButton(0.4, 0.06, 'Reset Scene', 0xff9800, () => this.resetScene());
        resetBtn.position.set(0, yPos, 0.01);
        panel.add(resetBtn);

        // Animation section label
        yPos -= buttonSpacing + 0.02;
        const animLabel = this.createTextCanvas('Animation', 150, 24, '14px Arial', '#a0a0a0');
        const animTexture = new THREE.CanvasTexture(animLabel);
        const animMaterial = new THREE.MeshBasicMaterial({ map: animTexture, transparent: true });
        const animMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.05), animMaterial);
        animMesh.position.set(0, yPos, 0.01);
        panel.add(animMesh);

        // Play/Pause/Reset buttons in a row
        yPos -= buttonSpacing;
        const playBtn = this.create3DButton(0.12, 0.06, 'Play', 0x4caf50, () => this.play());
        playBtn.position.set(-0.14, yPos, 0.01);
        panel.add(playBtn);

        const pauseBtn = this.create3DButton(0.12, 0.06, 'Pause', 0xff9800, () => this.pause());
        pauseBtn.position.set(0, yPos, 0.01);
        panel.add(pauseBtn);

        const resetAnimBtn = this.create3DButton(0.12, 0.06, 'Reset', 0x9e9e9e, () => this.resetAnimation());
        resetAnimBtn.position.set(0.14, yPos, 0.01);
        panel.add(resetAnimBtn);

        // Position panel to the left of user
        panel.position.set(-0.8, 1.2, -0.5);
        panel.rotation.y = Math.PI / 6; // 30 degrees

        return panel;
    }

    createInfoPanel() {
        const panel = new THREE.Group();
        panel.name = 'infoPanel';

        // Panel background
        const bgGeometry = new THREE.PlaneGeometry(0.4, 0.5);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        panel.add(background);

        // Title
        const titleCanvas = this.createTextCanvas('Gear Info', 160, 30, '18px Arial', '#4a90d9');
        const titleTexture = new THREE.CanvasTexture(titleCanvas);
        const titleMaterial = new THREE.MeshBasicMaterial({ map: titleTexture, transparent: true });
        const titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.06), titleMaterial);
        titleMesh.position.set(0, 0.2, 0.01);
        panel.add(titleMesh);

        // Info content placeholder (will be updated dynamically)
        const infoCanvas = this.createTextCanvas('Select a gear\nto view info', 160, 150, '14px Arial', '#a0a0a0', true);
        const infoTexture = new THREE.CanvasTexture(infoCanvas);
        const infoMaterial = new THREE.MeshBasicMaterial({ map: infoTexture, transparent: true });
        const infoMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.3), infoMaterial);
        infoMesh.position.set(0, -0.02, 0.01);
        infoMesh.name = 'infoContent';
        panel.add(infoMesh);

        // Position panel to the right of user
        panel.position.set(0.8, 1.2, -0.5);
        panel.rotation.y = -Math.PI / 6; // -30 degrees

        return panel;
    }

    createQuickActionsPanel() {
        const panel = new THREE.Group();
        panel.name = 'quickActionsPanel';

        // Panel background
        const bgGeometry = new THREE.PlaneGeometry(0.6, 0.12);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        panel.add(background);

        // Quick action buttons
        const playBtn = this.create3DButton(0.15, 0.08, 'Play', 0x4caf50, () => this.play());
        playBtn.position.set(-0.2, 0, 0.01);
        panel.add(playBtn);

        const pauseBtn = this.create3DButton(0.15, 0.08, 'Pause', 0xff9800, () => this.pause());
        pauseBtn.position.set(0, 0, 0.01);
        panel.add(pauseBtn);

        const resetBtn = this.create3DButton(0.15, 0.08, 'Reset', 0x9e9e9e, () => this.resetAnimation());
        resetBtn.position.set(0.2, 0, 0.01);
        panel.add(resetBtn);

        // Position panel above and in front of user
        panel.position.set(0, 1.8, -0.6);
        panel.rotation.x = -Math.PI / 12; // -15 degrees (tilted toward user)

        return panel;
    }

    create3DButton(width, height, label, color, onClick) {
        const button = new THREE.Group();

        // Button background
        const geometry = new THREE.BoxGeometry(width, height, 0.02);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: 0x000000,
            roughness: 0.5,
            metalness: 0.3
        });
        const mesh = new THREE.Mesh(geometry, material);
        button.add(mesh);

        // Button label
        const canvas = this.createTextCanvas(label, width * 400, height * 400, '16px Arial', '#ffffff');
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, height * 0.7), labelMaterial);
        labelMesh.position.z = 0.011;
        button.add(labelMesh);

        // Store click handler and mark as button
        mesh.userData.isButton = true;
        mesh.userData.onClick = onClick;
        mesh.userData.buttonGroup = button;

        return button;
    }

    createTextCanvas(text, width, height, font, color, multiline = false) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (multiline) {
            const lines = text.split('\n');
            const lineHeight = parseInt(font) * 1.4;
            const startY = (height - lines.length * lineHeight) / 2 + lineHeight / 2;
            lines.forEach((line, i) => {
                ctx.fillText(line, width / 2, startY + i * lineHeight);
            });
        } else {
            ctx.fillText(text, width / 2, height / 2);
        }

        return canvas;
    }

    updateXRUI() {
        // Update info panel content if selected gear changed
        if (this.xrPanels.right) {
            this.updateInfoPanelContent();
        }
    }

    updateInfoPanelContent() {
        const infoMesh = this.xrPanels.right?.getObjectByName('infoContent');
        if (!infoMesh) return;

        let text;
        if (this.selectedGear) {
            const gear = this.selectedGear;
            const directionText = gear.rotationDirection >= 0 ? 'CW' : 'CCW';
            text = `Teeth: ${gear.params.teeth}\n` +
                   `Pitch: ${gear.params.pitchDiameter.toFixed(1)}mm\n` +
                   `Module: ${gear.params.module}\n` +
                   `RPM: ${gear.rpm.toFixed(1)}\n` +
                   `Direction: ${directionText}\n` +
                   `Connected: ${gear.connectedTo.length}`;
        } else {
            text = 'Select a gear\nto view info';
        }

        // Update texture
        const canvas = this.createTextCanvas(text, 160, 150, '14px Arial', '#e8e8e8', true);
        infoMesh.material.map = new THREE.CanvasTexture(canvas);
        infoMesh.material.map.needsUpdate = true;
    }

    createLights() {
        // Ambient light
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        // Main directional light
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(50, 50, 100);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 500;
        this.scene.add(this.directionalLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-50, -50, 50);
        this.scene.add(fillLight);
    }

    createGrid() {
        const gridHelper = new THREE.GridHelper(200, 40, 0x444444, 0x333333);
        gridHelper.rotation.x = Math.PI / 2;
        this.scene.add(gridHelper);

        // Ground plane for shadows
        const planeGeometry = new THREE.PlaneGeometry(200, 200);
        const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
        this.groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.groundPlane.position.z = -1;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);
    }

    createControls() {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.screenSpacePanning = true;
        this.orbitControls.minDistance = 20;
        this.orbitControls.maxDistance = 500;
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Mouse events for gear selection and dragging
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('click', (e) => this.onClick(e));

        // UI Controls
        document.getElementById('btn-add-gear').addEventListener('click', () => this.addGear());
        document.getElementById('btn-delete-gear').addEventListener('click', () => this.deleteSelectedGear());
        document.getElementById('btn-reset-scene').addEventListener('click', () => this.resetScene());

        document.getElementById('btn-play').addEventListener('click', () => this.play());
        document.getElementById('btn-pause').addEventListener('click', () => this.pause());
        document.getElementById('btn-reset-animation').addEventListener('click', () => this.resetAnimation());

        document.getElementById('input-rpm').addEventListener('change', (e) => {
            this.inputRPM = parseFloat(e.target.value) || 30;
        });

        // Parameter inputs
        const paramInputs = ['param-teeth', 'param-module', 'param-pressure-angle', 'param-thickness', 'param-bore', 'param-color'];
        paramInputs.forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updateSelectedGearParams());
        });

        // Position inputs
        ['pos-x', 'pos-y', 'pos-z'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updateSelectedGearPosition());
        });

        // Display toggles
        document.getElementById('show-pitch-circle').addEventListener('change', (e) => {
            this.showPitchCircle = e.target.checked;
            this.updateDisplayOptions();
        });
        document.getElementById('show-center').addEventListener('change', (e) => {
            this.showCenter = e.target.checked;
            this.updateDisplayOptions();
        });
        document.getElementById('show-labels').addEventListener('change', (e) => {
            this.showLabels = e.target.checked;
            this.updateDisplayOptions();
        });

        // Theme toggle
        document.getElementById('btn-theme-toggle').addEventListener('click', () => this.toggleTheme());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateMouse(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onClick(event) {
        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const gearMeshes = this.gears.map(g => g.mesh);
        const intersects = this.raycaster.intersectObjects(gearMeshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const gear = this.gears.find(g => g.mesh === clickedMesh);
            this.selectGear(gear);
        } else {
            this.selectGear(null);
        }
    }

    onMouseDown(event) {
        if (event.button !== 0) return;

        this.updateMouse(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const gearMeshes = this.gears.map(g => g.mesh);
        const intersects = this.raycaster.intersectObjects(gearMeshes);

        if (intersects.length > 0) {
            this.orbitControls.enabled = false;
            this.isDragging = true;

            const clickedMesh = intersects[0].object;
            const gear = this.gears.find(g => g.mesh === clickedMesh);
            this.selectGear(gear);

            // Calculate drag offset for XY plane
            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlaneXY, intersectPoint);
            this.dragOffset.copy(intersectPoint).sub(gear.mesh.position);

            // Store initial mouse Y and gear Z for Z-axis dragging
            this.dragStartY = event.clientY;
            this.dragStartZ = gear.mesh.position.z;
        }
    }

    onMouseMove(event) {
        this.updateMouse(event);

        if (this.isDragging && this.selectedGear) {
            if (event.shiftKey) {
                // Shift + drag: move along Z-axis
                // Mouse moving up = positive Z, mouse moving down = negative Z
                const deltaY = this.dragStartY - event.clientY;
                const zSensitivity = 0.5; // Adjust for finer/coarser control
                this.selectedGear.mesh.position.z = this.dragStartZ + deltaY * zSensitivity;
            } else {
                // Normal drag: move in XY plane
                this.raycaster.setFromCamera(this.mouse, this.camera);

                const intersectPoint = new THREE.Vector3();
                this.raycaster.ray.intersectPlane(this.dragPlaneXY, intersectPoint);

                const newPosition = intersectPoint.sub(this.dragOffset);
                this.selectedGear.mesh.position.x = newPosition.x;
                this.selectedGear.mesh.position.y = newPosition.y;

                // Check for snap-to-mesh
                this.checkSnapToMesh(this.selectedGear);
            }

            this.updatePositionInputs();
            this.updateConnections();
        } else {
            // Hover highlighting
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const gearMeshes = this.gears.map(g => g.mesh);
            const intersects = this.raycaster.intersectObjects(gearMeshes);

            this.gears.forEach(g => {
                if (g !== this.selectedGear) {
                    g.mesh.material.emissive.setHex(intersects.length > 0 && intersects[0].object === g.mesh ? 0x333333 : 0x000000);
                }
            });
        }
    }

    onMouseUp() {
        this.isDragging = false;
        this.orbitControls.enabled = true;
    }

    checkSnapToMesh(movingGear) {
        const snapThreshold = 5;

        for (const gear of this.gears) {
            if (gear === movingGear) continue;

            const idealDistance = (movingGear.params.pitchDiameter + gear.params.pitchDiameter) / 2;
            const currentDistance = movingGear.mesh.position.distanceTo(gear.mesh.position);
            const diff = Math.abs(currentDistance - idealDistance);

            if (diff < snapThreshold && diff > 0.1) {
                // Snap to ideal meshing distance
                const direction = new THREE.Vector3()
                    .subVectors(movingGear.mesh.position, gear.mesh.position)
                    .normalize();

                movingGear.mesh.position.copy(
                    gear.mesh.position.clone().add(direction.multiplyScalar(idealDistance))
                );

                // Connect gears
                if (!movingGear.connectedTo.includes(gear)) {
                    this.connectGears(movingGear, gear);
                }
                break;
            }
        }
    }

    connectGears(gear1, gear2) {
        if (!gear1.connectedTo.includes(gear2)) {
            gear1.connectedTo.push(gear2);
        }
        if (!gear2.connectedTo.includes(gear1)) {
            gear2.connectedTo.push(gear1);
        }
        this.updateGearInfo();
    }

    updateConnections() {
        // Recalculate connections based on current positions
        const meshThreshold = 3;

        for (const gear of this.gears) {
            gear.connectedTo = [];
        }

        for (let i = 0; i < this.gears.length; i++) {
            for (let j = i + 1; j < this.gears.length; j++) {
                const gear1 = this.gears[i];
                const gear2 = this.gears[j];

                const idealDistance = (gear1.params.pitchDiameter + gear2.params.pitchDiameter) / 2;
                const currentDistance = gear1.mesh.position.distanceTo(gear2.mesh.position);

                if (Math.abs(currentDistance - idealDistance) < meshThreshold) {
                    this.connectGears(gear1, gear2);
                }
            }
        }
    }

    selectGear(gear) {
        // Deselect previous
        if (this.selectedGear) {
            this.selectedGear.mesh.material.emissive.setHex(0x000000);
            if (this.selectedGear.pitchCircle) {
                this.selectedGear.pitchCircle.material.color.setHex(0x00ff00);
            }
        }

        this.selectedGear = gear;

        if (gear) {
            gear.mesh.material.emissive.setHex(0x444444);
            if (gear.pitchCircle) {
                gear.pitchCircle.material.color.setHex(0xffff00);
            }
            this.updateParamInputs(gear);
            this.updatePositionInputs();
        }

        this.updateGearInfo();
    }

    updateParamInputs(gear) {
        document.getElementById('param-teeth').value = gear.params.teeth;
        document.getElementById('param-module').value = gear.params.module;
        document.getElementById('param-pressure-angle').value = gear.params.pressureAngle;
        document.getElementById('param-thickness').value = gear.params.thickness;
        document.getElementById('param-bore').value = gear.params.boreDiameter;
        document.getElementById('param-color').value = '#' + gear.mesh.material.color.getHexString();
    }

    updatePositionInputs() {
        if (!this.selectedGear) return;
        document.getElementById('pos-x').value = Math.round(this.selectedGear.mesh.position.x);
        document.getElementById('pos-y').value = Math.round(this.selectedGear.mesh.position.y);
        document.getElementById('pos-z').value = Math.round(this.selectedGear.mesh.position.z);
    }

    updateSelectedGearParams() {
        if (!this.selectedGear) return;

        const params = {
            teeth: parseInt(document.getElementById('param-teeth').value),
            module: parseFloat(document.getElementById('param-module').value),
            pressureAngle: parseFloat(document.getElementById('param-pressure-angle').value),
            thickness: parseFloat(document.getElementById('param-thickness').value),
            boreDiameter: parseFloat(document.getElementById('param-bore').value)
        };

        // Validate
        params.teeth = Math.max(8, Math.min(100, params.teeth));
        params.module = Math.max(0.5, Math.min(10, params.module));
        params.pressureAngle = Math.max(14.5, Math.min(25, params.pressureAngle));
        params.thickness = Math.max(1, Math.min(20, params.thickness));
        params.boreDiameter = Math.max(1, Math.min(20, params.boreDiameter));

        const color = document.getElementById('param-color').value;

        // Recreate gear geometry
        const position = this.selectedGear.mesh.position.clone();
        const rotation = this.selectedGear.mesh.rotation.z;

        this.scene.remove(this.selectedGear.mesh);
        if (this.selectedGear.pitchCircle) this.scene.remove(this.selectedGear.pitchCircle);
        if (this.selectedGear.centerMarker) this.scene.remove(this.selectedGear.centerMarker);

        const gearGeom = new GearGeometry(params);
        const geometry = gearGeom.createGeometry();
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            metalness: 0.3,
            roughness: 0.7
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.copy(position);
        mesh.rotation.z = rotation;

        this.scene.add(mesh);

        // Update gear object
        this.selectedGear.mesh = mesh;
        this.selectedGear.params = {
            teeth: params.teeth,
            module: params.module,
            pressureAngle: params.pressureAngle,
            thickness: params.thickness,
            boreDiameter: params.boreDiameter,
            pitchDiameter: gearGeom.pitchDiameter
        };

        // Recreate display helpers
        this.createDisplayHelpers(this.selectedGear, gearGeom);
        this.updateDisplayOptions();
        this.updateConnections();
        this.updateGearInfo();
    }

    updateSelectedGearPosition() {
        if (!this.selectedGear) return;

        this.selectedGear.mesh.position.x = parseFloat(document.getElementById('pos-x').value) || 0;
        this.selectedGear.mesh.position.y = parseFloat(document.getElementById('pos-y').value) || 0;
        this.selectedGear.mesh.position.z = parseFloat(document.getElementById('pos-z').value) || 0;

        this.updateConnections();
    }

    addGear() {
        const params = {
            teeth: parseInt(document.getElementById('param-teeth').value) || 20,
            module: parseFloat(document.getElementById('param-module').value) || 2,
            pressureAngle: parseFloat(document.getElementById('param-pressure-angle').value) || 20,
            thickness: parseFloat(document.getElementById('param-thickness').value) || 5,
            boreDiameter: parseFloat(document.getElementById('param-bore').value) || 5
        };

        const color = document.getElementById('param-color').value;

        const gearGeom = new GearGeometry(params);
        const geometry = gearGeom.createGeometry();
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            metalness: 0.3,
            roughness: 0.7
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Position new gear offset from existing ones
        const offset = this.gears.length * 50;
        mesh.position.set(offset, 0, 0);

        this.scene.add(mesh);

        const gear = {
            mesh: mesh,
            params: {
                teeth: params.teeth,
                module: params.module,
                pressureAngle: params.pressureAngle,
                thickness: params.thickness,
                boreDiameter: params.boreDiameter,
                pitchDiameter: gearGeom.pitchDiameter
            },
            rpm: 0,
            rotationDirection: 1,
            connectedTo: [],
            isDriver: this.gears.length === 0,
            pitchCircle: null,
            centerMarker: null
        };

        this.createDisplayHelpers(gear, gearGeom);
        this.gears.push(gear);
        this.selectGear(gear);
        this.updateDisplayOptions();
    }

    createDisplayHelpers(gear, gearGeom) {
        // Pitch circle
        const pitchGeometry = gearGeom.createPitchCircleGeometry();
        const pitchMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        gear.pitchCircle = new THREE.Line(pitchGeometry, pitchMaterial);
        gear.pitchCircle.visible = this.showPitchCircle;
        gear.mesh.add(gear.pitchCircle);

        // Center marker
        const centerGeometry = new THREE.SphereGeometry(1, 16, 16);
        const centerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        gear.centerMarker = new THREE.Mesh(centerGeometry, centerMaterial);
        gear.centerMarker.position.z = gear.params.thickness + 0.5;
        gear.centerMarker.visible = this.showCenter;
        gear.mesh.add(gear.centerMarker);
    }

    deleteSelectedGear() {
        if (!this.selectedGear) return;

        // Remove from connected gears
        for (const gear of this.gears) {
            gear.connectedTo = gear.connectedTo.filter(g => g !== this.selectedGear);
        }

        this.scene.remove(this.selectedGear.mesh);
        this.gears = this.gears.filter(g => g !== this.selectedGear);
        this.selectedGear = null;
        this.updateGearInfo();
    }

    resetScene() {
        for (const gear of this.gears) {
            this.scene.remove(gear.mesh);
        }
        this.gears = [];
        this.selectedGear = null;
        this.isPlaying = false;
        this.updateGearInfo();
    }

    play() {
        this.isPlaying = true;
        this.calculateGearSpeeds();
    }

    pause() {
        this.isPlaying = false;
    }

    resetAnimation() {
        this.isPlaying = false;
        for (const gear of this.gears) {
            gear.mesh.rotation.z = 0;
        }
    }

    calculateGearSpeeds() {
        // Find driver gear (first gear or marked as driver)
        const driver = this.gears.find(g => g.isDriver) || this.gears[0];
        if (!driver) return;

        driver.rpm = this.inputRPM;
        driver.rotationDirection = 1;

        // BFS to propagate speeds through connected gears
        const visited = new Set();
        const queue = [driver];
        visited.add(driver);

        while (queue.length > 0) {
            const current = queue.shift();

            for (const connected of current.connectedTo) {
                if (!visited.has(connected)) {
                    visited.add(connected);

                    // Gear ratio: rpm2 = rpm1 * (teeth1 / teeth2)
                    const ratio = current.params.teeth / connected.params.teeth;
                    connected.rpm = current.rpm * ratio;

                    // Meshed gears rotate in opposite directions
                    connected.rotationDirection = -current.rotationDirection;

                    queue.push(connected);
                }
            }
        }

        this.updateGearInfo();
    }

    updateDisplayOptions() {
        for (const gear of this.gears) {
            if (gear.pitchCircle) {
                gear.pitchCircle.visible = this.showPitchCircle;
            }
            if (gear.centerMarker) {
                gear.centerMarker.visible = this.showCenter;
            }
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('light-mode', !this.isDarkMode);

        if (this.isDarkMode) {
            this.scene.background.setHex(0x1a1a2e);
        } else {
            this.scene.background.setHex(0xf5f5f5);
        }
    }

    updateGearInfo() {
        const content = document.getElementById('gear-info-content');

        if (!this.selectedGear) {
            content.innerHTML = '<p class="placeholder">Select a gear to view info</p>';
            return;
        }

        const gear = this.selectedGear;
        const directionClass = gear.rotationDirection >= 0 ? 'cw' : 'ccw';
        const directionText = gear.rotationDirection >= 0 ? 'CW' : 'CCW';

        let ratioText = '-';
        if (gear.connectedTo.length > 0) {
            const ratios = gear.connectedTo.map(g =>
                `${gear.params.teeth}:${g.params.teeth}`
            ).join(', ');
            ratioText = ratios;
        }

        content.innerHTML = `
            <div class="info-row">
                <span class="info-label">Teeth</span>
                <span class="info-value">${gear.params.teeth}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Pitch Diameter</span>
                <span class="info-value">${gear.params.pitchDiameter.toFixed(2)} mm</span>
            </div>
            <div class="info-row">
                <span class="info-label">Module</span>
                <span class="info-value">${gear.params.module}</span>
            </div>
            <div class="info-row">
                <span class="info-label">RPM</span>
                <span class="info-value">${gear.rpm.toFixed(1)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Direction</span>
                <span class="info-value ${directionClass}">${directionText}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Gear Ratio</span>
                <span class="info-value">${ratioText}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Connected</span>
                <span class="info-value">${gear.connectedTo.length} gear(s)</span>
            </div>
        `;
    }

    animate() {
        // Use setAnimationLoop for XR compatibility
        this.renderer.setAnimationLoop((time, frame) => this.render(time, frame));
    }

    render(time, frame) {
        const deltaTime = 1 / 60; // Assuming 60 FPS

        if (this.isPlaying) {
            this.updatePhysics(deltaTime);
        }

        // XR-specific updates
        if (this.isXRPresenting) {
            this.updateXRInteraction();
            this.updateXRUI();
        } else {
            this.orbitControls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    updatePhysics(deltaTime) {
        for (const gear of this.gears) {
            // Convert RPM to radians per second
            const radiansPerSecond = (gear.rpm * 2 * Math.PI) / 60;
            gear.mesh.rotation.z += radiansPerSecond * gear.rotationDirection * deltaTime;
        }
    }
}
