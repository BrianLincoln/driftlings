import * as THREE from 'three';
import type { Creature } from '../cast/creature';
import type { Blob, Standing } from './homeRing';

// Something to do on the home island, and somewhere to do it: a game of catch,
// a seesaw, a tree to nap under. A pastime knows its own props, where each of
// those taking part should be, and what they do while they are there. It knows
// nothing of who comes or when, or how they get there: residents.ts does.

export type Ground = (x: number, z: number) => number;

/** One of those taking part. */
export interface Guest {
  readonly c: Creature;
  /** About where its eyes are, for someone else to look at. */
  readonly eye: THREE.Vector3;
}

export interface Pastime {
  /** The middle of it. */
  readonly at: THREE.Vector3;
  /** How many can take part at once. */
  readonly room: number;
  /** How long anyone stays, shortest and longest, in seconds. */
  readonly stay: [number, number];
  /** How much ground it takes up: nothing is planted and nobody idles this close to the middle. */
  readonly reach: number;
  readonly root: THREE.Group;
  readonly shadows: Blob[];
  /** Anything of its own tall enough to hide what is behind it, and its full size. */
  readonly tall?: Standing;
  /** Where whoever takes place `i` goes to join in. */
  spot(i: number): THREE.Vector3;
  /** How much higher than the island the ground is for whoever has place `i`: something to stand on. */
  rise?(i: number): Ground | null;
  /** Someone has got to their place. */
  begin(g: Guest, i: number): void;
  /** Someone is off to do something else. */
  end(g: Guest, i: number): void;
  /** Every frame, with whoever is in each place by now, and null for an empty one. */
  update(dt: number, here: ReadonlyArray<Guest | null>): void;
}

/** Where one is, and which of them it is. The camera at home always looks the same way, so +x is to the right and +z is nearer to us. */
export interface Site {
  x: number;
  z: number;
  n: number;
  y: Ground;
}

/** The start of any pastime: its middle, and a way to place things around it as the camera will see them. */
export function lay(s: Site) {
  /** `u` to the right of the middle and `v` nearer to us. */
  const local = (u: number, v: number) => new THREE.Vector3(s.x + u, s.y(s.x + u, s.z + v), s.z + v);
  return {
    at: local(0, 0),
    local,
    root: new THREE.Group(),
    shadows: [] as Blob[],
    /** The way to face to be looking at us, and to be looking out to sea from here. */
    inward: 0,
    seaward: Math.atan2(s.x, s.z),
  };
}

export const yawTo = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(to.x - from.x, to.z - from.z);

/** Something to stand on: `height` at `mid`, falling away to nothing `radius` from it. */
export function mound(mid: THREE.Vector3, radius: number, height: () => number): Ground {
  return (x, z) => {
    const d = Math.hypot(x - mid.x, z - mid.z) / radius;
    return d >= 1 ? 0 : height() * (1 - d * d);
  };
}
