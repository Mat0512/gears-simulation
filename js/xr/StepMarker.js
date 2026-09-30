import * as THREE from "three";
import { COLOR } from "./theme.js";

const RING_RADIUS = 0.05;
const RING_TUBE = 0.007;
const ARROW_H = 0.045;
const ARROW_R = 0.02;
const PULSE_MS = 900;

/**
 * StepMarker — a ring with an arrow, sitting on whatever the current HOW TO USE
 * step asks the learner to do.
 *
 * The card says "Press Add Gear on the controls panel"; this says WHICH of the
 * buttons in front of you that is. It draws over everything (`depthTest: false`)
 * on purpose — a cue you cannot find is no cue — and only one is ever shown, so
 * nothing competes with it. It goes the moment the step is done.
 *
 * Ported from molecule-module, in gears' own green.
 */
export class StepMarker {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = 30;

    this._material = new THREE.MeshBasicMaterial({
      color: COLOR.success,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false,
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 8, 32),
      this._material,
    );
    ring.renderOrder = 30;
    this.group.add(ring);

    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(ARROW_R, ARROW_H, 12),
      this._material,
    );
    arrow.rotation.x = Math.PI; // tip down, into the ring
    arrow.position.y = RING_RADIUS + ARROW_H * 0.9;
    arrow.renderOrder = 30;
    this.group.add(arrow);

    scene.add(this.group);
  }

  /** Put it on this world point and show it. */
  showAt(worldPos) {
    this.group.position.copy(worldPos);
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  /** Face the viewer and breathe, so it reads as a cue rather than scenery. */
  update(camera, now = performance.now()) {
    if (!this.group.visible || !camera) return;
    this.group.lookAt(camera.getWorldPosition(new THREE.Vector3()));
    const t = (Math.sin((now / PULSE_MS) * Math.PI * 2) + 1) / 2;
    this.group.scale.setScalar(1 + t * 0.25);
    this._material.opacity = 0.55 + t * 0.35;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
    this._material.dispose();
  }
}
