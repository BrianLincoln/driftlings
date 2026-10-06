import * as THREE from 'three';

const local = new THREE.Vector3();
const inv = new THREE.Matrix4();

/** Where the painted pupils should sit (-1..1 each way) for a head to look at a world point. */
export function gazeAt(head: THREE.Object3D, target: THREE.Vector3, out: { x: number; y: number }): void {
  inv.copy(head.matrixWorld).invert();
  local.copy(target).applyMatrix4(inv).normalize();
  const yaw = Math.atan2(local.x, local.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(local.y, -1, 1));
  out.x = THREE.MathUtils.clamp(yaw / 0.8, -1, 1);
  out.y = THREE.MathUtils.clamp(pitch / 0.6, -1, 1);
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}
