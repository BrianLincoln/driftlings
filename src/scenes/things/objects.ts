import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { BLUE, CREAM, GREEN, RED, ball, box, part, type Drawing } from './parts';

// Things with no life in them. No faces.

/** A mug with a stripe round it and something to drink in it. */
export function cup(): Drawing {
  return {
    geo: merge(
      part(1,
        lathe([[0, 0], [0.16, 0], [0.19, 0.03], [0.2, 0.12], [0.2, 0.36]], (p) => (p.y > 0.13 && p.y < 0.23 ? CREAM : BLUE), 40, 60),
        place(paint(new THREE.TorusGeometry(0.19, 0.018, 10, 40), BLUE), [0, 0.36, 0], [Math.PI / 2, 0, 0]),
      ),
      part(2, place(ellipsoid(0.18, 0.012, 0.18, C.trunk, 24), [0, 0.355, 0])),
      part(3, place(paint(new THREE.TorusGeometry(0.1, 0.036, 12, 28), BLUE), [0.2, 0.19, 0])),
    ),
    turn: [0, -0.5],
  };
}

/** A cooking pot with its lid on and a handle each side. */
export function pot(): Drawing {
  return {
    geo: merge(
      part(1,
        lathe([[0, 0], [0.22, 0], [0.27, 0.04], [0.29, 0.14], [0.29, 0.26]], RED),
        place(paint(new THREE.TorusGeometry(0.285, 0.022, 10, 40), RED), [0, 0.26, 0], [Math.PI / 2, 0, 0]),
      ),
      part(2, place(ellipsoid(0.265, 0.1, 0.265, CREAM, 36), [0, 0.265, 0])),
      part(3,
        place(ball(0.05, C.trunk), [0, 0.38, 0]),
        ...[-1, 1].map((k) => place(ellipsoid(0.07, 0.032, 0.055, C.trunk, 16), [k * 0.32, 0.2, 0])),
      ),
    ),
    turn: [0.05, -0.35],
  };
}

/** A bed made up: headboard, pillow, a blanket turned down. Its foot is toward us. */
export function bed(): Drawing {
  const wood = C.shipTrim;
  return {
    geo: merge(
      part(1,
        place(box(0.7, 0.1, 0.42, wood), [0, 0.13, 0]),
        ...[-1, 1].flatMap((i) => [-1, 1].map((k) => place(ball(0.05, wood, 12), [i * 0.3, 0.05, k * 0.17]))),
      ),
      part(2, place(box(0.08, 0.46, 0.48, wood, 0.038), [-0.37, 0.25, 0]), place(box(0.08, 0.28, 0.48, wood, 0.038), [0.37, 0.16, 0])),
      part(3, place(box(0.66, 0.1, 0.4, CREAM, 0.04), [0, 0.22, 0])),
      part(4, place(box(0.4, 0.12, 0.43, BLUE, 0.05), [0.13, 0.235, 0]), place(box(0.09, 0.125, 0.435, CREAM, 0.05), [-0.1, 0.235, 0])),
      part(5, place(ellipsoid(0.085, 0.05, 0.14, CREAM, 18), [-0.25, 0.3, 0])),
    ),
    turn: [0, -0.55],
  };
}

/** A bat for hitting a ball, lying on the grass: long, fat at one end, a taped grip and a knob at the other. */
export function bat(): Drawing {
  // Lying on its fat end and its knob, so the handle slopes down to the grass.
  return {
    geo: merge(place(
      merge(
        part(1, lathe([[0.03, 0.24], [0.036, 0.36], [0.058, 0.54], [0.075, 0.7], [0.075, 0.82], [0.055, 0.88], [0, 0.89]], C.shipTrim, 32)),
        part(1, lathe([[0, 0], [0.055, 0.005], [0.055, 0.04], [0.032, 0.06], [0.032, 0.25]], (p) => (p.y > 0.09 && p.y < 0.2 ? RED : C.shipTrim), 32, 60)),
      ),
      [-0.44, 0.055, 0], [0, 0, 0.04 - Math.PI / 2],
    )),
    turn: [0, 0.35],
  };
}

/** A map unrolled on the grass, its far edge lifted: an island, a dotted way across, a cross where the treasure is. */
export function map(): Drawing {
  const mark = (g: THREE.BufferGeometry, x: number, y: number, turn = 0) => place(g, [x, y, 0.009], [0, 0, turn]);
  return {
    geo: place(
      merge(
        part(1,
          box(0.6, 0.44, 0.014, C.parchment, 0.006),
          mark(ellipsoid(0.13, 0.085, 0.004, GREEN, 24), -0.13, 0.07),
          mark(ellipsoid(0.07, 0.05, 0.004, GREEN, 20), -0.02, 0.11),
          mark(ellipsoid(0.1, 0.06, 0.004, BLUE, 20), 0.15, -0.13),
          ...[[-0.2, -0.12], [-0.11, -0.1], [-0.03, -0.06], [0.04, 0], [0.1, 0.06]].map(([x, y]) => mark(ellipsoid(0.018, 0.018, 0.004, C.ink, 12), x, y)),
          mark(box(0.14, 0.036, 0.008, RED, 0.003), 0.18, 0.11, 0.785),
          mark(box(0.14, 0.036, 0.008, RED, 0.003), 0.18, 0.11, -0.785),
        ),
        part(2, ...[-1, 1].map((k) => place(capsule(0.036, 0.42, C.parchmentEdge), [k * 0.3, 0, 0.01]))),
      ),
      [0, 0.15, 0], [-1.0, 0, 0],
    ),
    turn: [0, 0.3],
  };
}
