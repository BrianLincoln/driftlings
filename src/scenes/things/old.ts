import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';

// The drawings not yet redone.


const [RED, BLUE, GREEN, , PINK] = C.cards;
/** A flat green triangle, standing on its base and facing forward: a hill as a map draws one. */
function hill(w: number, h: number): THREE.BufferGeometry {
  const shape = new THREE.Shape().moveTo(-w / 2, 0).lineTo(w / 2, 0).lineTo(0, h).closePath();
  return paint(new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false }), GREEN);
}
const box = (w: number, h: number, d: number, colour: string, r = 0.03) => paint(new RoundedBoxGeometry(w, h, d, 3, r), colour);

export const OLD: Record<string, () => THREE.BufferGeometry> = {
  // A mug: straight sides, a rounded lip, a handle, something dark in it.
  cup: () => merge(
    place(paint(new THREE.CylinderGeometry(0.19, 0.175, 0.4, 36), BLUE), [0, 0.2, 0]),
    place(paint(new THREE.TorusGeometry(0.178, 0.016, 8, 36), BLUE), [0, 0.4, 0], [Math.PI / 2, 0, 0]),
    place(ellipsoid(0.165, 0.012, 0.165, C.trunk, 20), [0, 0.4, 0]),
    place(paint(new THREE.TorusGeometry(0.11, 0.032, 10, 20, Math.PI), BLUE), [0.18, 0.2, 0], [0, 0, -Math.PI / 2]),
  ),
  // A cooking pot with its lid on and a handle each side.
  pot: () => merge(
    lathe([[0.001, 0], [0.26, 0.01], [0.3, 0.18], [0.29, 0.34]], RED),
    place(ellipsoid(0.3, 0.09, 0.3, RED, 20), [0, 0.35, 0]),
    place(ellipsoid(0.06, 0.05, 0.06, C.ink, 12), [0, 0.46, 0]),
    place(capsule(0.035, 0.1, C.ink), [0.33, 0.26, 0], [Math.PI / 2, 0, 0]),
    place(capsule(0.035, 0.1, C.ink), [-0.33, 0.26, 0], [Math.PI / 2, 0, 0]),
  ),
  // A bed seen from the side: headboard, pillow, blanket.
  bed: () => merge(
    place(box(0.86, 0.12, 0.46, C.trunk), [0, 0.14, 0]),
    place(box(0.8, 0.12, 0.42, C.flower, 0.05), [0, 0.25, 0]),
    place(box(0.5, 0.14, 0.45, GREEN, 0.05), [0.16, 0.26, 0]),
    place(ellipsoid(0.12, 0.06, 0.16, C.flower, 14), [-0.26, 0.34, 0]),
    place(box(0.08, 0.5, 0.48, C.trunk), [-0.43, 0.25, 0]),
    place(box(0.08, 0.3, 0.48, C.trunk), [0.43, 0.15, 0]),
  ),
  // A bat for hitting a ball, leaning, with the ball beside it.
  bat: () => merge(
    place(
      lathe([[0.001, 0], [0.04, 0.005], [0.028, 0.03], [0.028, 0.25], [0.05, 0.46], [0.062, 0.68], [0.05, 0.75], [0.001, 0.76]], (p) => (p.y < 0.22 ? C.trunk : C.cutWood)),
      [0.12, 0, 0], [0, 0, 0.5],
    ),
    place(ellipsoid(0.08, 0.08, 0.08, C.flower, 14), [0.16, 0.08, 0.1]),
  ),
  // A map held up to be read: hills, a dotted way across, a cross where the treasure is.
  map: () => place(
    merge(
      box(0.62, 0.46, 0.02, C.parchment, 0.008),
      place(capsule(0.03, 0.44, C.parchmentEdge), [-0.31, 0, 0]),
      place(capsule(0.03, 0.44, C.parchmentEdge), [0.31, 0, 0]),
      ...[[-0.2, 0.03, 1], [-0.1, 0.03, 0.7]].map(([x, y, k]) => place(hill(0.15 * k, 0.13 * k), [x, y, 0.01])),
      ...[[-0.21, -0.13], [-0.12, -0.08], [-0.03, -0.07], [0.05, -0.02], [0.1, 0.05]].map(([x, y]) => place(ellipsoid(0.02, 0.02, 0.006, C.ink, 10), [x, y, 0.012])),
      place(box(0.15, 0.036, 0.008, RED, 0.003), [0.18, 0.11, 0.014], [0, 0, 0.785]),
      place(box(0.15, 0.036, 0.008, RED, 0.003), [0.18, 0.11, 0.014], [0, 0, -0.785]),
    ),
    [0, 0.27, 0], [-0.4, 0, 0],
  ),
  // A pig, side on and turned a little our way: snout, ears, a curl of a tail.
  pig: () => place(
    merge(
      place(ellipsoid(0.26, 0.19, 0.18, C.blush), [0, 0.25, 0]),
      place(ellipsoid(0.15, 0.14, 0.14, C.blush), [0.26, 0.31, 0]),
      place(ellipsoid(0.05, 0.06, 0.07, PINK, 12), [0.4, 0.29, 0]),
      place(paint(new THREE.TorusGeometry(0.04, 0.015, 8, 14), PINK), [-0.28, 0.32, 0]),
      ...[-1, 1].flatMap((k) => [
        place(ellipsoid(0.012, 0.016, 0.012, C.faceInk, 6), [0.445, 0.29, k * 0.028]),
        place(ellipsoid(0.02, 0.025, 0.015, C.faceInk, 8), [0.35, 0.37, k * 0.09]),
        place(paint(new THREE.ConeGeometry(0.05, 0.1, 10), PINK), [0.22, 0.45, k * 0.09], [k * 0.3, 0, -0.3]),
        place(capsule(0.04, 0.07, C.blush), [0.14, 0.07, k * 0.09]),
        place(capsule(0.04, 0.07, C.blush), [-0.14, 0.07, k * 0.09]),
      ]),
    ),
    [0, 0, 0], [0, -0.75, 0],
  ),
};

