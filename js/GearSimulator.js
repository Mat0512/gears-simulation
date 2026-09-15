import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { XRButton } from "three/addons/webxr/XRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { OculusHandModel } from "three/addons/webxr/OculusHandModel.js";
import { GearGeometry } from "./GearGeometry.js";
import { asset } from './assetPath.js';
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { isLocked, reportLocked } from './edition/Edition.js';
import { TRIAL_LIMITS } from './edition/features.js';
import { COLOR, INK, ROLE, PANEL, ROW, EDGE, CONTENT_W, GAP, LAYOUT, centreForTop,
         PX_PER_M, TYPE, FONT_STACK, createFlow, fitText, fontSizePx } from './xr/theme.js';
import { makePanelGround, layerPanel } from './xr/panelLayer.js';

/**
 * Button label metrics.
 *
 * The canvas used to be sized `width * 400`, which gave a 0.045 m button an
 * 18-PIXEL canvas while the label was drawn at a fixed 16px — so "-0.5" was
 * clipped to a stub at both edges, and even "+10" lost its ends. Pixels per
 * metre is now a real density and the font is derived from the button's height,
 * so a label renders at the same size whatever the button.
 */
/**
 * The gear's manufacturing spec — everything except TEETH.
 *
 * Teeth is deliberately absent: the ratio of teeth sets the ratio of turns, and
 * that is the whole lesson. A trial that cannot change it cannot demonstrate
 * the module at all.
 */
const SPEC_PARAMS = new Set(["module", "pressureAngle", "thickness", "boreDiameter"]);

/** Clearance either side of the label, in metres. */
const BUTTON_PAD_M = 0.011;
/** Gap between items in a control row, in metres. */
const ROW_GAP_M = 0.007;

/**
 * Bind a DOM control if it is there, and say so once if it is not.
 *
 * Every control used to be bound as
 * `document.getElementById(id).addEventListener(...)`, so ONE missing element
 * threw inside the constructor and took the whole module down — no scene, no
 * gears, just a null-property error pointing at a minified frame. That is
 * exactly what a page which does not carry the full control panel produced.
 *
 * A missing optional control should cost that control, not the lesson.
 */
function bindControl(id, event, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`[gears] no #${id} on this page — that control is inactive`);
        return null;
    }
    el.addEventListener(event, handler);
    return el;
}

/** One reusable 2D context for measuring text; making one per call is wasteful. */
let _measureCtx = null;
function measureCtx() {
    if (!_measureCtx) _measureCtx = document.createElement("canvas").getContext("2d");
    return _measureCtx;
}
function measureTextWidth(text, font) {
    const ctx = measureCtx();
    ctx.font = font;
    return ctx.measureText(String(text)).width;
}

/** Trims a step to something a learner reads: 1, 0.5, 10 — never 0.50. */
function stepLabel(sign, value) {
    return `${sign}${Number(Number(value).toFixed(2))}`;
}

        // Hand meshes are VENDORED into public/, not fetched from jsDelivr.
        // three.js defaults this path to cdn.jsdelivr.net and downloads the
        // meshes every session; on a classroom LAN with no route out, hand
        // tracking then renders nothing at all — while working perfectly on a
        // machine that has internet.
// OculusHandModel takes a LOADER here, not a path — a GLTFLoader with the
// path already set is handed straight to XRHandMeshModel.
const handProfileLoader = () => new GLTFLoader().setPath(asset('hand-profiles/generic-hand/'));

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
    this.nextGearId = 1;

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
      left: {
        isGrabbing: false,
        grabbedGear: null,
        grabOffset: new THREE.Vector3(),
      },
      right: {
        isGrabbing: false,
        grabbedGear: null,
        grabOffset: new THREE.Vector3(),
      },
    };

    // XR pinch state (per hand)
    this.pinchState = {
      left: { isPinching: false, pinchStrength: 0 },
      right: { isPinching: false, pinchStrength: 0 },
    };

    // Two-hand grab for Z-axis control
    this.twoHandGrab = {
      active: false,
      gear: null,
      initialHandDistance: 0,
      initialGearZ: 0,
    };

    // XR 3D UI panels
    this.xrPanels = {
      left: null,
      right: null,
      top: null,
      incompatibility: null,
    };

    // Quiz mode (set externally by main.js)
    this.quizMode = null;

    // Debug log buffer
    this.debugLogs = [];
    this.maxDebugLogs = 8;

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

    // Audio
    this.sounds = {
      playGear: null,
      placeGear: null,
      incompatibleGear: null,
      introductionGear: null,
      jammedGear: null,
      overlappingGear: null,
    };
    this.initAudio();

    this.init();
  }

  initAudio() {
    // Load sound effects
    this.sounds.playGear = new Audio(asset("play-gear.mp3"));
    this.sounds.placeGear = new Audio(asset("place-gear.mp3"));
    this.sounds.incompatibleGear = new Audio(asset("incompatible-gear.mp3"));
    this.sounds.introductionGear = new Audio(asset("introduction-gear.mp3"));
    this.sounds.jammedGear = new Audio(asset("jammed-gear.mp3"));
    this.sounds.overlappingGear = new Audio(asset("overlapping-gear.mp3"));

    // Preload audio
    this.sounds.playGear.load();
    this.sounds.placeGear.load();
    this.sounds.incompatibleGear.load();
    this.sounds.introductionGear.load();
    this.sounds.jammedGear.load();
    this.sounds.overlappingGear.load();
  }

  playSound(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }

  stopSound(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
  }

  init() {
    this.createScene();
    this.createCamera();
    this.createRenderer();
    this.createLights();
    // this.createGrid();
    this.createControls();
    this.setupEventListeners();
    this.animate();
  }

  createScene() {
    this.scene = new THREE.Scene();
    // Set default background color (dark mode)
    this.scene.background = new THREE.Color(0x1a1a2e);

    // World group for scaling in XR mode
    // Gears and grid are added here, scaled together in VR
    this.worldGroup = new THREE.Group();
    this.worldGroup.name = "worldGroup";
    this.scene.add(this.worldGroup);
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
      antialias: true,
      alpha: true
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
    // Add XR button to DOM
    const xrButton = XRButton.createButton(this.renderer, {
      mode: "immersive-vr",
      requiredFeatures: ["hand-tracking"],
    });
    document.body.appendChild(xrButton);

    // Setup controllers and hands
    this.setupControllers();
    this.setupHands();

    // XR session events
    this.renderer.xr.addEventListener("sessionstart", () =>
      this.onXRSessionStart(),
    );
    this.renderer.xr.addEventListener("sessionend", () =>
      this.onXRSessionEnd(),
    );
  }

  setupControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    // Controller 0 (typically right hand)
    this.controller1 = this.renderer.xr.getController(0);
    this.controller1.userData.handedness = "right";
    this.controller1.addEventListener("selectstart", (e) =>
      this.onSelectStart(e, "right"),
    );
    this.controller1.addEventListener("selectend", (e) =>
      this.onSelectEnd(e, "right"),
    );
    this.controller1.addEventListener("squeezestart", (e) =>
      this.onSqueezeStart(e, "right"),
    );
    this.controller1.addEventListener("squeezeend", (e) =>
      this.onSqueezeEnd(e, "right"),
    );
    this.scene.add(this.controller1);

    this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
    this.controllerGrip1.add(
      controllerModelFactory.createControllerModel(this.controllerGrip1),
    );
    this.scene.add(this.controllerGrip1);

    // Controller 1 (typically left hand)
    this.controller2 = this.renderer.xr.getController(1);
    this.controller2.userData.handedness = "left";
    this.controller2.addEventListener("selectstart", (e) =>
      this.onSelectStart(e, "left"),
    );
    this.controller2.addEventListener("selectend", (e) =>
      this.onSelectEnd(e, "left"),
    );
    this.controller2.addEventListener("squeezestart", (e) =>
      this.onSqueezeStart(e, "left"),
    );
    this.controller2.addEventListener("squeezeend", (e) =>
      this.onSqueezeEnd(e, "left"),
    );
    this.scene.add(this.controller2);

    this.controllerGrip2 = this.renderer.xr.getControllerGrip(1);
    this.controllerGrip2.add(
      controllerModelFactory.createControllerModel(this.controllerGrip2),
    );
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
      new THREE.Vector3(0, 0, -3), // 3 units length
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0x4a90d9, // Blue idle color
      linewidth: 2,
    });
    const ray = new THREE.Line(geometry, material);
    ray.name = "controllerRay";
    ray.visible = true;
    return ray;
  }

  setupHands() {
    // Hand 0 (right)
    this.hand1 = this.renderer.xr.getHand(0);
    this.hand1.userData.handedness = "right";
    this.handModel1 = new OculusHandModel(this.hand1, handProfileLoader());
    this.hand1.add(this.handModel1);
    this.scene.add(this.hand1);

    // Hand 1 (left)
    this.hand2 = this.renderer.xr.getHand(1);
    this.hand2.userData.handedness = "left";
    this.handModel2 = new OculusHandModel(this.hand2, handProfileLoader());
    this.hand2.add(this.handModel2);
    this.scene.add(this.hand2);
  }

  onXRSessionStart() {
    this.isXRPresenting = true;
    document.body.classList.add("xr-presenting");

    // Play introduction sound when entering WebXR
    this.playSound("introductionGear");

    // Store original background and make transparent for passthrough
    this.originalBackground = this.scene.background;
    this.scene.background = null;

    // Boost lighting for XR mode
    if (this.ambientLight) {
      this.originalAmbientIntensity = this.ambientLight.intensity;
      this.ambientLight.intensity = 2.0;
    }
    if (this.directionalLight) {
      this.originalDirectionalIntensity = this.directionalLight.intensity;
      this.directionalLight.intensity = 1.5;
    }

    // Hide HTML panels
    const controlsPanel = document.getElementById("controls-panel");
    const infoPanel = document.getElementById("info-panel");
    if (controlsPanel) controlsPanel.style.display = "none";
    if (infoPanel) infoPanel.style.display = "none";

    // Scale world group for VR (convert mm to meters)
    // Original units are in mm, XR expects meters
    // xrScale = 0.01 means 1 unit = 1cm (so 40mm gear = 0.4m = 40cm diameter)
    this.worldGroup.scale.setScalar(this.xrScale);

    // Position the world in front of and below the user for comfortable viewing
    this.worldGroup.position.set(0, 1.0, -0.5);

    // Create 3D UI panels
    this.createXRPanels();

    // Disable orbit controls in XR
    if (this.orbitControls) {
      this.orbitControls.enabled = false;
    }

    // Initialize quiz mode if active
    if (this.quizMode) {
      this.quizMode.init();
    }

    // Log XR session start
    this.debugLog("XR Session Started");
    this.debugLog(`Gears in scene: ${this.gears.length}`);
  }

  onXRSessionEnd() {
    this.isXRPresenting = false;
    document.body.classList.remove("xr-presenting");

    // Restore original background
    if (this.originalBackground !== undefined) {
      this.scene.background = this.originalBackground;
    }

    // Restore original lighting
    if (this.ambientLight && this.originalAmbientIntensity !== undefined) {
      this.ambientLight.intensity = this.originalAmbientIntensity;
    }
    if (this.directionalLight && this.originalDirectionalIntensity !== undefined) {
      this.directionalLight.intensity = this.originalDirectionalIntensity;
    }

    // Show HTML panels
    const controlsPanel = document.getElementById("controls-panel");
    const infoPanel = document.getElementById("info-panel");
    if (controlsPanel) controlsPanel.style.display = "";
    if (infoPanel) infoPanel.style.display = "";

    // Reset world group scale and position
    this.worldGroup.scale.setScalar(1);
    this.worldGroup.position.set(0, 0, 0);

    // Remove 3D UI panels
    this.removeXRPanels();

    // Cleanup quiz panels
    if (this.quizMode) {
      this.quizMode.removeQuizPanels();
    }

    // Re-enable orbit controls
    if (this.orbitControls) {
      this.orbitControls.enabled = true;
    }

    // Clear grab states
    this.grabState.left = {
      isGrabbing: false,
      grabbedGear: null,
      grabOffset: new THREE.Vector3(),
    };
    this.grabState.right = {
      isGrabbing: false,
      grabbedGear: null,
      grabOffset: new THREE.Vector3(),
    };
    this.twoHandGrab.active = false;

    // Hide XR incompatibility message and clear all gear incompatible states
    this.hideXRIncompatibilityMessage();
    for (const gear of this.gears) {
      if (gear && gear.incompatibleWith) {
        this.clearIncompatibleState(gear);
      }
    }
  }

  // ==================== XR INTERACTION METHODS ====================

  onSelectStart(event, handedness) {
    const controller =
      handedness === "right" ? this.controller1 : this.controller2;
    const ray =
      handedness === "right" ? this.controllerRay1 : this.controllerRay2;

    this.debugLog(`SELECT [${handedness}]`);

    // Get controller position and direction
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    const origin = new THREE.Vector3();
    controller.getWorldPosition(origin);

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyMatrix4(tempMatrix);

    this.xrRaycaster.set(origin, direction);

    // Check for gear intersection
    const gearMeshes = this.gears.map((g) => g.mesh);
    const intersects = this.xrRaycaster.intersectObjects(gearMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const gear = this.gears.find((g) => g.mesh === clickedMesh);

      if (gear) {
        this.beginGrab(gear, handedness, intersects[0].point, controller);
        // Hide ray while grabbing
        if (ray) ray.visible = false;
      }
    } else {
      this.debugLog(`  no gear hit, checking UI`);
      // Check for UI button intersection
      this.checkXRButtonPress(origin, direction, handedness);
    }
  }

  onSelectEnd(event, handedness) {
    const ray =
      handedness === "right" ? this.controllerRay1 : this.controllerRay2;

    if (this.grabState[handedness].isGrabbing) {
      this.debugLog(`SELECT END [${handedness}]`);
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
    // Need to transform controller world position to worldGroup local space
    const controllerPos = new THREE.Vector3();
    controller.getWorldPosition(controllerPos);

    // Convert controller position to local worldGroup space
    const localControllerPos = this.worldGroup.worldToLocal(
      controllerPos.clone(),
    );

    // Offset is in local space (gear position is already in local space)
    state.grabOffset.copy(gear.mesh.position).sub(localControllerPos);

    // Mark gear as grabbed
    gear.mesh.userData.isGrabbed = true;
    gear.mesh.userData.grabHand = handedness;

    // Visual feedback - scale up slightly and increase emissive
    gear.mesh.scale.set(1.02, 1.02, 1.02);
    gear.mesh.material.emissive.setHex(0x555555);

    // Select this gear
    this.selectGear(gear);

    // Debug logging
    const pos = gear.mesh.position;
    this.debugLog(
      `GRAB [${handedness}] Gear#${gear.id} T:${gear.params.teeth}`,
    );
    this.debugLog(
      `  pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`,
    );
  }

  releaseGrab(handedness) {
    try {
      const state = this.grabState[handedness];

      if (!state.isGrabbing || !state.grabbedGear) return;

      const gear = state.grabbedGear;

      // Safely get position
      const pos = gear.mesh ? gear.mesh.position : { x: 0, y: 0, z: 0 };

      this.debugLog(`RELEASE [${handedness}] Gear#${gear.id}`);
      this.debugLog(
        `  pos: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`,
      );

      // Check for snap-to-mesh (with error handling)
      let snapped = false;
      try {
        snapped = this.checkSnapToMesh(gear);
      } catch (snapErr) {
        this.debugLog(`  snap error: ${snapErr.message}`);
      }

      if (snapped) {
        this.debugLog(`  SNAPPED!`);
        setTimeout(() => this.triggerHaptic(handedness, 0.6, 100), 120);
      }

      // Reset gear visual state
      if (gear.mesh) {
        gear.mesh.scale.set(1, 1, 1);
        // Only reset emissive if NOT in incompatible state
        if (gear.mesh.material && !gear.incompatibleWith) {
          if (gear === this.selectedGear) {
            gear.mesh.material.emissive.setHex(0x00aa00);
          } else {
            gear.mesh.material.emissive.setHex(0x000000);
          }
        }
        gear.mesh.userData.isGrabbed = false;
        gear.mesh.userData.grabHand = null;
      }

      // Clear state BEFORE updateConnections
      state.isGrabbing = false;
      state.grabbedGear = null;
      state.grabOffset.set(0, 0, 0);

      // Update connections (with error handling)
      try {
        this.updateConnections();
      } catch (connErr) {
        this.debugLog(`  conn error: ${connErr.message}`);
      }

      this.debugLog(`  release complete`);
    } catch (err) {
      console.error("releaseGrab error:", err);

      // // Force clear state on error
      const state = this.grabState[handedness];
      if (state) {
        // this.debugLog(`gears: ${this.gears}`);

        state.isGrabbing = false;
        state.grabbedGear = null;
        state.grabOffset.set(0, 0, 0);
      }
    }
  }

  updateXRInteraction() {
    // Update controller/hand grabbing
    this.updateGrabbing("right", this.controller1, this.hand1);
    this.updateGrabbing("left", this.controller2, this.hand2);

    // Update hand pinch detection
    if (
      this.hand1 &&
      this.hand1.joints &&
      Object.keys(this.hand1.joints).length > 0
    ) {
      this.updatePinchDetection(this.hand1, "right");
    }
    if (
      this.hand2 &&
      this.hand2.joints &&
      Object.keys(this.hand2.joints).length > 0
    ) {
      this.updatePinchDetection(this.hand2, "left");
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

    // Get current position from controller or hand (in world space)
    const worldPos = new THREE.Vector3();

    // Prefer hand position if available, otherwise use controller
    if (hand && hand.joints && hand.joints["wrist"]) {
      hand.joints["wrist"].getWorldPosition(worldPos);
    } else if (controller) {
      controller.getWorldPosition(worldPos);
    } else {
      return;
    }

    // Convert world position to local worldGroup space
    const localPos = this.worldGroup.worldToLocal(worldPos.clone());

    // Move gear to follow hand/controller with offset (in local space)
    state.grabbedGear.mesh.position.copy(localPos).add(state.grabOffset);
  }

  updatePinchDetection(hand, handedness) {
    const state = this.pinchState[handedness];

    // Get thumb tip and index tip positions
    const thumbTip = hand.joints["thumb-tip"];
    const indexTip = hand.joints["index-finger-tip"];

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

    state.pinchStrength = Math.max(0, 1 - distance / 0.04);
  }

  onPinchStart(hand, handedness) {
    // Get pinch position (midpoint between thumb and index) in world space
    const thumbTip = hand.joints["thumb-tip"];
    const indexTip = hand.joints["index-finger-tip"];

    if (!thumbTip || !indexTip) return;

    const thumbPos = new THREE.Vector3();
    const indexPos = new THREE.Vector3();
    thumbTip.getWorldPosition(thumbPos);
    indexTip.getWorldPosition(indexPos);

    const pinchPosWorld = thumbPos.clone().add(indexPos).multiplyScalar(0.5);

    // Convert pinch position to local worldGroup space for distance comparison
    const pinchPosLocal = this.worldGroup.worldToLocal(pinchPosWorld.clone());

    this.debugLog(`PINCH [${handedness}] detected`);

    // Find nearest gear (gear positions are in local space)
    let nearestGear = null;
    let nearestDist = Infinity;

    for (const gear of this.gears) {
      const dist = gear.mesh.position.distanceTo(pinchPosLocal);
      // grabRadius in local space (pitch diameter is in mm)
      const grabRadius = 5 + gear.params.pitchDiameter / 2;

      if (dist < grabRadius && dist < nearestDist) {
        nearestDist = dist;
        nearestGear = gear;
      }
    }

    if (nearestGear) {
      // Create a pseudo-controller object for hand
      const handController = {
        getWorldPosition: (target) => {
          const wrist = hand.joints["wrist"];
          if (wrist) {
            wrist.getWorldPosition(target);
          }
          return target;
        },
      };

      this.beginGrab(nearestGear, handedness, pinchPosWorld, handController);
    } else {
      this.debugLog(`  no gear in range (dist: ${nearestDist.toFixed(1)})`);
    }
  }

  onPinchEnd(hand, handedness) {
    if (this.grabState[handedness].isGrabbing) {
      this.debugLog(`PINCH END [${handedness}]`);
      this.releaseGrab(handedness);
    }
  }

  updateControllerRays() {
    // Update ray colors based on what they're pointing at
    [
      {
        controller: this.controller1,
        ray: this.controllerRay1,
        handedness: "right",
      },
      {
        controller: this.controller2,
        ray: this.controllerRay2,
        handedness: "left",
      },
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
      const gearMeshes = this.gears.map((g) => g.mesh);
      const allInteractables = [...gearMeshes];

      // Add UI buttons if panels exist
      if (this.xrPanels.left) {
        this.xrPanels.left.traverse((child) => {
          if (child.userData.isButton || child.userData.isSlider) {
            allInteractables.push(child);
          }
        });
      }
      if (this.xrPanels.right) {
        this.xrPanels.right.traverse((child) => {
          if (child.userData.isButton || child.userData.isSlider) {
            allInteractables.push(child);
          }
        });
      }
      if (this.xrPanels.top) {
        this.xrPanels.top.traverse((child) => {
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

  //   triggerHaptic(handedness, intensity, duration) {
  //     const controller =
  //       handedness === "right" ? this.controller1 : this.controller2;

  //     if (!controller) return;

  //     const session = this.renderer.xr.getSession();
  //     if (!session) return;

  //     // Find the gamepad for this controller
  //     const inputSource = session.inputSources.find((source) => {
  //       return source.handedness === handedness;
  //     });

  //     if (
  //       inputSource &&
  //       inputSource.gamepad &&
  //       inputSource.gamepad.hapticActuators
  //     ) {
  //       const actuator = inputSource.gamepad.hapticActuators[0];
  //       if (actuator) {
  //         actuator.pulse(intensity, duration);
  //       }
  //     }
  //   }

  // ==================== TWO-HAND Z-AXIS CONTROL ====================

  onSqueezeStart(event, handedness) {
    // Check if other hand is already grabbing a gear
    const otherHand = handedness === "right" ? "left" : "right";
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

      this.twoHandGrab.initialHandDistance =
        controller1Pos.distanceTo(controller2Pos);
      this.twoHandGrab.initialGearZ = otherState.grabbedGear.mesh.position.z;
    }
  }

  onSqueezeEnd(event, handedness) {
    if (this.twoHandGrab.active) {
      // End two-hand mode
      this.twoHandGrab.active = false;
      this.twoHandGrab.gear = null;
    }
  }

  updateTwoHandGrab() {
    if (!this.twoHandGrab.active || !this.twoHandGrab.gear) return;

    // Get current hand distance (in world space)
    const controller1Pos = new THREE.Vector3();
    const controller2Pos = new THREE.Vector3();
    this.controller1.getWorldPosition(controller1Pos);
    this.controller2.getWorldPosition(controller2Pos);

    const currentDistance = controller1Pos.distanceTo(controller2Pos);

    // Map distance change to Z position
    // Moving hands apart = positive Z, moving hands together = negative Z
    const distanceDelta =
      currentDistance - this.twoHandGrab.initialHandDistance;

    // Sensitivity adjusted for scaled world (hand distance is in meters, gear Z is in mm)
    // Divide by xrScale to convert world meters to local mm
    const zSensitivity = 1 / this.xrScale;

    this.twoHandGrab.gear.mesh.position.z =
      this.twoHandGrab.initialGearZ + distanceDelta * zSensitivity;
  }

  // ==================== XR UI BUTTON INTERACTION ====================

  checkXRButtonPress(origin, direction, handedness) {
    if (!this.xrPanels.left && !this.xrPanels.right && !this.xrPanels.top && !this.quizMode)
      return;

    this.xrRaycaster.set(origin, direction);

    const buttons = [];
    const collectButtons = (panel) => {
      if (!panel) return;
      panel.traverse((child) => {
        if (child.userData.isButton) {
          buttons.push(child);
        }
      });
    };

    collectButtons(this.xrPanels.left);
    collectButtons(this.xrPanels.right);
    collectButtons(this.xrPanels.top);

    // Include quiz mode buttons
    if (this.quizMode) {
      this.quizMode.collectButtons(buttons);
    }

    const intersects = this.xrRaycaster.intersectObjects(buttons);

    if (intersects.length > 0) {
      const button = intersects[0].object;
      if (button.userData.onClick) {
        button.userData.onClick();

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
    // Clear debug logs when exiting XR
    this.debugLogs = [];
  }

  createControlsPanel() {
    // Rows are laid out from the top edge downward, so the panel's height is a
    // consequence of its content rather than a number someone picked. The old
    // flow started at a hand-chosen 0.48 and stepped by a mix of rowSpacing,
    // buttonSpacing + 0.02 and bare literals — which is how the content came to
    // stop 0.3 m short of the bottom edge.
    const flow = createFlow();

    const panel = new THREE.Group();
    panel.name = "controlsPanel";
    // Stacking rules on, before anything is added to it.
    layerPanel(panel);

    // Panel background (taller to accommodate new controls)
    // Opaque on purpose — see js/xr/panelLayer.js.
    const background = makePanelGround(PANEL.width, PANEL.height, COLOR.bgPanel);
    panel.add(background);

    // Title
    const titleCanvas = this.createTextCanvas(
      "Gear Controls",
      Math.round(CONTENT_W * PX_PER_M),
      Math.round(ROW.title * PX_PER_M),
      `bold ${TYPE.title.preferred}px ${FONT_STACK}`,
      INK.accent,
      false,
      "left",
    );
    const titleTexture = new THREE.CanvasTexture(titleCanvas);
    const titleMaterial = new THREE.MeshBasicMaterial({
      map: titleTexture,
      transparent: true,
    });
    const titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CONTENT_W, 0.06),
      titleMaterial,
    );
    titleMesh.position.set(0, flow.row(ROW.title), 0.01);
    panel.add(titleMesh);

    // Gear Management buttons
    let yPos = flow.row(ROW.button, ROW.gap);

    const addGearBtn = this.create3DButton(
      CONTENT_W,
      0.05,
      "Add Gear",
      ROLE.primary,
      () => this.addGear(),
    );
    addGearBtn.position.set(0, yPos, 0.01);
    panel.add(addGearBtn);

    yPos = flow.row(ROW.button, ROW.gap);
    const deleteBtn = this.create3DButton(
      CONTENT_W,
      0.05,
      "Delete Selected",
      ROLE.danger,
      () => this.deleteSelectedGear(),
    );
    deleteBtn.position.set(0, yPos, 0.01);
    panel.add(deleteBtn);

    yPos = flow.row(ROW.button, ROW.gap);
    const resetBtn = this.create3DButton(
      CONTENT_W,
      0.05,
      "Reset Scene",
      ROLE.warning,
      () => this.resetScene(),
    );
    resetBtn.position.set(0, yPos, 0.01);
    panel.add(resetBtn);

    // Animation section label
    yPos = flow.row(ROW.sectionLabel, ROW.sectionGap);
    const animLabel = this.createTextCanvas(
      "Animation",
      Math.round(CONTENT_W * PX_PER_M),
      Math.round(ROW.sectionLabel * PX_PER_M),
      `bold ${TYPE.sectionLabel}px ${FONT_STACK}`,
      INK.secondary,
      false,
      "left",
    );
    const animTexture = new THREE.CanvasTexture(animLabel);
    const animMaterial = new THREE.MeshBasicMaterial({
      map: animTexture,
      transparent: true,
    });
    const animMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CONTENT_W, 0.04),
      animMaterial,
    );
    animMesh.position.set(0, yPos, 0.01);
    panel.add(animMesh);

    // Play/Pause/Reset buttons in a row
    yPos = flow.row(ROW.control, ROW.gap);
    const ANIM_W = (CONTENT_W - GAP * 2) / 3;
    const playBtn = this.create3DButton(ANIM_W, 0.05, "Play", ROLE.success, () =>
      this.play(),
    );
    playBtn.position.set(-EDGE + ANIM_W / 2, yPos, 0.01);
    panel.add(playBtn);

    const pauseBtn = this.create3DButton(ANIM_W, 0.05, "Pause", ROLE.warning, () =>
      this.pause(),
    );
    pauseBtn.position.set(0, yPos, 0.01);
    panel.add(pauseBtn);

    const resetAnimBtn = this.create3DButton(
      ANIM_W,
      0.05,
      "Reset",
      ROLE.neutral,
      () => this.resetAnimation(),
    );
    resetAnimBtn.position.set(EDGE - ANIM_W / 2, yPos, 0.01);
    panel.add(resetAnimBtn);

    // RPM Control section
    yPos = flow.row(ROW.sectionLabel, ROW.sectionGap);
    const rpmLabel = this.createTextCanvas(
      "Input RPM",
      Math.round(CONTENT_W * PX_PER_M),
      Math.round(ROW.sectionLabel * PX_PER_M),
      `bold ${TYPE.sectionLabel}px ${FONT_STACK}`,
      INK.secondary,
      false,
      "left",
    );
    const rpmTexture = new THREE.CanvasTexture(rpmLabel);
    const rpmMaterial = new THREE.MeshBasicMaterial({
      map: rpmTexture,
      transparent: true,
    });
    const rpmMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CONTENT_W, 0.04),
      rpmMaterial,
    );
    rpmMesh.position.set(0, yPos, 0.01);
    panel.add(rpmMesh);

    yPos = flow.row(ROW.control, ROW.gap);
    const rpmControl = this.createValueControl(
      "rpm",
      () => this.inputRPM,
      (val) => {
        this.inputRPM = val;
        if (this.isPlaying) this.calculateGearSpeeds();
      },
      1,
      1000,
      1,
      10,
    );
    rpmControl.position.set(0, yPos, 0.01);
    panel.add(rpmControl);

    // Gear Parameters section
    yPos = flow.row(ROW.sectionLabel, ROW.sectionGap);
    const paramsLabel = this.createTextCanvas(
      "Gear Parameters",
      Math.round(CONTENT_W * PX_PER_M),
      Math.round(ROW.sectionLabel * PX_PER_M),
      `bold ${TYPE.sectionLabel}px ${FONT_STACK}`,
      INK.secondary,
      false,
      "left",
    );
    const paramsTexture = new THREE.CanvasTexture(paramsLabel);
    const paramsMaterial = new THREE.MeshBasicMaterial({
      map: paramsTexture,
      transparent: true,
    });
    const paramsMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CONTENT_W, 0.04),
      paramsMaterial,
    );
    paramsMesh.position.set(0, yPos, 0.01);
    panel.add(paramsMesh);

    // Teeth control
    yPos = flow.row(ROW.control, ROW.gap);
    const teethControl = this.createParamControl("Teeth", "teeth", 8, 100, 1, 10);
    teethControl.position.set(0, yPos, 0.01);
    panel.add(teethControl);

    // Module control
    yPos = flow.row(ROW.control, ROW.gap);
    const moduleControl = this.createParamControl(
      "Module",
      "module",
      0.5,
      10,
      0.5,
      2,
    );
    moduleControl.position.set(0, yPos, 0.01);
    panel.add(moduleControl);

    // Pressure Angle control
    yPos = flow.row(ROW.control, ROW.gap);
    const pressureControl = this.createParamControl(
      "P.Angle",
      "pressureAngle",
      14.5,
      25,
      0.5,
      5,
    );
    pressureControl.position.set(0, yPos, 0.01);
    panel.add(pressureControl);

    // Thickness control
    yPos = flow.row(ROW.control, ROW.gap);
    const thicknessControl = this.createParamControl(
      "Thick",
      "thickness",
      1,
      20,
      1,
      5,
    );
    thicknessControl.position.set(0, yPos, 0.01);
    panel.add(thicknessControl);

    // Bore Diameter control
    yPos = flow.row(ROW.control, ROW.gap);
    const boreControl = this.createParamControl(
      "Bore",
      "boreDiameter",
      1,
      20,
      1,
      5,
    );
    boreControl.position.set(0, yPos, 0.01);
    panel.add(boreControl);

    // Position panel to the left of user
    // Mirrored with the info panel, and its TOP on the shared line at eye
    // height. It was x=-1.0 turned 30 degrees against a right panel at x=+0.8
    // turned 22.5, so neither the spacing nor the toe-in matched.
    panel.position.set(-LAYOUT.sideX, centreForTop(PANEL.height), LAYOUT.z);
    panel.rotation.y = LAYOUT.toeIn;

    return panel;
  }

  createValueControl(name, getValue, setValue, min, max, step, bigStep) {
    const group = new THREE.Group();
    group.name = `${name}Control`;

    // Value display
    const valueCanvas = this.createTextCanvas(
      getValue().toString(),
      Math.round(0.33 * PX_PER_M),
      Math.round(ROW.control * PX_PER_M),
      `bold ${TYPE.value}px ${FONT_STACK}`,
      INK.primary,
    );
    const valueTexture = new THREE.CanvasTexture(valueCanvas);
    const valueMaterial = new THREE.MeshBasicMaterial({
      map: valueTexture,
      transparent: true,
    });
    // Width is replaced once the buttons are measured — the row gives the
    // value whatever they leave, and a 0.12 plane sitting in a 0.33 slot would
    // render the number small and off to one side of its own space.
    const valueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, ROW.control),
      valueMaterial,
    );
    valueMesh.name = `${name}Value`;
    group.add(valueMesh);

    // Same grid as the parameter rows: the whole strip spans the panel's
    // content width, so this row lines up with every other one. The value takes
    // whatever the buttons do not, and every button says how much it steps.
    const specs = [];
    if (bigStep) specs.push({ label: stepLabel("-", bigStep), delta: -bigStep, color: COLOR.bgSecondary });
    specs.push({ label: stepLabel("-", step), delta: -step, color: ROLE.neutral });
    const afterValue = [{ label: stepLabel("+", step), delta: step, color: ROLE.neutral }];
    if (bigStep) afterValue.push({ label: stepLabel("+", bigStep), delta: bigStep, color: COLOR.bgSecondary });

    const BTN_H = 0.045;
    const made = [...specs, ...afterValue].map((spec) => {
      const btn = this.create3DButton(0, BTN_H, spec.label, spec.color, () => {
        const next = Math.min(max, Math.max(min, getValue() + spec.delta));
        setValue(next);
        this.updateValueDisplay(valueMesh, next);
      });
      return { btn, width: btn.userData.fittedWidth };
    });

    const buttonsW = made.reduce((sum, m) => sum + m.width, 0);
    const valueW = CONTENT_W - buttonsW - GAP * made.length;
    valueMesh.geometry.dispose();
    valueMesh.geometry = new THREE.PlaneGeometry(valueW, ROW.control);
    let x = -EDGE;
    const place = (object3D, width) => {
      object3D.position.set(x + width / 2, 0, 0.01);
      x += width + GAP;
    };

    for (let i = 0; i < specs.length; i++) {
      place(made[i].btn, made[i].width);
      group.add(made[i].btn);
    }
    place(valueMesh, valueW);
    for (let i = specs.length; i < made.length; i++) {
      place(made[i].btn, made[i].width);
      group.add(made[i].btn);
    }

    return group;
  }

  createParamControl(label, paramName, min, max, step, bigStep) {
    const group = new THREE.Group();
    group.name = `${paramName}Control`;

    // Label
    const labelCanvas = this.createTextCanvas(
      label,
      Math.round(0.12 * PX_PER_M),
      Math.round(0.035 * PX_PER_M),
      `bold ${TYPE.sectionLabel}px ${FONT_STACK}`,
      INK.secondary,
      false,
      "left",
    );
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
    });
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.035),
      labelMaterial,
    );
    // Left edge on the panel's content line, like every other row.
    labelMesh.position.set(-EDGE + 0.12 / 2, 0, 0.01);
    group.add(labelMesh);

    // Value display
    const getParamValue = () => {
      if (this.selectedGear && this.selectedGear.params) {
        return this.selectedGear.params[paramName];
      }
      // Return default from DOM if no gear selected
      const inputId = `param-${paramName === "pressureAngle" ? "pressure-angle" : paramName === "boreDiameter" ? "bore" : paramName}`;
      const input = document.getElementById(inputId);
      return input ? parseFloat(input.value) : min;
    };

    const valueCanvas = this.createTextCanvas(
      getParamValue().toString(),
      Math.round(0.08 * PX_PER_M),
      Math.round(0.035 * PX_PER_M),
      `bold ${TYPE.value}px ${FONT_STACK}`,
      INK.primary,
    );
    const valueTexture = new THREE.CanvasTexture(valueCanvas);
    const valueMaterial = new THREE.MeshBasicMaterial({
      map: valueTexture,
      transparent: true,
    });
    const valueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.035),
      valueMaterial,
    );
    valueMesh.name = `${paramName}Value`;
    group.add(valueMesh);

    // Every step button says how much it steps. The old fallback layout drew a
    // bare "-" and "+", which tells a learner that something will change but
    // not by how much — and on a 0.5 step that is the whole question.
    // A locked control is grey from the start. A lit button that refuses to
    // work reads as a broken panel; a grey one reads as a paid feature.
    const locked = SPEC_PARAMS.has(paramName) && isLocked("gears.spec");
    const bigColor = locked ? ROLE.locked : COLOR.bgSecondary;
    const stepColor = locked ? ROLE.locked : ROLE.neutral;

    const stepRow = [];
    if (bigStep) stepRow.push({ label: stepLabel("-", bigStep), delta: -bigStep, color: bigColor });
    stepRow.push({ label: stepLabel("-", step), delta: -step, color: stepColor });
    const afterValue = [{ label: stepLabel("+", step), delta: step, color: stepColor }];
    if (bigStep) afterValue.push({ label: stepLabel("+", bigStep), delta: bigStep, color: bigColor });

    const BTN_H = 0.04;
    const VALUE_W = 0.08;
    const made = [...stepRow, ...afterValue].map((spec) => {
      const btn = this.create3DButton(0, BTN_H, spec.label, spec.color, () => {
        this.adjustGearParam(paramName, spec.delta, min, max, valueMesh);
      });
      return { btn, width: btn.userData.fittedWidth };
    });

    // Laid out from MEASURED widths, right-aligned inside the panel. Fixed
    // offsets are what let a label overrun its neighbour the moment a button
    // grew to fit it, so nothing here is a hardcoded x.
    // The panel's own right edge, so the step row ends where the full-width
    // buttons above it end.
    const ROW_RIGHT = EDGE;
    const total = made.reduce((sum, m) => sum + m.width, 0)
      + VALUE_W + ROW_GAP_M * made.length;
    let x = ROW_RIGHT - total;
    const place = (object3D, width) => {
      object3D.position.set(x + width / 2, 0, 0.01);
      x += width + ROW_GAP_M;
    };

    for (let i = 0; i < stepRow.length; i++) {
      place(made[i].btn, made[i].width);
      group.add(made[i].btn);
    }
    place(valueMesh, VALUE_W);
    for (let i = stepRow.length; i < made.length; i++) {
      place(made[i].btn, made[i].width);
      group.add(made[i].btn);
    }

    return group;
  }

  adjustGearParam(paramName, delta, min, max, valueMesh) {
    // One choke point for all five controls. Teeth always passes — see
    // SPEC_PARAMS for why.
    if (SPEC_PARAMS.has(paramName) && isLocked("gears.spec")) {
      reportLocked("gears.spec");
      return;
    }

    if (!this.selectedGear) {
      this.debugLog(`No gear selected`);
      return;
    }

    // Validate gear still exists
    if (!this.gears.includes(this.selectedGear)) {
      this.debugLog(`Gear no longer exists`);
      this.selectedGear = null;
      this.updateGearInfo();
      return;
    }

    const currentVal = this.selectedGear.params[paramName];
    const newVal = Math.max(min, Math.min(max, currentVal + delta));

    if (newVal === currentVal) return;

    // Update the DOM input to match
    const inputId = `param-${paramName === "pressureAngle" ? "pressure-angle" : paramName === "boreDiameter" ? "bore" : paramName}`;
    const input = document.getElementById(inputId);
    if (input) input.value = newVal;

    // Apply the change
    this.updateSelectedGearParams();

    // Update display
    this.updateValueDisplay(valueMesh, newVal);

    this.debugLog(`${paramName}: ${newVal}`);
  }

  updateValueDisplay(mesh, value) {
    if (!mesh || !mesh.material) return;

    // Format value for display
    const displayValue = Number.isInteger(value)
      ? value.toString()
      : value.toFixed(1);

    // Dispose old texture
    if (mesh.material.map) {
      mesh.material.map.dispose();
    }

    const canvas = this.createTextCanvas(
      displayValue,
      Math.round(0.12 * PX_PER_M),
      Math.round(0.035 * PX_PER_M),
      `bold ${TYPE.value}px ${FONT_STACK}`,
      INK.primary,
    );
    mesh.material.map = new THREE.CanvasTexture(canvas);
    mesh.material.map.needsUpdate = true;
  }

  createInfoPanel() {
    // Same rule as the controls panel: content is the panel minus its padding,
    // and every element spans exactly that.
    const INFO_W = 0.4;
    const INFO_H = 0.5;
    const INFO_CONTENT = INFO_W - PANEL.padding * 2;

    const panel = new THREE.Group();
    panel.name = "infoPanel";
    // Stacking rules on, before anything is added to it.
    layerPanel(panel);

    // Panel background
    // Opaque on purpose — see js/xr/panelLayer.js.
    const background = makePanelGround(INFO_W, INFO_H, COLOR.bgPanel);
    background.name = "infoPanelBackground";
    panel.add(background);

    // Title
    const titleCanvas = this.createTextCanvas(
      "Gear Info",
      Math.round(INFO_CONTENT * PX_PER_M),
      Math.round(ROW.title * PX_PER_M),
      `bold ${TYPE.title.preferred}px ${FONT_STACK}`,
      INK.accent,
      false,
      "left",
    );
    const titleTexture = new THREE.CanvasTexture(titleCanvas);
    const titleMaterial = new THREE.MeshBasicMaterial({
      map: titleTexture,
      transparent: true,
    });
    const titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(INFO_CONTENT, 0.06),
      titleMaterial,
    );
    titleMesh.position.set(0, 0.2, 0.01);
    panel.add(titleMesh);

    // Info content placeholder (will be updated dynamically)
    const infoCanvas = this.createTextCanvas(
      "Select a gear\nto view info",
      Math.round(INFO_CONTENT * PX_PER_M),
      Math.round(0.3 * PX_PER_M),
      `bold ${TYPE.body}px ${FONT_STACK}`,
      INK.secondary,
      true,
      "left",
    );
    const infoTexture = new THREE.CanvasTexture(infoCanvas);
    const infoMaterial = new THREE.MeshBasicMaterial({
      map: infoTexture,
      transparent: true,
    });
    const infoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(INFO_CONTENT, 0.3),
      infoMaterial,
    );
    infoMesh.position.set(0, -0.02, 0.01);
    infoMesh.name = "infoContent";
    panel.add(infoMesh);

    // Position panel to the right of user
    // The mirror of the controls panel. The old comment here said -30 degrees
    // while the code said -Math.PI/8, which is -22.5.
    panel.position.set(LAYOUT.sideX, centreForTop(INFO_H), LAYOUT.z);
    panel.rotation.y = -LAYOUT.toeIn;

    return panel;
  }

  createQuickActionsPanel() {
    const panel = new THREE.Group();
    panel.name = "quickActionsPanel";
    // Stacking rules on, before anything is added to it.
    layerPanel(panel);

    // Panel background
    // Opaque on purpose — see js/xr/panelLayer.js.
    const background = makePanelGround(0.6, 0.12, 0x1a1a2e);
    panel.add(background);

    // Quick action buttons
    const playBtn = this.create3DButton(0.15, 0.08, "Play", ROLE.success, () =>
      this.play(),
    );
    playBtn.position.set(-0.2, 0, 0.01);
    panel.add(playBtn);

    const pauseBtn = this.create3DButton(0.15, 0.08, "Pause", ROLE.warning, () =>
      this.pause(),
    );
    pauseBtn.position.set(0, 0, 0.01);
    panel.add(pauseBtn);

    const resetBtn = this.create3DButton(0.15, 0.08, "Reset", ROLE.neutral, () =>
      this.resetAnimation(),
    );
    resetBtn.position.set(0.2, 0, 0.01);
    panel.add(resetBtn);

    // Position panel below, in front of user
    // Centred under the gear scene, leaning back toward the user.
    panel.position.set(0, LAYOUT.stripY, LAYOUT.stripZ);
    panel.rotation.x = -LAYOUT.stripTilt;

    return panel;
  }

  debugLog(message) {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const logEntry = `[${timestamp}] ${message}`;

    this.debugLogs.push(logEntry);

    // Keep only the last N logs
    if (this.debugLogs.length > this.maxDebugLogs) {
      this.debugLogs.shift();
    }
  }

  /**
   * Width needed to show `label` at this button height, in metres.
   *
   * `minWidth` is a floor, not a target — a row of buttons should share a size
   * where the labels allow it, and grow only where one is longer.
   */
  fitButtonWidth(label, height, minWidth = 0) {
    // Measured at the PREFERRED size, so a button given room shows its label at
    // full size. One squeezed by its caller shrinks the type instead — see
    // fitText in create3DButton.
    const textM = measureTextWidth(
      label, `bold ${TYPE.button.preferred}px ${FONT_STACK}`) / PX_PER_M;
    return Math.max(minWidth, textM + BUTTON_PAD_M * 2);
  }

  create3DButton(width, height, label, color, onClick) {
    const button = new THREE.Group();

    // The width passed in is the MINIMUM. A button that is narrower than its
    // own label is not a smaller button, it is an unreadable one.
    const fitted = this.fitButtonWidth(label, height, width);
    button.userData.fittedWidth = fitted;

    // Button background
    const geometry = new THREE.BoxGeometry(fitted, height, 0.02);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: 0x000000,
      roughness: 0.5,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    button.add(mesh);

    // Button label. The canvas matches the button's own aspect and is mapped
    // 1:1 onto a plane of the same physical size, so the text is never
    // stretched — the old 0.9 x 0.7 plane squashed every label non-uniformly.
    const canvasW = Math.round(fitted * PX_PER_M);
    const canvasH = Math.round(height * PX_PER_M);
    // Shrink to fit rather than clip: a clipped label on a headset panel is
    // worse than a smaller one, because the learner cannot tell what it lost.
    const fontPx = fitText(
      measureCtx(), label, canvasW, TYPE.button.preferred, TYPE.button.min);
    const canvas = this.createTextCanvas(
      label,
      canvasW,
      canvasH,
      `bold ${fontPx}px ${FONT_STACK}`,
      INK.primary,
    );
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(fitted, height),
      labelMaterial,
    );
    labelMesh.position.z = 0.011;
    button.add(labelMesh);

    // Store click handler and mark as button
    mesh.userData.isButton = true;
    mesh.userData.onClick = onClick;
    mesh.userData.buttonGroup = button;

    return button;
  }

  createTextCanvas(text, width, height, font, color, multiline = false, align = "center") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, width, height);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    // Where the anchor sits for each alignment. Left-aligned text is inset by
    // the same fraction the panel pads its content, so a header lines up with
    // the rows under it rather than touching the canvas edge.
    const anchorX = align === "left" ? Math.round(width * 0.02) : width / 2;

    if (multiline) {
      const lines = text.split("\n");
      // fontSizePx, NOT parseInt — parseInt('bold 30px sans-serif') is NaN and
      // a NaN baseline draws the whole block nowhere, silently.
      const lineHeight = fontSizePx(font) * 1.4;
      const startY = (height - lines.length * lineHeight) / 2 + lineHeight / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, anchorX, startY + i * lineHeight);
      });
    } else {
      ctx.fillText(text, anchorX, height / 2);
    }

    return canvas;
  }

  updateXRUI() {
    // Update info panel content if selected gear changed
    if (this.xrPanels.right) {
      this.updateInfoPanelContent();
    }

    // Update controls panel parameter displays
    if (this.xrPanels.left) {
      this.updateXRControlsPanel();
    }

    // Update quiz panels
    if (this.quizMode) {
      this.quizMode.updateUI();
    }
  }

  updateXRControlsPanel() {
    if (!this.xrPanels.left) return;

    // Update RPM display
    const rpmControl = this.xrPanels.left.getObjectByName("rpmControl");
    if (rpmControl) {
      const rpmValue = rpmControl.getObjectByName("rpmValue");
      if (rpmValue) {
        this.updateValueDisplay(rpmValue, this.inputRPM);
      }
    }

    // Update gear parameter displays if a gear is selected
    if (this.selectedGear && this.selectedGear.params) {
      const params = [
        "teeth",
        "module",
        "pressureAngle",
        "thickness",
        "boreDiameter",
      ];
      params.forEach((paramName) => {
        const control = this.xrPanels.left.getObjectByName(
          `${paramName}Control`,
        );
        if (control) {
          const valueMesh = control.getObjectByName(`${paramName}Value`);
          if (valueMesh) {
            this.updateValueDisplay(
              valueMesh,
              this.selectedGear.params[paramName],
            );
          }
        }
      });
    }
  }

  updateInfoPanelContent() {
    const infoMesh = this.xrPanels.right?.getObjectByName("infoContent");
    if (!infoMesh || !infoMesh.material) return;

    let text;
    let textColor = "#e8e8e8";
    let errorState = null; // null, "incompatible", "jamming", or "overlap"

    if (this.selectedGear && this.selectedGear.params) {
      const gear = this.selectedGear;
      const directionText = gear.rotationDirection >= 0 ? "CW" : "CCW";

      // Check if gear is in error state
      if (gear.incompatibleWith) {
        textColor = "#ffffff"; // White text on colored background

        if (gear.overlapError) {
          // Overlap error (gears too close)
          errorState = "overlap";
          text =
            `--- Gear #${gear.id} ---\n` +
            `!! OVERLAPPING !!\n` +
            `\n` +
            `Gears are too\n` +
            `close together.\n` +
            `\n` +
            `Move gear away`;
        } else if (gear.jammingError) {
          // Jamming error (locked cycle)
          errorState = "jamming";
          text =
            `--- Gear #${gear.id} ---\n` +
            `!! JAMMING !!\n` +
            `\n` +
            `Locked gear cycle\n` +
            `detected.\n` +
            `\n` +
            `Move gear away`;
        } else {
          // Module incompatibility
          errorState = "incompatible";
          const targetModule = gear.incompatibleWith.params?.module || "?";
          text =
            `--- Gear #${gear.id} ---\n` +
            `!! INCOMPATIBLE !!\n` +
            `Module: ${gear.params.module}\n` +
            `Target: ${targetModule}\n` +
            `\n` +
            `Move gear away\n` +
            `or change module`;
        }
      } else {
        text =
          `--- Gear #${gear.id} ---\n` +
          `Teeth: ${gear.params.teeth}\n` +
          `Pitch: ${gear.params.pitchDiameter.toFixed(1)}mm\n` +
          `Module: ${gear.params.module}\n` +
          `RPM: ${gear.rpm.toFixed(1)}\n` +
          `Direction: ${directionText}\n` +
          `Connected: ${gear.connectedTo ? gear.connectedTo.length : 0}`;
      }
    } else {
      text = "Select a gear\nto view info";
    }

    // Update panel background color based on error state
    const bgMesh = this.xrPanels.right?.getObjectByName("infoPanelBackground");
    if (bgMesh && bgMesh.material) {
      if (errorState === "overlap") {
        bgMesh.material.color.setHex(0x4a148c); // Dark purple for overlap
      } else if (errorState === "jamming") {
        bgMesh.material.color.setHex(0x8b4500); // Dark orange for jamming
      } else if (errorState === "incompatible") {
        bgMesh.material.color.setHex(0x8b0000); // Dark red for incompatibility
      } else {
        bgMesh.material.color.setHex(0x0f3460); // Normal blue
      }
    }

    // Dispose old texture to prevent memory leak
    if (infoMesh.material.map) {
      infoMesh.material.map.dispose();
    }

    // Update texture
    // Same density and alignment as the panel was built with — drawn any other
    // way, the text would change size the moment a gear was selected.
    const canvas = this.createTextCanvas(
      text,
      Math.round((0.4 - PANEL.padding * 2) * PX_PER_M),
      Math.round(0.3 * PX_PER_M),
      `bold ${TYPE.body}px ${FONT_STACK}`,
      textColor,
      true,
      "left",
    );
    infoMesh.material.map = new THREE.CanvasTexture(canvas);
    infoMesh.material.map.needsUpdate = true;
  }

  createLights() {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(this.ambientLight);

    // Main directional light
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
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
    this.worldGroup.add(gridHelper);

    // Ground plane for shadows
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
    const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
    this.groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.groundPlane.position.z = -1;
    this.groundPlane.receiveShadow = true;
    this.worldGroup.add(this.groundPlane);
  }

  createControls() {
    this.orbitControls = new OrbitControls(
      this.camera,
      this.renderer.domElement,
    );
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.minDistance = 20;
    this.orbitControls.maxDistance = 500;
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener("resize", () => this.onWindowResize());

    // Mouse events for gear selection and dragging
    this.canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.canvas.addEventListener("mouseup", () => this.onMouseUp());
    this.canvas.addEventListener("click", (e) => this.onClick(e));

    // UI Controls
    bindControl("btn-add-gear", "click", () => this.addGear());
    bindControl("btn-delete-gear", "click", () => this.deleteSelectedGear());
    bindControl("btn-reset-scene", "click", () => this.resetScene());

    bindControl("btn-play", "click", () => this.play());
    bindControl("btn-pause", "click", () => this.pause());
    bindControl("btn-reset-animation", "click", () => this.resetAnimation());

    bindControl("input-rpm", "change", (e) => {
      this.inputRPM = parseFloat(e.target.value) || 30;
    });

    // Parameter inputs
    const paramInputs = [
      "param-teeth",
      "param-module",
      "param-pressure-angle",
      "param-thickness",
      "param-bore",
      "param-color",
    ];
    paramInputs.forEach((id) => {
      bindControl(id, "change", () => this.updateSelectedGearParams());
    });

    // Position inputs
    ["pos-x", "pos-y", "pos-z"].forEach((id) => {
      bindControl(id, "change", () => this.updateSelectedGearPosition());
    });

    // Display toggles
    bindControl("show-pitch-circle", "change", (e) => {
        this.showPitchCircle = e.target.checked;
        this.updateDisplayOptions();
      });
    bindControl("show-center", "change", (e) => {
      this.showCenter = e.target.checked;
      this.updateDisplayOptions();
    });
    bindControl("show-labels", "change", (e) => {
      this.showLabels = e.target.checked;
      this.updateDisplayOptions();
    });

    // Theme toggle
    bindControl("btn-theme-toggle", "click", () => this.toggleTheme());
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

    const gearMeshes = this.gears.map((g) => g.mesh);
    const intersects = this.raycaster.intersectObjects(gearMeshes);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const gear = this.gears.find((g) => g.mesh === clickedMesh);
      this.selectGear(gear);
    } else {
      this.selectGear(null);
    }
  }

  onMouseDown(event) {
    if (event.button !== 0) return;

    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const gearMeshes = this.gears.map((g) => g.mesh);
    const intersects = this.raycaster.intersectObjects(gearMeshes);

    if (intersects.length > 0) {
      this.orbitControls.enabled = false;
      this.isDragging = true;

      const clickedMesh = intersects[0].object;
      const gear = this.gears.find((g) => g.mesh === clickedMesh);
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
        this.selectedGear.mesh.position.z =
          this.dragStartZ + deltaY * zSensitivity;
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
      const gearMeshes = this.gears.map((g) => g.mesh);
      const intersects = this.raycaster.intersectObjects(gearMeshes);

      this.gears.forEach((g) => {
        // Don't override emissive if gear is in incompatible state
        if (g !== this.selectedGear && !g.incompatibleWith) {
          g.mesh.material.emissive.setHex(
            intersects.length > 0 && intersects[0].object === g.mesh
              ? 0x333333
              : 0x000000,
          );
        }
      });
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.orbitControls.enabled = true;
  }

  checkSnapToMesh(movingGear) {
    if (!movingGear || !movingGear.mesh || !movingGear.params) {
      return false;
    }

    const snapThreshold = 5;

    for (const gear of this.gears) {
      if (gear === movingGear) continue;
      if (!gear || !gear.mesh || !gear.params) continue;

      const idealDistance =
        (movingGear.params.pitchDiameter + gear.params.pitchDiameter) / 2;
      const currentDistance = movingGear.mesh.position.distanceTo(
        gear.mesh.position,
      );

      // Check for overlap first (gears too close together)
      if (this.checkGearsOverlap(movingGear, gear)) {
        this.setOverlapState(movingGear, gear);
        return false;
      }

      const diff = Math.abs(currentDistance - idealDistance);

      if (diff < snapThreshold && diff > 0.1) {
        // Check module compatibility before snapping
        if (!this.areGearsCompatible(movingGear, gear)) {
          // Incompatible gears - show visual feedback but don't snap
          this.setIncompatibleState(movingGear, gear);
          return false;
        }

        // Check if this connection would cause gear jamming (locked cycle)
        if (this.wouldCauseJamming(movingGear, gear)) {
          // Jamming - show visual feedback but don't snap
          this.setJammingState(movingGear, gear);
          return false;
        }

        // Clear any previous incompatible state
        if (movingGear.incompatibleWith) {
          this.clearIncompatibleState(movingGear);
        }

        // Snap to ideal meshing distance
        const direction = new THREE.Vector3()
          .subVectors(movingGear.mesh.position, gear.mesh.position)
          .normalize();

        movingGear.mesh.position.copy(
          gear.mesh.position
            .clone()
            .add(direction.multiplyScalar(idealDistance)),
        );

        // Connect gears
        if (!movingGear.connectedTo.includes(gear)) {
          this.connectGears(movingGear, gear);
        }

        // Play snap sound
        this.playSound("placeGear");

        return true; // Snapped!
      }
    }
    return false; // No snap
  }

  areGearsCompatible(gear1, gear2) {
    if (!gear1 || !gear2 || !gear1.params || !gear2.params) return false;
    return Math.abs(gear1.params.module - gear2.params.module) < 0.001;
  }

  wouldCauseJamming(gear1, gear2) {
    // Check if connecting gear1 to gear2 would create a cycle
    // that causes rotation direction conflict (gear jamming)
    //
    // A cycle with odd number of meshings causes jamming because
    // each meshing reverses rotation direction. Odd reversals = conflict.

    if (!gear1 || !gear2) return false;

    // If neither gear has connections, no cycle can be formed
    const gear1HasConnections = gear1.connectedTo && gear1.connectedTo.length > 0;
    const gear2HasConnections = gear2.connectedTo && gear2.connectedTo.length > 0;

    if (!gear1HasConnections && !gear2HasConnections) return false;

    // BFS to find if there's already a path between gear1 and gear2
    // If there is, connecting them would create a cycle
    const visited = new Set();
    const queue = [{ gear: gear1, depth: 0 }];
    visited.add(gear1);

    while (queue.length > 0) {
      const { gear, depth } = queue.shift();

      for (const connected of gear.connectedTo || []) {
        if (connected === gear2) {
          // Found a path from gear1 to gear2
          // Adding direct connection would create a cycle of length (depth + 2)
          // depth = edges traversed, +1 for this final edge to gear2, +1 for new direct edge
          const cycleLength = depth + 2;
          if (cycleLength % 2 === 1) {
            return true; // Odd cycle = jamming
          }
          // Even cycle is OK (like a square of 4 gears)
          return false;
        }

        if (!visited.has(connected)) {
          visited.add(connected);
          queue.push({ gear: connected, depth: depth + 1 });
        }
      }
    }

    return false; // No cycle would be created
  }

  setJammingState(movingGear, targetGear) {
    if (!movingGear || !movingGear.mesh || !movingGear.mesh.material) return;

    // Store original color if not already stored
    if (!movingGear.originalColor) {
      movingGear.originalColor = movingGear.mesh.material.color.getHex();
    }

    // Set jamming reference (reuse incompatibleWith field)
    movingGear.incompatibleWith = targetGear;
    movingGear.jammingError = true; // Flag to distinguish from module incompatibility

    // Change color to orange/yellow for jamming
    movingGear.mesh.material.color.setHex(0xff9800);
    movingGear.mesh.material.emissive.setHex(0x332200);

    // Show jamming message
    this.showJammingMessage(movingGear);

    // Update XR info panel immediately if in XR mode and this gear is selected
    if (this.isXRPresenting && movingGear === this.selectedGear) {
      this.updateInfoPanelContent();
    }
  }

  showJammingMessage(gear) {
    // Play jammed gear sound
    this.playSound("jammedGear");

    if (this.isXRPresenting) {
      this.showXRJammingMessage();
    } else {
      // Desktop message
      const msgElement = document.getElementById("incompatibility-message");
      if (msgElement) {
        const textElement = msgElement.querySelector(".message-text");
        if (textElement) {
          textElement.textContent = `Gear jamming! This position creates a locked gear train cycle.`;
        }
        // Change background to orange for jamming
        msgElement.style.background = "rgba(255, 152, 0, 0.95)";
        msgElement.style.display = "flex";
      }
    }

    this.debugLog(`JAMMING: Gear#${gear.id} creates locked cycle`);
  }

  checkGearsOverlap(gear1, gear2) {
    // Check if two gears are overlapping (too close together)
    // Overlap occurs when center distance is less than ideal meshing distance
    if (!gear1 || !gear2 || !gear1.mesh || !gear2.mesh) return false;
    if (!gear1.params || !gear2.params) return false;

    const idealDistance =
      (gear1.params.pitchDiameter + gear2.params.pitchDiameter) / 2;
    const currentDistance = gear1.mesh.position.distanceTo(gear2.mesh.position);

    // Overlap threshold: if closer than 90% of ideal distance, they're overlapping
    const overlapThreshold = idealDistance * 0.9;

    return currentDistance < overlapThreshold;
  }

  setOverlapState(movingGear, targetGear) {
    if (!movingGear || !movingGear.mesh || !movingGear.mesh.material) return;

    // Store original color if not already stored
    if (!movingGear.originalColor) {
      movingGear.originalColor = movingGear.mesh.material.color.getHex();
    }

    // Set overlap reference
    movingGear.incompatibleWith = targetGear;
    movingGear.overlapError = true; // Flag to distinguish from other errors

    // Change color to purple for overlap
    movingGear.mesh.material.color.setHex(0x9c27b0);
    movingGear.mesh.material.emissive.setHex(0x220033);

    // Show overlap message
    this.showOverlapMessage(movingGear, targetGear);

    // Update XR info panel immediately if in XR mode and this gear is selected
    if (this.isXRPresenting && movingGear === this.selectedGear) {
      this.updateInfoPanelContent();
    }
  }

  showOverlapMessage(gear, targetGear) {
    // Play overlapping gear sound
    this.playSound("overlappingGear");

    if (this.isXRPresenting) {
      this.showXROverlapMessage();
    } else {
      // Desktop message
      const msgElement = document.getElementById("incompatibility-message");
      if (msgElement) {
        const textElement = msgElement.querySelector(".message-text");
        if (textElement) {
          textElement.textContent = `Gears overlapping! Move gear further apart.`;
        }
        // Change background to purple for overlap
        msgElement.style.background = "rgba(156, 39, 176, 0.95)";
        msgElement.style.display = "flex";
      }
    }

    this.debugLog(`OVERLAP: Gear#${gear.id} overlaps with Gear#${targetGear.id}`);
  }

  showXRJammingMessage() {
    // Remove existing panel if any
    this.hideXRIncompatibilityMessage();

    const panel = new THREE.Group();
    panel.name = "incompatibilityPanel";
    // Stacking rules on, before anything is added to it.
    layerPanel(panel);

    // Panel background (orange)
    // Opaque on purpose — see js/xr/panelLayer.js.
    const background = makePanelGround(0.5, 0.12, 0xff9800);
    panel.add(background);

    // Warning text
    const text = "Gear Jamming! Locked cycle";
    const textCanvas = this.createTextCanvas(
      text,
      Math.round(0.5 * PX_PER_M),
      Math.round(0.12 * PX_PER_M),
      `bold ${TYPE.body}px ${FONT_STACK}`,
      INK.primary,
    );
    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
    });
    const textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.06),
      textMaterial,
    );
    textMesh.position.set(0, 0, 0.01);
    panel.add(textMesh);

    // Position in front of user
    panel.position.set(0, 1.5, -0.8);

    this.scene.add(panel);
    this.xrPanels.incompatibility = panel;
  }

  showXROverlapMessage() {
    // Remove existing panel if any
    this.hideXRIncompatibilityMessage();

    const panel = new THREE.Group();
    panel.name = "incompatibilityPanel";
    // Stacking rules on, before anything is added to it.
    layerPanel(panel);

    // Panel background (purple)
    // Opaque on purpose — see js/xr/panelLayer.js.
    const background = makePanelGround(0.5, 0.12, 0x9c27b0);
    panel.add(background);

    // Warning text
    const text = "Gears Overlapping!";
    const textCanvas = this.createTextCanvas(
      text,
      Math.round(0.5 * PX_PER_M),
      Math.round(0.12 * PX_PER_M),
      `bold ${TYPE.body}px ${FONT_STACK}`,
      INK.primary,
    );
    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
    });
    const textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.06),
      textMaterial,
    );
    textMesh.position.set(0, 0, 0.01);
    panel.add(textMesh);

    // Position in front of user
    panel.position.set(0, 1.5, -0.8);

    this.scene.add(panel);
    this.xrPanels.incompatibility = panel;
  }

  setIncompatibleState(movingGear, targetGear) {
    if (!movingGear || !movingGear.mesh || !movingGear.mesh.material) return;

    // Store original color if not already stored
    if (!movingGear.originalColor) {
      movingGear.originalColor = movingGear.mesh.material.color.getHex();
    }

    // Set incompatible reference
    movingGear.incompatibleWith = targetGear;

    // Change color to red
    movingGear.mesh.material.color.setHex(0xf44336);
    movingGear.mesh.material.emissive.setHex(0x330000);

    // Show incompatibility message
    this.showIncompatibilityMessage(movingGear, targetGear);

    // Update XR info panel immediately if in XR mode and this gear is selected
    if (this.isXRPresenting && movingGear === this.selectedGear) {
      this.updateInfoPanelContent();
    }
  }

  clearIncompatibleState(gear) {
    if (!gear || !gear.incompatibleWith) return;

    const wasSelected = gear === this.selectedGear;

    // Restore original color
    if (gear.originalColor && gear.mesh && gear.mesh.material) {
      gear.mesh.material.color.setHex(gear.originalColor);
      // Respect selection state for emissive
      if (wasSelected) {
        gear.mesh.material.emissive.setHex(0x00aa00);
      } else {
        gear.mesh.material.emissive.setHex(0x000000);
      }
    }

    // Clear incompatible/jamming/overlap references
    gear.incompatibleWith = null;
    gear.originalColor = null;
    gear.jammingError = false;
    gear.overlapError = false;

    // Hide incompatibility message
    this.hideIncompatibilityMessage();

    // Update XR info panel immediately if in XR mode and this gear was selected
    if (this.isXRPresenting && wasSelected) {
      this.updateInfoPanelContent();
    }
  }

  showIncompatibilityMessage(movingGear, targetGear) {
    const movingModule = movingGear.params.module;
    const targetModule = targetGear.params.module;

    // Play incompatible gear sound
    this.playSound("incompatibleGear");

    if (this.isXRPresenting) {
      this.showXRIncompatibilityMessage(movingModule, targetModule);
    } else {
      // Desktop message
      const msgElement = document.getElementById("incompatibility-message");
      if (msgElement) {
        const textElement = msgElement.querySelector(".message-text");
        if (textElement) {
          textElement.textContent = `Gears incompatible: Module ${movingModule} cannot mesh with Module ${targetModule}`;
        }
        msgElement.style.display = "flex";
      }
    }

    this.debugLog(`INCOMPATIBLE: M${movingModule} vs M${targetModule}`);
  }

  hideIncompatibilityMessage() {
    if (this.isXRPresenting) {
      this.hideXRIncompatibilityMessage();
    } else {
      const msgElement = document.getElementById("incompatibility-message");
      if (msgElement) {
        msgElement.style.display = "none";
        // Reset background color to default (red for module incompatibility)
        msgElement.style.background = "rgba(244, 67, 54, 0.95)";
      }
    }
  }

  showXRIncompatibilityMessage(movingModule, targetModule) {
    // Remove existing panel if any
    this.hideXRIncompatibilityMessage();

    const panel = new THREE.Group();
    panel.name = "incompatibilityPanel";
    // Stacking rules on, before anything is added to it.
    layerPanel(panel);

    // Panel background (red)
    // Opaque on purpose — see js/xr/panelLayer.js.
    const background = makePanelGround(0.5, 0.12, 0xf44336);
    panel.add(background);

    // Warning text
    const text = `Module ${movingModule} \u2260 Module ${targetModule}`;
    const textCanvas = this.createTextCanvas(
      text,
      Math.round(0.5 * PX_PER_M),
      Math.round(0.12 * PX_PER_M),
      `bold ${TYPE.body}px ${FONT_STACK}`,
      INK.primary,
    );
    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: textTexture,
      transparent: true,
    });
    const textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.06),
      textMaterial,
    );
    textMesh.position.set(0, 0, 0.01);
    panel.add(textMesh);

    // Position in front of user
    panel.position.set(0, 1.5, -0.8);

    this.scene.add(panel);
    this.xrPanels.incompatibility = panel;
  }

  hideXRIncompatibilityMessage() {
    if (this.xrPanels.incompatibility) {
      this.scene.remove(this.xrPanels.incompatibility);
      this.xrPanels.incompatibility = null;
    }
  }

  connectGears(gear1, gear2) {
    if (!gear1 || !gear2) return;

    if (!gear1.connectedTo) gear1.connectedTo = [];
    if (!gear2.connectedTo) gear2.connectedTo = [];

    if (!gear1.connectedTo.includes(gear2)) {
      gear1.connectedTo.push(gear2);
    }
    if (!gear2.connectedTo.includes(gear1)) {
      gear2.connectedTo.push(gear1);
    }

    // Only update gear info if not in XR (DOM update)
    if (!this.isXRPresenting) {
      this.updateGearInfo();
    }
  }

  updateConnections() {
    // Recalculate connections based on current positions
    const meshThreshold = 3;
    const incompatibleClearThreshold = 10; // Clear incompatible state when moved away

    // Clear ALL jamming and overlap errors first - they will be re-detected if still applicable
    // (Keep module incompatibility errors as they're position-independent)
    for (const gear of this.gears) {
      if (gear && gear.incompatibleWith && (gear.jammingError || gear.overlapError)) {
        this.clearIncompatibleState(gear);
      }
    }

    // Check if any gear in module-incompatible state has moved away from target
    for (const gear of this.gears) {
      if (gear && gear.incompatibleWith && !gear.jammingError && !gear.overlapError) {
        const targetGear = gear.incompatibleWith;
        if (!targetGear || !targetGear.mesh) {
          // Target gear no longer exists
          this.clearIncompatibleState(gear);
          continue;
        }

        const idealDistance =
          (gear.params.pitchDiameter + targetGear.params.pitchDiameter) / 2;
        const currentDistance = gear.mesh.position.distanceTo(
          targetGear.mesh.position,
        );
        const diff = Math.abs(currentDistance - idealDistance);

        // If moved away from meshing distance, clear incompatible state
        if (diff > incompatibleClearThreshold) {
          this.clearIncompatibleState(gear);
        }
      }
    }

    for (const gear of this.gears) {
      if (gear) gear.connectedTo = [];
    }

    // Collect all potential connections first
    const potentialConnections = [];
    for (let i = 0; i < this.gears.length; i++) {
      for (let j = i + 1; j < this.gears.length; j++) {
        const gear1 = this.gears[i];
        const gear2 = this.gears[j];

        // Safety checks
        if (!gear1 || !gear2) continue;
        if (!gear1.mesh || !gear2.mesh) continue;
        if (!gear1.params || !gear2.params) continue;

        const idealDistance =
          (gear1.params.pitchDiameter + gear2.params.pitchDiameter) / 2;
        const currentDistance = gear1.mesh.position.distanceTo(
          gear2.mesh.position,
        );

        if (Math.abs(currentDistance - idealDistance) < meshThreshold) {
          potentialConnections.push({ gear1, gear2, distance: currentDistance });
        }
      }
    }

    // Sort by distance (closest first) for consistent connection order
    potentialConnections.sort((a, b) => a.distance - b.distance);

    // Check for overlapping gears first
    let overlapGear = null;
    let overlapTarget = null;
    for (let i = 0; i < this.gears.length; i++) {
      for (let j = i + 1; j < this.gears.length; j++) {
        const gear1 = this.gears[i];
        const gear2 = this.gears[j];
        if (!gear1 || !gear2) continue;

        if (this.checkGearsOverlap(gear1, gear2)) {
          if (!overlapGear) {
            overlapGear = gear1;
            overlapTarget = gear2;
          }
        }
      }
    }

    // Try to make connections, checking for compatibility and jamming
    let jammingGear = null;
    let jammingTarget = null;

    for (const { gear1, gear2 } of potentialConnections) {
      // Skip if either gear is overlapping
      if (this.checkGearsOverlap(gear1, gear2)) {
        continue;
      }

      // Check module compatibility
      if (!this.areGearsCompatible(gear1, gear2)) {
        continue;
      }

      // Check if this connection would cause jamming
      if (this.wouldCauseJamming(gear1, gear2)) {
        // Record the jamming pair
        if (!jammingGear) {
          jammingGear = gear1;
          jammingTarget = gear2;
        }
        continue; // Don't make this connection
      }

      // Safe to connect
      this.connectGears(gear1, gear2);
    }

    // Show overlap error if detected (priority over jamming)
    if (overlapGear && overlapTarget) {
      let errorGear, otherGear;
      if (this.selectedGear === overlapGear) {
        errorGear = overlapGear;
        otherGear = overlapTarget;
      } else if (this.selectedGear === overlapTarget) {
        errorGear = overlapTarget;
        otherGear = overlapGear;
      } else {
        errorGear = overlapGear;
        otherGear = overlapTarget;
      }
      this.setOverlapState(errorGear, otherGear);
    }
    // If no overlap but jamming was detected, show jamming error
    else if (jammingGear && jammingTarget) {
      let errorGear, otherGear;
      if (this.selectedGear === jammingGear) {
        errorGear = jammingGear;
        otherGear = jammingTarget;
      } else if (this.selectedGear === jammingTarget) {
        errorGear = jammingTarget;
        otherGear = jammingGear;
      } else {
        errorGear = jammingGear;
        otherGear = jammingTarget;
      }
      this.setJammingState(errorGear, otherGear);
    }
  }

  selectGear(gear) {
    // Deselect previous
    if (this.selectedGear) {
      // Only reset emissive if not in incompatible state
      if (!this.selectedGear.incompatibleWith) {
        this.selectedGear.mesh.material.emissive.setHex(0x000000);
      }
      if (this.selectedGear.pitchCircle) {
        this.selectedGear.pitchCircle.material.color.setHex(0x00ff00);
      }
    }

    this.selectedGear = gear;

    if (gear) {
      // Only set selection emissive if not in incompatible state
      if (!gear.incompatibleWith) {
        gear.mesh.material.emissive.setHex(0x00aa00);
      }
      if (gear.pitchCircle) {
        gear.pitchCircle.material.color.setHex(0xffff00);
      }
      this.updateParamInputs(gear);
      this.updatePositionInputs();
    }

    this.updateGearInfo();
  }

  updateParamInputs(gear) {
    document.getElementById("param-teeth").value = gear.params.teeth;
    document.getElementById("param-module").value = gear.params.module;
    document.getElementById("param-pressure-angle").value =
      gear.params.pressureAngle;
    document.getElementById("param-thickness").value = gear.params.thickness;
    document.getElementById("param-bore").value = gear.params.boreDiameter;
    // Show original color if in incompatible state, otherwise show current color
    const colorHex = gear.originalColor
      ? gear.originalColor.toString(16).padStart(6, "0")
      : gear.mesh.material.color.getHexString();
    document.getElementById("param-color").value = "#" + colorHex;
  }

  updatePositionInputs() {
    if (!this.selectedGear) return;
    document.getElementById("pos-x").value = Math.round(
      this.selectedGear.mesh.position.x,
    );
    document.getElementById("pos-y").value = Math.round(
      this.selectedGear.mesh.position.y,
    );
    document.getElementById("pos-z").value = Math.round(
      this.selectedGear.mesh.position.z,
    );
  }

  updateSelectedGearParams() {
    if (!this.selectedGear) return;

    // Validate gear still exists in array
    if (!this.gears.includes(this.selectedGear)) {
      this.selectedGear = null;
      this.updateGearInfo();
      return;
    }

    const params = {
      teeth: parseInt(document.getElementById("param-teeth").value),
      module: parseFloat(document.getElementById("param-module").value),
      pressureAngle: parseFloat(
        document.getElementById("param-pressure-angle").value,
      ),
      thickness: parseFloat(document.getElementById("param-thickness").value),
      boreDiameter: parseFloat(document.getElementById("param-bore").value),
    };

    // Validate
    params.teeth = Math.max(8, Math.min(100, params.teeth));
    params.module = Math.max(0.5, Math.min(10, params.module));
    params.pressureAngle = Math.max(14.5, Math.min(25, params.pressureAngle));
    params.thickness = Math.max(1, Math.min(20, params.thickness));
    params.boreDiameter = Math.max(1, Math.min(20, params.boreDiameter));

    const color = document.getElementById("param-color").value;

    // Recreate gear geometry
    const position = this.selectedGear.mesh.position.clone();
    const rotation = this.selectedGear.mesh.rotation.z;

    this.worldGroup.remove(this.selectedGear.mesh);
    if (this.selectedGear.pitchCircle)
      this.worldGroup.remove(this.selectedGear.pitchCircle);
    if (this.selectedGear.centerMarker)
      this.worldGroup.remove(this.selectedGear.centerMarker);

    const gearGeom = new GearGeometry(params);
    const geometry = gearGeom.createGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.3,
      roughness: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position);
    mesh.rotation.z = rotation;

    this.worldGroup.add(mesh);

    // Store gear ID on new mesh
    mesh.userData.gearId = this.selectedGear.id;

    // Update gear object
    this.selectedGear.mesh = mesh;
    this.selectedGear.params = {
      teeth: params.teeth,
      module: params.module,
      pressureAngle: params.pressureAngle,
      thickness: params.thickness,
      boreDiameter: params.boreDiameter,
      pitchDiameter: gearGeom.pitchDiameter,
    };

    // Recreate display helpers
    this.createDisplayHelpers(this.selectedGear, gearGeom);
    this.updateDisplayOptions();
    this.updateConnections();
    this.updateGearInfo();
  }

  updateSelectedGearPosition() {
    if (!this.selectedGear) return;

    this.selectedGear.mesh.position.x =
      parseFloat(document.getElementById("pos-x").value) || 0;
    this.selectedGear.mesh.position.y =
      parseFloat(document.getElementById("pos-y").value) || 0;
    this.selectedGear.mesh.position.z =
      parseFloat(document.getElementById("pos-z").value) || 0;

    this.updateConnections();
  }

  addGear() {
    // Gated on the COUNT, not on the button: gears are added from the 3D panel,
    // from the DOM control, and once at start-up, and a gate on each is a gate
    // someone forgets.
    if (isLocked("gears.count") && this.gears.length >= TRIAL_LIMITS.maxGears) {
      reportLocked("gears.count");
      return;
    }

    const params = {
      teeth: parseInt(document.getElementById("param-teeth").value) || 20,
      module: parseFloat(document.getElementById("param-module").value) || 2,
      pressureAngle:
        parseFloat(document.getElementById("param-pressure-angle").value) || 20,
      thickness:
        parseFloat(document.getElementById("param-thickness").value) || 5,
      boreDiameter:
        parseFloat(document.getElementById("param-bore").value) || 5,
    };

    const color = document.getElementById("param-color").value;

    const gearGeom = new GearGeometry(params);
    const geometry = gearGeom.createGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: 0.3,
      roughness: 0.7,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position new gear offset from existing ones
    const offset = this.gears.length * 50;
    mesh.position.set(offset, 0, 0);

    this.worldGroup.add(mesh);

    const gear = {
      id: this.nextGearId++,
      mesh: mesh,
      params: {
        teeth: params.teeth,
        module: params.module,
        pressureAngle: params.pressureAngle,
        thickness: params.thickness,
        boreDiameter: params.boreDiameter,
        pitchDiameter: gearGeom.pitchDiameter,
      },
      rpm: 0,
      rotationDirection: 1,
      connectedTo: [],
      isDriver: this.gears.length === 0,
      pitchCircle: null,
      centerMarker: null,
      incompatibleWith: null,
      originalColor: null,
      jammingError: false,
      overlapError: false,
    };

    // Store gear ID on mesh for raycasting identification
    mesh.userData.gearId = gear.id;

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

    // Validate gear still exists
    if (!this.gears.includes(this.selectedGear)) {
      this.selectedGear = null;
      this.updateGearInfo();
      return;
    }

    const gearToDelete = this.selectedGear;

    // Clear incompatibility states referencing this gear
    for (const gear of this.gears) {
      if (gear.incompatibleWith === gearToDelete) {
        this.clearIncompatibleState(gear);
      }
    }

    // Clear own incompatibility state if any
    if (gearToDelete.incompatibleWith) {
      this.clearIncompatibleState(gearToDelete);
    }

    // Remove from connected gears
    for (const gear of this.gears) {
      gear.connectedTo = gear.connectedTo.filter((g) => g !== gearToDelete);
    }

    this.worldGroup.remove(gearToDelete.mesh);
    this.gears = this.gears.filter((g) => g !== gearToDelete);
    this.selectedGear = null;
    this.updateGearInfo();
  }

  resetScene() {
    // Hide any incompatibility message
    this.hideIncompatibilityMessage();

    for (const gear of this.gears) {
      this.worldGroup.remove(gear.mesh);
    }
    this.gears = [];
    this.selectedGear = null;
    this.isPlaying = false;
    this.updateGearInfo();
  }

  play() {
    // Check if any gear has jamming error
    const jammingGear = this.gears.find(g => g.jammingError);
    if (jammingGear) {
      this.showJammingMessage();
      if (this.xrSession) {
        this.showXRJammingMessage();
      }
      return;
    }

    this.isPlaying = true;
    this.calculateGearSpeeds();
    this.playSound("playGear");
  }

  pause() {
    this.isPlaying = false;
    this.stopSound("playGear");
  }

  resetAnimation() {
    this.isPlaying = false;
    this.stopSound("playGear");
    for (const gear of this.gears) {
      gear.mesh.rotation.z = 0;
    }
  }

  calculateGearSpeeds() {
    // Find driver gear (first gear or marked as driver)
    const driver = this.gears.find((g) => g.isDriver) || this.gears[0];
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
    document.body.classList.toggle("light-mode", !this.isDarkMode);

    if (this.isDarkMode) {
      this.scene.background.setHex(0x1a1a2e);
    } else {
      this.scene.background.setHex(0xf5f5f5);
    }
  }

  updateGearInfo() {
    const content = document.getElementById("gear-info-content");

    // Update XR info panel if in XR mode
    if (this.isXRPresenting && this.xrPanels.right) {
      this.updateInfoPanelContent();
    }

    // Skip HTML update if element doesn't exist
    if (!content) return;

    if (!this.selectedGear) {
      content.innerHTML =
        '<p class="placeholder">Select a gear to view info</p>';
      return;
    }

    const gear = this.selectedGear;
    const directionClass = gear.rotationDirection >= 0 ? "cw" : "ccw";
    const directionText = gear.rotationDirection >= 0 ? "CW" : "CCW";

    let ratioText = "-";
    if (gear.connectedTo.length > 0) {
      const ratios = gear.connectedTo
        .map((g) => `${gear.params.teeth}:${g.params.teeth}`)
        .join(", ");
      ratioText = ratios;
    }

    content.innerHTML = `
            <div class="info-header" style="font-weight: bold; font-size: 1.1em; margin-bottom: 8px; color: var(--primary-color);">Gear #${gear.id}</div>
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
    try {
      const deltaTime = 1 / 60; // Assuming 60 FPS

      if (this.isPlaying) {
        this.updatePhysics(deltaTime);
      }

      // XR-specific updates
      if (this.isXRPresenting) {
        try {
          this.updateXRInteraction();
        } catch (xrErr) {
          console.error("XR interaction error:", xrErr);
          this.debugLog(`XR ERR: ${xrErr.message}`);
        }
        this.updateXRUI();
      } else {
        this.orbitControls.update();
      }

      this.renderer.render(this.scene, this.camera);
    } catch (renderErr) {
      console.error("Render loop error:", renderErr);
    }
  }

  updatePhysics(deltaTime) {
    for (const gear of this.gears) {
      // Convert RPM to radians per second
      const radiansPerSecond = (gear.rpm * 2 * Math.PI) / 60;
      gear.mesh.rotation.z +=
        radiansPerSecond * gear.rotationDirection * deltaTime;
    }
  }
}
