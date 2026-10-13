import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FaceLook } from '../../gfx/face';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, merge, paint, place } from '../../gfx/geo';

// What the drawings of things are put together from. docs/things.md has the rules.

/**
 * One thing as drawn: a single merged mesh standing on its own origin. An animal is built with its
 * head looking down +z, because that is the way a painted face looks; `turn` then swings the whole
 * of it round (tilt toward the camera, then yaw) so that it stands three-quarters on.
 */
export interface Drawing {
  geo: THREE.BufferGeometry;
  face?: FaceLook;
  turn?: [tilt: number, yaw: number];
}

export const [RED, BLUE, GREEN, PURPLE, PINK] = C.cards;
export const CREAM = C.flower;

export type Eyes = 'rig' | 'dots' | 'none';

/**
 * An animal's eyes, painted on by the face shader the creatures use (gfx/face.ts) so that the
 * outline pass cannot ring them. `at` is where one eye sits from the middle of the head, as yaw
 * and pitch in radians.
 */
export function eyes(kind: Eyes, origin: [number, number, number], at: [number, number], size = 1): FaceLook | undefined {
  const [yaw, pitch] = at;
  const nowhere = -9;
  if (kind === 'rig') {
    return {
      origin,
      eye: [yaw, pitch, 0.215 * size, 0.28 * size],
      pupil: [0.13 * size, 0.17 * size, 0.07, 0.07],
      mouth: [nowhere, 0.1],
      blush: [yaw + 0.28, nowhere, 0.13],
    };
  }
  if (kind === 'dots') {
    // An eye that is all pupil: the pupil is so much bigger than the eye that its glint falls outside.
    return { origin, eye: [yaw, pitch, 0.085 * size, 0.1 * size], pupil: [1, 1, 0, 0], mouth: [nowhere, 0.1], blush: [0, nowhere, 0.01] };
  }
  return undefined;
}

export const ball = (r: number, colour: string, seg = 16) => ellipsoid(r, r, r, colour, seg);
export const box = (w: number, h: number, d: number, colour: string, r = 0.03) => paint(new RoundedBoxGeometry(w, h, d, 3, r), colour);
/** Swing parts round the upright through the origin: how a body is turned under a head. */
export const swing = (g: THREE.BufferGeometry, yaw: number) => place(g, [0, 0, 0], [0, yaw, 0]);

/** A pointed ear standing on its base, `inner` on the side that faces forward. */
export function pointEar(r: number, h: number, colour: string, inner: string): THREE.BufferGeometry {
  return place(paint(new THREE.ConeGeometry(r, h, 20), (_p, n) => (n.z > 0.55 ? inner : colour)), [0, h / 2, 0]);
}

/** A short thick leg standing on the ground, `h` to its top. */
export function leg(r: number, h: number, colour: string): THREE.BufferGeometry {
  return place(capsule(r, Math.max(0.001, h - 2 * r), colour), [0, h / 2, 0]);
}

/** A tail lying on the ground round a seated animal: from behind it, round its right, by `arc` radians. */
export function wrapTail(radius: number, thick: number, arc: number, colour: string, tip: string): THREE.BufferGeometry {
  const end = -Math.PI / 2 + arc;
  return merge(
    place(paint(new THREE.TorusGeometry(radius, thick, 12, 28, arc), colour), [0, thick, 0], [Math.PI / 2, 0, -Math.PI / 2]),
    place(ball(thick * 1.25, tip), [radius * Math.cos(end), thick, radius * Math.sin(end)]),
  );
}
