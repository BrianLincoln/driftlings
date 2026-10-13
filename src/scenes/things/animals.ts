import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, place } from '../../gfx/geo';
import { merge } from '../../gfx/geo';
import { CREAM, PINK, RED, ball, curlTail, eyes, leg, part, pointEar, swing, wrapTail, type Drawing } from './parts';

// Animals: toys of them, not creatures. Head toward +z, body swung under it, the whole turned three-quarters on.

/** A kitten sitting up with its tail round its feet. */
export function cat(): Drawing {
  const head: [number, number, number] = [0, 0.47, 0.04];
  return {
    geo: merge(
      swing(merge(
        part(1, lathe([[0, 0], [0.16, 0.01], [0.2, 0.1], [0.17, 0.24], [0.1, 0.34], [0, 0.37]], C.amber)),
        part(2, ...[-1, 1].flatMap((k) => [
          place(capsule(0.036, 0.16, C.amber), [k * 0.085, 0.14, 0.15], [-0.12, 0, 0]),
          place(ellipsoid(0.046, 0.038, 0.062, CREAM, 14), [k * 0.085, 0.035, 0.18]),
        ])),
        part(3, wrapTail(0.21, 0.04, 1.7, C.amber, C.amber)),
      ), -0.35),
      part(4,
        place(ellipsoid(0.22, 0.185, 0.19, C.amber, 40), head),
        place(ellipsoid(0.058, 0.04, 0.04, CREAM, 18), [0, 0.39, 0.2]),
        place(ellipsoid(0.022, 0.016, 0.014, PINK, 10), [0, 0.412, 0.237]),
      ),
      part(5, ...[-1, 1].map((k) => place(pointEar(0.09, 0.17, C.amber, C.blush), [k * 0.135, 0.58, 0.03], [0, 0, -k * 0.32]))),
    ),
    face: eyes(head, [0.42, 0.12], 1, [-0.44, 0.07]),
    turn: [0, -0.4],
    scale: 0.85,
  };
}

/** A puppy on its four feet, side on, looking round at us. */
export function dog(): Drawing {
  const head: [number, number, number] = [0, 0.4, 0.02];
  return {
    geo: merge(
      swing(merge(
        part(1,
          place(ellipsoid(0.15, 0.15, 0.23, C.basket), [0, 0.23, -0.2]),
          place(ellipsoid(0.04, 0.085, 0.04, C.basket, 14), [0, 0.37, -0.4], [-0.6, 0, 0]),
        ),
        part(2, ...[-1, 1].flatMap((k) => [-0.06, -0.33].map((z) => place(leg(0.058, 0.16, C.basket), [k * 0.085, 0, z])))),
      ), 0.75),
      part(4, place(ellipsoid(0.165, 0.15, 0.155, C.basket, 40), head)),
      part(5, ...[-1, 1].map((k) => place(ellipsoid(0.045, 0.125, 0.075, C.trunk, 16), [k * 0.165, 0.38, 0], [0, 0, k * 0.16]))),
      part(6,
        place(ellipsoid(0.078, 0.06, 0.085, C.cutWood, 20), [0, 0.345, 0.135]),
        place(ellipsoid(0.027, 0.02, 0.018, C.faceInk, 12), [0, 0.375, 0.213]),
      ),
    ),
    face: eyes(head, [0.48, 0.24], 1, [-0.38, 0.1]),
    turn: [0, 0.3],
  };
}

/** A pig, side on, looking round at us: a flat snout, ears that tip forward, a curl of a tail. */
export function pig(): Drawing {
  const head: [number, number, number] = [0, 0.34, 0];
  return {
    geo: merge(
      swing(merge(
        part(1, place(ellipsoid(0.2, 0.19, 0.27, C.blush), [0, 0.27, -0.23])),
        part(2, ...[-1, 1].flatMap((k) => [-0.08, -0.38].map((z) => place(leg(0.06, 0.15, C.blush), [k * 0.1, 0, z])))),
        part(3, place(curlTail(0.045, 0.02, PINK), [0, 0.36, -0.51])),
      ), -0.75),
      part(4, place(ellipsoid(0.19, 0.17, 0.17, C.blush, 40), head)),
      part(5, ...[-1, 1].map((k) => place(pointEar(0.075, 0.13, PINK, PINK), [k * 0.14, 0.43, -0.02], [0.7, 0, -k * 0.5]))),
      part(6,
        place(ellipsoid(0.085, 0.068, 0.05, PINK, 20), [0, 0.3, 0.15]),
        ...[-1, 1].map((k) => place(ellipsoid(0.015, 0.022, 0.012, C.ink, 10), [k * 0.03, 0.3, 0.192])),
      ),
    ),
    face: eyes(head, [0.5, 0.28], 0.9),
    turn: [0, -0.3],
  };
}

/** A ladybird's shell, as half-widths, and where its spots are, as directions out from its middle. */
const SHELL = [0.25, 0.19, 0.27] as const;
// Well in from the rim: a spot on the edge runs into the outline.
const SPOTS = [[0.62, 0.62, 0.12], [-0.62, 0.62, 0.12], [0.38, 0.85, -0.3], [-0.38, 0.85, -0.3]].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
/** A round black spot lying flat on the shell, out along `d`. */
function spot(d: THREE.Vector3, r: number): THREE.BufferGeometry {
  const [a, b, c] = SHELL;
  const out = new THREE.Vector3(d.x / a, d.y / b, d.z / c).normalize();
  return ellipsoid(r, r * 0.22, r, C.faceInk, 24).applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(d.x * a, 0.06 + d.y * b, d.z * c),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out),
    new THREE.Vector3(1, 1, 1),
  ));
}

/** A ladybird: a red dome with spots, a dark head, two feelers. */
export function bug(): Drawing {
  const head: [number, number, number] = [0, 0.13, 0.26];
  return {
    geo: merge(
      part(0, ...[-1, 1].flatMap((k) => [-0.14, 0.01, 0.15].map((z) => place(ellipsoid(0.045, 0.03, 0.035, C.ink, 12), [k * 0.235, 0.025, z])))),
      part(1,
        place(ellipsoid(...SHELL, RED, 36), [0, 0.06, 0]),
        place(ellipsoid(0.012, SHELL[1] + 0.005, SHELL[2] + 0.005, C.faceInk, 20), [0, 0.06, 0]),
        ...SPOTS.map((d) => spot(d, 0.065)),
      ),
      part(2, place(ellipsoid(0.115, 0.1, 0.09, C.ink, 30), head)),
      part(3, ...[-1, 1].flatMap((k) => [
        place(capsule(0.012, 0.09, C.ink), [k * 0.06, 0.26, 0.28], [0.2, 0, -k * 0.4]),
        place(ball(0.026, C.ink, 12), [k * 0.082, 0.315, 0.292]),
      ])),
    ),
    face: eyes(head, [0.47, 0.3], 1.85),
    turn: [0.14, -0.2],
  };
}
