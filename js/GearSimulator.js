import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
        requestAnimationFrame(() => this.animate());

        const deltaTime = 1 / 60; // Assuming 60 FPS

        if (this.isPlaying) {
            this.updatePhysics(deltaTime);
        }

        this.orbitControls.update();
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
