import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FaceLook } from '../../gfx/face';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';

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
  /** Its size beside the others, if the recipe came out too big or too small. */
  scale?: number;
}

/** A tail curling up and over: most of a ring, with a round end. It stands in the plane across x. */
export function curlTail(radius: number, thick: number, colour: string): THREE.BufferGeometry {
  const arc = 4.6;
  return place(merge(
    paint(new THREE.TorusGeometry(radius, thick, 10, 24, arc), colour),
    place(ball(thick * 1.15, colour, 10), [radius * Math.cos(arc), radius * Math.sin(arc), 0]),
  ), [0, 0, 0], [0, Math.PI / 2, 0]);
}

export const [RED, BLUE, GREEN, PURPLE, PINK] = C.cards;
export const CREAM = C.flower;

/**
 * Number a piece of a drawing. Ink is drawn where two parts with different numbers meet, on the side of the
 * higher number, and nowhere else inside a thing: pieces that share a number run into each other with no
 * line (a pale muzzle on a head, spots on a shell), and a dark piece given the higher number swallows
 * its own line. Every piece of a drawing needs a number, from 0 to 15.
 */
export function part(n: number, ...pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = pieces.length === 1 ? pieces[0] : merge(...pieces);
  g.setAttribute('part', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(n), 1));
  return g;
}

/**
 * An animal's eyes: the creatures' own (white, pupil, glint, an ink ring), painted on by the shader they
 * use (gfx/face.ts) and nothing else of a face with them. `at` is where one eye sits from the middle of
 * the head, `origin`, as yaw and pitch in radians; the other mirrors it. `mouth` is a small smile that far
 * down the face: without one an animal looks blank. The eyes turn to the camera by themselves (index.ts).
 */
export function eyes(origin: [number, number, number], at: [yaw: number, pitch: number], size = 1, mouth: [pitch: number, halfWidth: number] | null = null): FaceLook {
  const nowhere = -9;
  return {
    origin,
    eye: [at[0], at[1], 0.215 * size, 0.28 * size],
    // A bigger pupil than a creature's: a toy's eye, with less white to stare with.
    pupil: [0.155 * size, 0.2 * size, 0.06 * size, 0.06 * size],
    mouth: mouth ?? [nowhere, 0.1],
    blush: [0, nowhere, 0.01],
  };
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

/** A fat wheel standing on the ground with its axle along z: a dark tyre, a pale hub showing on both sides. */
export function wheel(r: number, w: number, tyre: string = C.trunk, hub: string = C.rock): THREE.BufferGeometry {
  const h = w / 2;
  const e = Math.min(0.02, h * 0.6);
  return place(merge(
    place(lathe([[0, -h], [r - e, -h], [r, e - h], [r, h - e], [r - e, h], [0, h]], tyre, 28, 24), [0, 0, 0], [Math.PI / 2, 0, 0]),
    ellipsoid(r * 0.48, r * 0.48, h + 0.012, hub, 16),
  ), [0, r, 0]);
}

/** A round-ended stick from one point to another: a leg, an antenna, a feeler. */
export function limb(a: [number, number, number], b: [number, number, number], r: number, colour: string): THREE.BufferGeometry {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const dir = to.clone().sub(from);
  const len = dir.length();
  const g = capsule(r, Math.max(0.001, len - 2 * r), colour);
  return g.applyMatrix4(new THREE.Matrix4().compose(
    from.clone().add(to).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    new THREE.Vector3(1, 1, 1),
  ));
}

/** A round rope or rod through a smooth curve: a runner, a pull rope. Its ends are capped with balls. */
export function tube(points: Array<[number, number, number]>, r: number, colour: string, steps = 48): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return merge(
    paint(new THREE.TubeGeometry(curve, steps, r, 10, false), colour),
    place(ball(r, colour, 10), points[0]),
    place(ball(r, colour, 10), points[points.length - 1]),
  );
}

/** Set a drawing built at any height down on the ground: its lowest point at y = 0. */
export function ground(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox();
  return g.translate(0, -g.boundingBox!.min.y, 0);
}
