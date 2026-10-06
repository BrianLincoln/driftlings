import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyFraming, fitDistance, layoutModeFor, type Framing } from './framing';

const box: Framing = { center: new THREE.Vector3(0, 1, 0), width: 4, height: 3, elevation: 20 };

function cornersNdc(f: Framing, cam: THREE.PerspectiveCamera): THREE.Vector3[] {
  const r = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const u = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) =>
    f.center.clone().addScaledVector(r, (sx * f.width) / 2).addScaledVector(u, (sy * f.height) / 2).project(cam),
  );
}

describe('framing', () => {
  it('picks tall below roughly square and wide above', () => {
    expect(layoutModeFor(390 / 844)).toBe('tall');
    expect(layoutModeFor(1600 / 900)).toBe('wide');
  });

  it.each([390 / 844, 3 / 4, 1, 4 / 3, 16 / 9, 21 / 9, 9 / 21])('keeps the whole box on screen at aspect %f', (aspect) => {
    const cam = new THREE.PerspectiveCamera(30, aspect, 0.5, 200);
    applyFraming(cam, box, aspect);
    const pts = cornersNdc(box, cam);
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.0001);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.0001);
    }
    // ...and it is tight: the box touches the edge in one dimension.
    const reach = Math.max(...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))));
    expect(reach).toBeGreaterThan(0.999);
  });

  it('keeps the box inside the inset area', () => {
    const aspect = 390 / 844;
    const cam = new THREE.PerspectiveCamera(30, aspect, 0.5, 200);
    const insets = { top: 0.12, right: 0, bottom: 0.05, left: 0 };
    applyFraming(cam, box, aspect, insets);
    for (const p of cornersNdc(box, cam)) {
      expect(p.y).toBeLessThanOrEqual(1 - 2 * insets.top + 1e-4);
      expect(p.y).toBeGreaterThanOrEqual(-1 + 2 * insets.bottom - 1e-4);
    }
  });

  it('backs off further for a narrow viewport', () => {
    expect(fitDistance(box, 30, 0.46)).toBeGreaterThan(fitDistance(box, 30, 1.78));
  });
});
