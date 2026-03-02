// =============================================================================
// test-camera.js - Tests for src/engine/camera.js
// =============================================================================

import { describe, it, assert } from './test-runner.js';
import { Camera } from '../src/engine/camera.js';

// =============================================================================
// Camera - constructor
// =============================================================================

describe('Camera - constructor', () => {
    it('sets position from arguments', () => {
        const cam = new Camera(5.5, 10.5, 1, 0);
        assert.equal(cam.pos.x, 5.5);
        assert.equal(cam.pos.y, 10.5);
    });

    it('sets direction from arguments', () => {
        const cam = new Camera(0, 0, 1, 0);
        assert.equal(cam.dir.x, 1);
        assert.equal(cam.dir.y, 0);
    });

    it('computes plane perpendicular to direction (default FOV)', () => {
        // dir = (1, 0), plane should be (0, 0.66) for default fov = 0.66
        const cam = new Camera(0, 0, 1, 0);
        assert.closeTo(cam.plane.x, 0, 1e-9);
        assert.closeTo(cam.plane.y, 0.66, 1e-9);
    });

    it('computes correct plane for facing south (dir = (0, 1))', () => {
        // dir = (0, 1), plane should be (-1 * 0.66, 0 * 0.66) = (-0.66, 0)
        const cam = new Camera(0, 0, 0, 1);
        assert.closeTo(cam.plane.x, -0.66, 1e-9);
        assert.closeTo(cam.plane.y, 0, 1e-9);
    });

    it('accepts a custom FOV factor', () => {
        const cam = new Camera(0, 0, 1, 0, 1.0);
        assert.closeTo(cam.plane.x, 0, 1e-9);
        assert.closeTo(cam.plane.y, 1.0, 1e-9);
    });

    it('defaults FOV to 0.66', () => {
        const cam = new Camera(0, 0, 0, -1);
        // dir = (0, -1), plane = (-(-1)*0.66, 0*0.66) = (0.66, 0)
        assert.closeTo(cam.plane.x, 0.66, 1e-9);
        assert.closeTo(cam.plane.y, 0, 1e-9);
    });
});

// =============================================================================
// Camera - rotate
// =============================================================================

describe('Camera - rotate', () => {
    it('rotates direction by 90 degrees', () => {
        const cam = new Camera(0, 0, 1, 0);
        cam.rotate(Math.PI / 2);
        // dir (1,0) rotated 90 degrees CCW -> (0, 1)
        assert.closeTo(cam.dir.x, 0, 1e-6);
        assert.closeTo(cam.dir.y, 1, 1e-6);
    });

    it('rotates plane by the same angle', () => {
        const cam = new Camera(0, 0, 1, 0);
        // Initial plane: (0, 0.66)
        cam.rotate(Math.PI / 2);
        // plane (0, 0.66) rotated 90 degrees CCW -> (-0.66, 0)
        assert.closeTo(cam.plane.x, -0.66, 1e-6);
        assert.closeTo(cam.plane.y, 0, 1e-6);
    });

    it('keeps direction and plane perpendicular after rotation', () => {
        const cam = new Camera(0, 0, 1, 0);
        cam.rotate(0.7); // arbitrary angle

        // dot product should be ~0 if perpendicular
        const dot = cam.dir.x * cam.plane.x + cam.dir.y * cam.plane.y;
        assert.closeTo(dot, 0, 1e-9);
    });

    it('180 degree rotation reverses direction', () => {
        const cam = new Camera(0, 0, 1, 0);
        cam.rotate(Math.PI);
        assert.closeTo(cam.dir.x, -1, 1e-6);
        assert.closeTo(cam.dir.y, 0, 1e-6);
    });

    it('full 360 degree rotation returns to original direction', () => {
        const cam = new Camera(0, 0, 1, 0);
        const origDirX = cam.dir.x;
        const origDirY = cam.dir.y;
        cam.rotate(Math.PI * 2);
        assert.closeTo(cam.dir.x, origDirX, 1e-6);
        assert.closeTo(cam.dir.y, origDirY, 1e-6);
    });

    it('does not change position', () => {
        const cam = new Camera(5, 10, 1, 0);
        cam.rotate(Math.PI / 4);
        assert.equal(cam.pos.x, 5);
        assert.equal(cam.pos.y, 10);
    });
});

// =============================================================================
// Camera - position updates
// =============================================================================

describe('Camera - position updates', () => {
    it('position can be updated directly', () => {
        const cam = new Camera(0, 0, 1, 0);
        cam.pos.x = 10.5;
        cam.pos.y = 20.5;
        assert.equal(cam.pos.x, 10.5);
        assert.equal(cam.pos.y, 20.5);
    });
});

// =============================================================================
// Camera - getRayDir
// =============================================================================

describe('Camera - getRayDir', () => {
    it('center column ray matches the camera direction', () => {
        const cam = new Camera(0, 0, 1, 0);
        const screenWidth = 320;
        // Center column: screenX = screenWidth / 2 -> cameraX = 0
        const ray = cam.getRayDir(screenWidth / 2, screenWidth);
        // Ray dir should be dir + plane * 0 = dir
        assert.closeTo(ray.x, 1, 1e-6);
        assert.closeTo(ray.y, 0, 1e-6);
    });

    it('left edge ray has negative plane contribution', () => {
        const cam = new Camera(0, 0, 1, 0);
        const screenWidth = 320;
        // Left edge: screenX = 0 -> cameraX = -1
        const ray = cam.getRayDir(0, screenWidth);
        // Ray dir = (1, 0) + (0, 0.66) * (-1) = (1, -0.66)
        assert.closeTo(ray.x, 1, 1e-6);
        assert.closeTo(ray.y, -0.66, 0.01);
    });

    it('right edge ray has positive plane contribution', () => {
        const cam = new Camera(0, 0, 1, 0);
        const screenWidth = 320;
        // Right edge: screenX = 319 -> cameraX near +1
        const ray = cam.getRayDir(319, screenWidth);
        assert.closeTo(ray.x, 1, 1e-6);
        assert.ok(ray.y > 0.6, 'right edge ray should have positive Y plane component');
    });

    it('returns an object with x and y', () => {
        const cam = new Camera(0, 0, 1, 0);
        const ray = cam.getRayDir(0, 100);
        assert.ok(typeof ray.x === 'number');
        assert.ok(typeof ray.y === 'number');
    });
});

// =============================================================================
// Camera - direction preservation under small rotations
// =============================================================================

describe('Camera - direction length preservation', () => {
    it('direction vector stays unit-length after multiple rotations', () => {
        const cam = new Camera(0, 0, 1, 0);
        // Apply many small rotations
        for (let i = 0; i < 100; i++) {
            cam.rotate(0.05);
        }
        const len = Math.sqrt(cam.dir.x * cam.dir.x + cam.dir.y * cam.dir.y);
        assert.closeTo(len, 1.0, 1e-6);
    });

    it('plane vector maintains its magnitude after multiple rotations', () => {
        const cam = new Camera(0, 0, 1, 0, 0.66);
        const origPlaneLen = Math.sqrt(cam.plane.x * cam.plane.x + cam.plane.y * cam.plane.y);
        for (let i = 0; i < 100; i++) {
            cam.rotate(0.05);
        }
        const planeLen = Math.sqrt(cam.plane.x * cam.plane.x + cam.plane.y * cam.plane.y);
        assert.closeTo(planeLen, origPlaneLen, 1e-6);
    });
});
