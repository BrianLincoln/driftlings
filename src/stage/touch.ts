import * as THREE from 'three';

// One interaction vocabulary: tap (and later, simple drags). Scenes register
// touchables as world-space spheres; a tap goes to the nearest one on screen.
// Targets are forgiving: never smaller than MIN_RADIUS_PX however far away.

export interface Touchable {
  id: string;
  object: THREE.Object3D;
  /** Offset from the object's origin to the centre of the target. */
  offset?: THREE.Vector3;
  radius: number;
  enabled?: () => boolean;
  onTap: () => void;
}

export const MIN_RADIUS_PX = 34;

const c = new THREE.Vector3();
const edge = new THREE.Vector3();
const up = new THREE.Vector3();

export interface ScreenTarget {
  id: string;
  x: number;
  y: number;
  r: number;
}

export function projectTargets(list: Touchable[], cam: THREE.PerspectiveCamera, w: number, h: number): ScreenTarget[] {
  up.setFromMatrixColumn(cam.matrixWorld, 1);
  const out: ScreenTarget[] = [];
  for (const t of list) {
    if (t.enabled && !t.enabled()) continue;
    t.object.getWorldPosition(c);
    if (t.offset) c.add(t.offset);
    edge.copy(c).addScaledVector(up, t.radius).project(cam);
    c.project(cam);
    out.push({
      id: t.id,
      x: (c.x * 0.5 + 0.5) * w,
      y: (-c.y * 0.5 + 0.5) * h,
      r: Math.max(MIN_RADIUS_PX, Math.abs(edge.y - c.y) * 0.5 * h),
    });
  }
  return out;
}

export function pick(targets: ScreenTarget[], x: number, y: number): string | null {
  let best: string | null = null;
  let bestScore = 1.15; // a little slop outside the radius still counts
  for (const t of targets) {
    const score = Math.hypot(x - t.x, y - t.y) / t.r;
    if (score < bestScore) {
      bestScore = score;
      best = t.id;
    }
  }
  return best;
}
