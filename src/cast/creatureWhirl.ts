import * as THREE from 'three';
import type { Spring } from './spring';

// The whirlwind a creature can be sent on: leap to a spot, spin there like a top, leap back.

/** Seconds for each part of the whirlwind, and how many times round it goes. */
export const WHIRL = { down: 0.26, spin: 1.5, back: 0.3, turns: 8 };

export interface Whirling {
  t: number;
  home: THREE.Vector3;
  to: THREE.Vector3;
  puffAt: number;
  kick(): void;
}

/** Advance a whirlwind by `dt`, moving and turning `root`. True once it is back where it started. */
export function stepWhirl(w: Whirling, dt: number, root: THREE.Group, yaw: number, sq: Spring): boolean {
  const p = root.position;
  w.t += dt;
  const leap = (from: THREE.Vector3, to: THREE.Vector3, k: number) => {
    p.lerpVectors(from, to, k);
    p.y += Math.sin(k * Math.PI) * 0.5 * root.scale.x;
  };
  const spinning = w.t - WHIRL.down;
  if (spinning < 0) leap(w.home, w.to, w.t / WHIRL.down);
  else if (spinning < WHIRL.spin) {
    p.copy(w.to);
    root.rotation.y = yaw + (spinning / WHIRL.spin) * Math.PI * 2 * WHIRL.turns;
    if (w.t >= w.puffAt) {
      if (w.puffAt === WHIRL.down) sq.kick(-4); // landing
      w.puffAt += 0.1;
      w.kick();
    }
  } else {
    const k = Math.min(1, (spinning - WHIRL.spin) / WHIRL.back);
    root.rotation.y = yaw;
    leap(w.to, w.home, k);
    if (k >= 1) {
      sq.kick(-3);
      return true;
    }
  }
  return false;
}
