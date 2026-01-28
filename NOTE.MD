Think carefully and provide a concrete implementation. Do not write code yet save it first in an .md

I want to add Oculus (Meta Quest) native hand tracking to a WebXR + Three.js application, where hand movement replaces the mouse cursor to interact with and move a gear object in the scene.

Important constraints:

This must use Oculus / Meta Quest hand tracking via WebXR, not webcam-based hand tracking.

The interaction happens inside a WebXR environment (VR mode).

Do NOT implement pinch gesture detection or custom gesture logic.

Use the default hand tracking behavior (joint poses / hand input source) provided by WebXR.

Hand position should be used to directly control or drag the gear, similar to how a mouse cursor would.

Project setup (Vite-based):

index.html – Entry point, loads main.js as an ES module

main.js – Core Three.js application with WebXR + VR + hand tracking setup

vite.config.js – Vite configuration with SSL enabled (required for WebXR)

public/ – Static assets

What to produce:

A working Three.js + WebXR hand tracking setup compatible with Meta Quest

Hand tracking initialization using XRHand / XRInputSource

Logic that maps hand or joint position to moving a gear mesh

Code snippets for:

index.html

main.js

vite.config.js

Clear explanations for how the hand replaces the mouse cursor in 
