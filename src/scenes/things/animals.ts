import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { CREAM, PINK, RED, ball, eyes, leg, pointEar, swing, wrapTail, type Drawing, type Eyes } from './parts';

// Animals: toys of them, not creatures. Head toward +z, body swung under it, the whole turned three-quarters on.

/** A kitten sitting up with its tail round its feet. */
export function cat(look: Eyes): Drawing {
  const head: [number, number, number] = [0, 0.47, 0.04];
  return {
    geo: merge(
      swing(merge(
        lathe([[0, 0], [0.16, 0.01], [0.2, 0.1], [0.17, 0.24], [0.1, 0.34], [0, 0.37]], C.amber),
        place(ellipsoid(0.12, 0.13, 0.06, CREAM, 18), [0, 0.15, 0.13]),
        ...[-1, 1].map((k) => place(ellipsoid(0.05, 0.04, 0.065, CREAM, 14), [k * 0.07, 0.035, 0.18])),
        wrapTail(0.21, 0.04, 1.9, C.amber, CREAM),
      ), -0.35),
      place(ellipsoid(0.22, 0.185, 0.19, C.amber, 40), head),
      ...[-1, 1].map((k) => place(pointEar(0.09, 0.17, C.amber, PINK), [k * 0.135, 0.58, 0.03], [0, 0, -k * 0.32])),
      place(ellipsoid(0.065, 0.042, 0.04, CREAM, 16), [0, 0.405, 0.2]),
      place(ellipsoid(0.022, 0.016, 0.014, PINK, 10), [0, 0.428, 0.236]),
    ),
    face: eyes(look, head, look === 'rig' ? [0.4, 0.2] : [0.5, 0.06], look === 'rig' ? 1 : 1.15),
    turn: [0, -0.4],
  };
}

/** A puppy on its four feet, side on, looking round at us. */
export function dog(look: Eyes): Drawing {
  const head: [number, number, number] = [0, 0.4, 0.02];
  return {
    geo: merge(
      swing(merge(
        place(ellipsoid(0.15, 0.15, 0.23, C.basket), [0, 0.23, -0.2]),
        ...[-1, 1].flatMap((k) => [-0.06, -0.33].map((z) => place(leg(0.058, 0.16, C.basket), [k * 0.085, 0, z]))),
        place(capsule(0.035, 0.1, C.basket), [0, 0.38, -0.42], [-0.7, 0, 0]),
        place(paint(new THREE.TorusGeometry(0.105, 0.024, 10, 24), RED), [0, 0.29, -0.05], [0.9, 0, 0]),
      ), 0.75),
      place(ellipsoid(0.165, 0.15, 0.155, C.basket, 40), head),
      place(ellipsoid(0.075, 0.058, 0.085, C.cutWood, 18), [0, 0.345, 0.135]),
      place(ellipsoid(0.03, 0.022, 0.02, C.faceInk, 10), [0, 0.37, 0.215]),
      ...[-1, 1].map((k) => place(ellipsoid(0.045, 0.125, 0.075, C.trunk, 16), [k * 0.165, 0.38, 0], [0, 0, k * 0.16])),
    ),
    face: eyes(look, head, look === 'rig' ? [0.42, 0.28] : [0.52, 0.16]),
    turn: [0, 0.3],
  };
}

/** A ladybird's shell, as half-widths, and where its spots are, as directions out from its middle. */
const SHELL = [0.25, 0.19, 0.27] as const;
const SPOTS = [[0.55, 0.6, 0.35], [-0.55, 0.6, 0.35], [0.5, 0.7, -0.4], [-0.5, 0.7, -0.4], [0.8, 0.4, -0.05], [-0.8, 0.4, -0.05]].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
/** A round black spot lying flat on the shell, out along `d`. */
function spot(d: THREE.Vector3, r: number): THREE.BufferGeometry {
  const [a, b, c] = SHELL;
  const out = new THREE.Vector3(d.x / a, d.y / b, d.z / c).normalize();
  return ellipsoid(r, r * 0.2, r, C.faceInk, 14).applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(d.x * a, 0.06 + d.y * b, d.z * c),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out),
    new THREE.Vector3(1, 1, 1),
  ));
}

/** A ladybird: a red dome with spots, a dark head, two feelers. */
export function bug(look: Eyes): Drawing {
  const head: [number, number, number] = [0, 0.12, 0.25];
  return {
    geo: merge(
      place(ellipsoid(...SHELL, RED, 36), [0, 0.06, 0]),
      place(ellipsoid(0.012, SHELL[1] + 0.005, SHELL[2] + 0.005, C.faceInk, 20), [0, 0.06, 0]),
      ...SPOTS.map((d) => spot(d, 0.055)),
      place(ellipsoid(0.13, 0.11, 0.1, C.ink, 30), head),
      // Dark dots need a pale face to sit on.
      ...(look === 'dots' ? [place(ellipsoid(0.1, 0.075, 0.04, CREAM, 20), [0, 0.11, 0.315])] : []),
      ...[-1, 1].flatMap((k) => [
        place(capsule(0.011, 0.09, C.ink), [k * 0.06, 0.25, 0.27], [0.2, 0, -k * 0.4]),
        place(ball(0.024, C.ink, 10), [k * 0.082, 0.305, 0.282]),
        ...[-0.13, 0.02, 0.15].map((z) => place(ellipsoid(0.04, 0.03, 0.03, C.ink, 10), [k * 0.23, 0.03, z])),
      ]),
    ),
    face: eyes(look, head, look === 'rig' ? [0.42, 0.18] : [0.36, 0.0], look === 'rig' ? 1.25 : 1.2),
    turn: [0.1, -0.3],
  };
}
