import * as THREE from 'three';

/**
 * Generates spur gear geometry with involute tooth profile
 */
export class GearGeometry {
    /**
     * @param {Object} params - Gear parameters
     * @param {number} params.teeth - Number of teeth (8-100)
     * @param {number} params.module - Module in mm (0.5-10)
     * @param {number} params.pressureAngle - Pressure angle in degrees (14.5-25)
     * @param {number} params.thickness - Gear thickness in mm
     * @param {number} params.boreDiameter - Center hole diameter in mm
     */
    constructor(params) {
        this.teeth = params.teeth || 20;
        this.module = params.module || 2;
        this.pressureAngle = (params.pressureAngle || 20) * Math.PI / 180;
        this.thickness = params.thickness || 5;
        this.boreDiameter = params.boreDiameter || 5;

        // Calculated dimensions
        this.pitchDiameter = this.teeth * this.module;
        this.pitchRadius = this.pitchDiameter / 2;
        this.baseRadius = this.pitchRadius * Math.cos(this.pressureAngle);
        this.addendum = this.module;
        this.dedendum = 1.25 * this.module;
        this.outerRadius = this.pitchRadius + this.addendum;
        this.rootRadius = this.pitchRadius - this.dedendum;
        this.boreRadius = this.boreDiameter / 2;

        // Ensure bore doesn't exceed root
        if (this.boreRadius >= this.rootRadius) {
            this.boreRadius = this.rootRadius * 0.5;
        }
    }

    /**
     * Generate involute curve point at given parameter t
     */
    involutePoint(baseRadius, t) {
        const x = baseRadius * (Math.cos(t) + t * Math.sin(t));
        const y = baseRadius * (Math.sin(t) - t * Math.cos(t));
        return new THREE.Vector2(x, y);
    }

    /**
     * Generate a single tooth profile
     */
    generateToothProfile(toothIndex) {
        const points = [];
        const toothAngle = (2 * Math.PI) / this.teeth;
        const baseAngle = toothIndex * toothAngle;

        // Involute parameter range
        const tMax = Math.sqrt((this.outerRadius / this.baseRadius) ** 2 - 1);
        const tPitch = Math.sqrt((this.pitchRadius / this.baseRadius) ** 2 - 1);

        // Tooth thickness at pitch circle (approximately half of circular pitch)
        const circularPitch = Math.PI * this.module;
        const toothThicknessAngle = circularPitch / (2 * this.pitchRadius);

        // Generate right side of tooth (involute curve)
        const involuteSteps = 12;
        const rightPoints = [];
        for (let i = 0; i <= involuteSteps; i++) {
            const t = (i / involuteSteps) * tMax;
            const point = this.involutePoint(this.baseRadius, t);

            // Rotate to align with tooth center
            const involuteAngle = Math.atan2(point.y, point.x);
            const pitchInvoluteAngle = Math.atan2(
                this.involutePoint(this.baseRadius, tPitch).y,
                this.involutePoint(this.baseRadius, tPitch).x
            );
            const offsetAngle = baseAngle + toothThicknessAngle / 2 - pitchInvoluteAngle;

            const r = point.length();
            const angle = involuteAngle + offsetAngle;

            if (r >= this.rootRadius && r <= this.outerRadius) {
                rightPoints.push(new THREE.Vector2(
                    r * Math.cos(angle),
                    r * Math.sin(angle)
                ));
            }
        }

        // Generate left side of tooth (mirrored involute)
        const leftPoints = [];
        for (let i = involuteSteps; i >= 0; i--) {
            const t = (i / involuteSteps) * tMax;
            const point = this.involutePoint(this.baseRadius, t);

            const involuteAngle = Math.atan2(point.y, point.x);
            const pitchInvoluteAngle = Math.atan2(
                this.involutePoint(this.baseRadius, tPitch).y,
                this.involutePoint(this.baseRadius, tPitch).x
            );
            const offsetAngle = baseAngle - toothThicknessAngle / 2 + pitchInvoluteAngle;

            const r = point.length();
            const angle = -involuteAngle + offsetAngle;

            if (r >= this.rootRadius && r <= this.outerRadius) {
                leftPoints.push(new THREE.Vector2(
                    r * Math.cos(angle),
                    r * Math.sin(angle)
                ));
            }
        }

        // Combine: root arc start -> left involute -> tip arc -> right involute -> root arc end
        return { leftPoints, rightPoints };
    }

    /**
     * Create the gear shape
     */
    createGearShape() {
        const shape = new THREE.Shape();
        const toothAngle = (2 * Math.PI) / this.teeth;

        // Start at root circle
        shape.moveTo(this.rootRadius, 0);

        for (let i = 0; i < this.teeth; i++) {
            const tooth = this.generateToothProfile(i);
            const nextToothStartAngle = (i + 1) * toothAngle - toothAngle / 2;

            // Left side of tooth
            tooth.leftPoints.forEach(p => shape.lineTo(p.x, p.y));

            // Tip arc
            if (tooth.leftPoints.length > 0 && tooth.rightPoints.length > 0) {
                const lastLeft = tooth.leftPoints[tooth.leftPoints.length - 1];
                const firstRight = tooth.rightPoints[0];
                const tipAngleStart = Math.atan2(lastLeft.y, lastLeft.x);
                const tipAngleEnd = Math.atan2(firstRight.y, firstRight.x);

                // Small arc at tooth tip
                const tipSteps = 3;
                for (let j = 1; j <= tipSteps; j++) {
                    const t = j / tipSteps;
                    const angle = tipAngleStart + (tipAngleEnd - tipAngleStart) * t;
                    shape.lineTo(
                        this.outerRadius * Math.cos(angle),
                        this.outerRadius * Math.sin(angle)
                    );
                }
            }

            // Right side of tooth
            tooth.rightPoints.forEach(p => shape.lineTo(p.x, p.y));

            // Root arc to next tooth
            const currentAngle = Math.atan2(
                tooth.rightPoints[tooth.rightPoints.length - 1]?.y || 0,
                tooth.rightPoints[tooth.rightPoints.length - 1]?.x || this.rootRadius
            );

            const rootSteps = 4;
            for (let j = 1; j <= rootSteps; j++) {
                const t = j / rootSteps;
                const angle = currentAngle + (nextToothStartAngle - currentAngle) * t;
                shape.lineTo(
                    this.rootRadius * Math.cos(angle),
                    this.rootRadius * Math.sin(angle)
                );
            }
        }

        shape.closePath();

        // Add bore hole
        const holePath = new THREE.Path();
        const holeSteps = 32;
        holePath.moveTo(this.boreRadius, 0);
        for (let i = 1; i <= holeSteps; i++) {
            const angle = (i / holeSteps) * Math.PI * 2;
            holePath.lineTo(
                this.boreRadius * Math.cos(angle),
                this.boreRadius * Math.sin(angle)
            );
        }
        shape.holes.push(holePath);

        return shape;
    }

    /**
     * Create simplified gear shape (for performance with many gears)
     */
    createSimplifiedGearShape() {
        const shape = new THREE.Shape();
        const toothAngle = (2 * Math.PI) / this.teeth;

        shape.moveTo(this.rootRadius, 0);

        for (let i = 0; i < this.teeth; i++) {
            const baseAngle = i * toothAngle;

            // Simplified trapezoidal tooth
            const toothWidth = toothAngle * 0.4;

            // Root to left base of tooth
            shape.lineTo(
                this.rootRadius * Math.cos(baseAngle + toothAngle * 0.1),
                this.rootRadius * Math.sin(baseAngle + toothAngle * 0.1)
            );

            // Left side of tooth
            shape.lineTo(
                this.outerRadius * Math.cos(baseAngle + toothAngle * 0.25),
                this.outerRadius * Math.sin(baseAngle + toothAngle * 0.25)
            );

            // Tooth tip
            shape.lineTo(
                this.outerRadius * Math.cos(baseAngle + toothAngle * 0.5),
                this.outerRadius * Math.sin(baseAngle + toothAngle * 0.5)
            );

            // Right side of tooth
            shape.lineTo(
                this.rootRadius * Math.cos(baseAngle + toothAngle * 0.75),
                this.rootRadius * Math.sin(baseAngle + toothAngle * 0.75)
            );

            // Root between teeth
            shape.lineTo(
                this.rootRadius * Math.cos(baseAngle + toothAngle),
                this.rootRadius * Math.sin(baseAngle + toothAngle)
            );
        }

        shape.closePath();

        // Add bore hole
        const holePath = new THREE.Path();
        const holeSteps = 24;
        holePath.moveTo(this.boreRadius, 0);
        for (let i = 1; i <= holeSteps; i++) {
            const angle = (i / holeSteps) * Math.PI * 2;
            holePath.lineTo(
                this.boreRadius * Math.cos(angle),
                this.boreRadius * Math.sin(angle)
            );
        }
        shape.holes.push(holePath);

        return shape;
    }

    /**
     * Create ExtrudeGeometry for the gear
     */
    createGeometry(simplified = false) {
        const shape = simplified ? this.createSimplifiedGearShape() : this.createSimplifiedGearShape();

        const extrudeSettings = {
            depth: this.thickness,
            bevelEnabled: true,
            bevelThickness: 0.5,
            bevelSize: 0.3,
            bevelSegments: 2
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    /**
     * Create pitch circle geometry for visualization
     */
    createPitchCircleGeometry() {
        const points = [];
        const segments = 64;

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                this.pitchRadius * Math.cos(angle),
                this.pitchRadius * Math.sin(angle),
                this.thickness + 0.1
            ));
        }

        return new THREE.BufferGeometry().setFromPoints(points);
    }
}
