import * as THREE from 'three';

/**
 * Panel layering — why a label punches a hole through the card it sits on.
 *
 * A panel is a stack of COPLANAR quads, and three.js orders transparent objects
 * by the projected depth of each object's ORIGIN. Head-on that order matches the
 * stack. Off-axis it stops matching: a label near the edge of a tilted panel
 * sorts BEHIND the background it belongs to — and because a transparent material
 * still writes depth by default, the background then punches a rectangle clean
 * through the label.
 *
 * It reads as a transparency bug. It is a depth bug, and it gets worse the more
 * a panel is turned away from the viewer. These panels are toed in 28 degrees.
 *
 * Two rules, applied in one place, exactly as the physics and periodic-table
 * modules do (see PANEL_LAYERING_FIX.md at the workspace root):
 *
 *   1. THE GROUND IS OPAQUE. An opaque mesh leaves the transparent pass
 *      entirely, and the opaque pass runs first — so its depth then shields the
 *      panel from anything behind it, including another panel's layers.
 *   2. EVERY MESH STACKED ON IT gets depthWrite: false and a renderOrder taken
 *      from its own height in the stack. Stacking is therefore authored in
 *      MILLIMETRES OF Z — 0.001 is one layer up, 0.011 is eleven — and comes
 *      back as draw order, with nothing to set at the call site.
 *
 * Grounds are tracked in a module-private WeakSet, never a userData flag:
 * Object3D.clone() deep-copies userData, so a cloned ground would inherit the
 * exemption and go straight back to punching holes.
 */

const LAYER_SCALE = 1000;
const grounds = new WeakSet();

/** The panel's own backing quad. Opaque, and exempt from the rules above. */
export function makePanelGround(width, height, color) {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        // NOT transparent. This is the whole first rule: a transparent ground
        // stays in the sorted pass and takes part in the argument it is meant
        // to settle. It was `transparent: true, opacity: 0.9`.
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    grounds.add(mesh);
    return mesh;
}

export function isPanelGround(mesh) {
    return grounds.has(mesh);
}

function applyRules(object, baseZ) {
    const z = baseZ + (object.position?.z ?? 0);

    if (object.isMesh && !isPanelGround(object)) {
        const materials = Array.isArray(object.material)
            ? object.material : [object.material];
        for (const material of materials) {
            if (material) material.depthWrite = false;
        }
        // Its own height in the stack, in millimetres, as draw order.
        object.renderOrder = Math.round(z * LAYER_SCALE);
    }

    for (const child of object.children ?? []) applyRules(child, z);
}

/**
 * Install the rules on a panel, and keep them installed.
 *
 * `add` is WRAPPED rather than the children walked once, so a mesh built long
 * after construction — a value readout swapped in, a quiz panel's result card —
 * is covered too. That is the part a one-off pass gets wrong.
 */
export function layerPanel(panel) {
    for (const child of panel.children) applyRules(child, panel.position.z * 0);

    const originalAdd = panel.add.bind(panel);
    panel.add = (...objects) => {
        const result = originalAdd(...objects);
        for (const object of objects) applyRules(object, 0);
        return result;
    };
    return panel;
}
