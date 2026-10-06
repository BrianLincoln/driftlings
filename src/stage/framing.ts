import * as THREE from 'three';

// The framing rule, decided before any scene exists:
//
// A scene declares a STAGE BOX, a rectangle facing the camera that must always
// be fully visible. The camera backs off until the box fits by whichever of
// width or height is tighter. Everything a child must see or touch lives inside
// the box; scenery bleeds past it so no aspect ratio ever shows a void.
//
// A scene may give a different box (and move its actors) for TALL and WIDE
// viewports. That is the whole responsive system: two arrangements, one rule.

export type LayoutMode = 'tall' | 'wide';

export interface Framing {
  /** Centre of the stage box in world space. */
  center: THREE.Vector3;
  width: number;
  height: number;
  /** Camera elevation above the horizon, degrees. */
  elevation: number;
  /** Camera swing around the vertical axis, degrees. */
  azimuth?: number;
  /** Vertical field of view, degrees. Default 30; tall layouts use more so the horizon stays in frame. */
  fov?: number;
}

/** Fraction of the viewport kept clear on each side for UI and notches. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function layoutModeFor(aspect: number): LayoutMode {
  return aspect < 0.95 ? 'tall' : 'wide';
}

/** Distance at which a box of the given size exactly fits the usable viewport. */
export function fitDistance(f: Framing, vfovDeg: number, aspect: number, insets: Insets = NO_INSETS): number {
  const t = Math.tan(THREE.MathUtils.degToRad(vfovDeg) / 2);
  const usableH = Math.max(0.1, 1 - insets.top - insets.bottom);
  const usableW = Math.max(0.1, 1 - insets.left - insets.right);
  const byHeight = f.height / 2 / (t * usableH);
  const byWidth = f.width / 2 / (t * aspect * usableW);
  return Math.max(byHeight, byWidth);
}

const dir = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();

export function applyFraming(cam: THREE.PerspectiveCamera, f: Framing, aspect: number, insets: Insets = NO_INSETS): void {
  const el = THREE.MathUtils.degToRad(f.elevation);
  const az = THREE.MathUtils.degToRad(f.azimuth ?? 0);
  dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  cam.fov = f.fov ?? 30;
  const d = fitDistance(f, cam.fov, aspect, insets);
  cam.aspect = aspect;
  cam.position.copy(f.center).addScaledVector(dir, d);
  cam.lookAt(f.center);
  // Shift so the box sits in the middle of the usable area, not of the screen.
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * d;
  cam.updateMatrixWorld();
  right.setFromMatrixColumn(cam.matrixWorld, 0);
  up.setFromMatrixColumn(cam.matrixWorld, 1);
  cam.position.addScaledVector(right, (insets.right - insets.left) * t * aspect);
  cam.position.addScaledVector(up, (insets.top - insets.bottom) * t);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}
