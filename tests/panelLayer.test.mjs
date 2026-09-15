import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { makePanelGround, isPanelGround, layerPanel } from '../js/xr/panelLayer.js';

// A panel is a stack of coplanar quads and three.js sorts transparent objects
// by each object's ORIGIN, which stops matching the stack as soon as the panel
// is turned away from the viewer. These panels are toed in 28 degrees, so the
// rules below are what stops a label punching a hole through its own card.

const quad = (z) => {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.1),
        new THREE.MeshBasicMaterial({ transparent: true }),
    );
    mesh.position.z = z;
    return mesh;
};

test('the ground is opaque, so it leaves the sorted pass entirely', () => {
    const ground = makePanelGround(0.65, 1.3, 0x0f3460);
    assert.equal(ground.material.transparent, false,
        'a transparent ground takes part in the argument it exists to settle');
    assert.equal(ground.material.opacity, 1);
});

test('the ground is exempt from the stacking rules', () => {
    const panel = new THREE.Group();
    const ground = makePanelGround(0.65, 1.3, 0x0f3460);
    panel.add(ground);
    layerPanel(panel);

    assert.ok(isPanelGround(ground));
    assert.notEqual(ground.material.depthWrite, false,
        'the ground must keep writing depth — that is what shields the panel');
});

test('every stacked mesh stops writing depth', () => {
    const panel = new THREE.Group();
    panel.add(makePanelGround(0.65, 1.3, 0x0f3460));
    const label = quad(0.011);
    panel.add(label);
    layerPanel(panel);

    assert.equal(label.material.depthWrite, false);
});

test('render order comes from the mesh own height in the stack', () => {
    const panel = new THREE.Group();
    layerPanel(panel);
    const low = quad(0.001);
    const high = quad(0.011);
    panel.add(low, high);

    assert.equal(low.renderOrder, 1, '0.001 is one layer up');
    assert.equal(high.renderOrder, 11, '0.011 is eleven');
    assert.ok(high.renderOrder > low.renderOrder, 'higher in the stack draws later');
});

test('z accumulates through nested groups, as a button label does', () => {
    // A button sits at z=0.01 on the panel and its label at z=0.011 inside the
    // button, so the label is at 0.021 overall. Reading only the local z would
    // sort it as though it were below the button it belongs to.
    const panel = new THREE.Group();
    layerPanel(panel);

    const button = new THREE.Group();
    button.position.z = 0.01;
    const label = quad(0.011);
    button.add(label);
    panel.add(button);

    assert.equal(label.renderOrder, 21);
});

test('a mesh added AFTER the rules are installed is covered too', () => {
    // The reason add() is wrapped rather than the children walked once: value
    // readouts and result cards are built long after construction.
    const panel = new THREE.Group();
    layerPanel(panel);

    const late = quad(0.006);
    panel.add(late);

    assert.equal(late.material.depthWrite, false);
    assert.equal(late.renderOrder, 6);
});

test('a CLONED ground does not inherit the exemption', () => {
    // Object3D.clone() deep-copies userData, so tracking grounds with a
    // userData flag would let a clone keep the exemption and go back to
    // punching holes. That is why the registry is a module-private WeakSet.
    const ground = makePanelGround(0.65, 1.3, 0x0f3460);
    const copy = ground.clone();

    assert.ok(isPanelGround(ground));
    assert.equal(isPanelGround(copy), false,
        'a clone must be treated as an ordinary layer, not as a ground');
});
