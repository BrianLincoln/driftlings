import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { BLUE, CREAM, GREEN, PINK, ball, box, part, swing, wheel, type Drawing } from './parts';

// The third batch: the words of the fourth island. bud, bus, cab, cob, sun, net, nut, peg: near misses
// of bed and bug, of cod, cap and can, of each other and of pig and pin.

const SIDEWAYS: [number, number, number] = [0, 0, Math.PI / 2];
const YELLOW = C.buttercup;
const TURN = Math.PI * 2;

/** Stand a tipped-over piece on the ground: its lowest point to y = 0. */
function ground(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox();
  return g.translate(0, -g.boundingBox!.min.y, 0);
}

/** A flower bud on a stem: shut tight, green nearly to the top with only a tip of colour showing, a leaf each side. */
export function bud(): Drawing {
  const sepal = (p: THREE.Vector3) => {
    const k = (Math.atan2(p.z, p.x) / TURN + 1) * 5 % 1;
    return p.y < 0.13 + 0.15 * (1 - Math.abs(k - 0.5) * 2) ? GREEN : PINK;
  };
  return {
    geo: merge(
      part(1,
        place(capsule(0.034, 0.3, GREEN), [0, 0.17, 0]),
        place(ellipsoid(0.13, 0.024, 0.06, GREEN, 20), [0.13, 0.17, 0], [0, 0, 0.55]),
        place(ellipsoid(0.12, 0.024, 0.06, GREEN, 20), [-0.12, 0.25, 0], [0, 0, -0.6]),
      ),
      part(2, place(lathe([[0, 0], [0.07, 0.015], [0.108, 0.1], [0.1, 0.19], [0.05, 0.29], [0, 0.35]], sepal, 80, 70), [0, 0.32, 0])),
    ),
    turn: [0.05, -0.4],
    scale: 0.85,
  };
}

/** A bus: one long tall box, a row of windows down the side, a wheel at each corner. */
export function bus(): Drawing {
  return {
    geo: merge(
      part(1,
        place(box(0.74, 0.34, 0.3, BLUE, 0.06), [0, 0.26, 0]),
        place(box(0.745, 0.04, 0.305, CREAM, 0.01), [0, 0.185, 0]),
        ...[-1, 1].map((k) => place(ball(0.03, YELLOW, 10), [0.365, 0.2, k * 0.09])),
      ),
      part(2,
        ...[-0.25, -0.1, 0.05].map((x) => place(box(0.11, 0.105, 0.31, CREAM, 0.012), [x, 0.33, 0])),
        place(box(0.14, 0.12, 0.25, CREAM, 0.012), [0.305, 0.325, 0]),
        place(box(0.1, 0.105, 0.31, CREAM, 0.012), [0.21, 0.33, 0]),
      ),
      part(3, ...[-1, 1].flatMap((i) => [-1, 1].map((k) => place(wheel(0.085, 0.07), [i * 0.22, 0, k * 0.125])))),
    ),
    turn: [0, -0.5],
  };
}

/** A cab: a low yellow car with a band of checks down its side and a sign on its roof. */
export function cab(): Drawing {
  return {
    geo: merge(
      part(1,
        place(box(0.66, 0.15, 0.32, YELLOW, 0.055), [0, 0.15, 0]),
        place(box(0.32, 0.16, 0.28, YELLOW, 0.055), [-0.04, 0.27, 0]),
        ...[-3, -2, -1, 0, 1, 2, 3].map((i) => place(box(0.074, 0.055, 0.326, i % 2 ? CREAM : C.trunk, 0.004), [i * 0.07, 0.16, 0])),
      ),
      part(2,
        place(box(0.2, 0.08, 0.29, BLUE, 0.012), [-0.04, 0.285, 0]),
        place(box(0.33, 0.08, 0.2, BLUE, 0.012), [-0.04, 0.285, 0]),
      ),
      part(3, place(box(0.1, 0.09, 0.2, CREAM, 0.025), [-0.04, 0.385, 0])),
      part(4, ...[-1, 1].flatMap((i) => [-1, 1].map((k) => place(wheel(0.08, 0.075), [i * 0.2, 0, k * 0.135])))),
    ),
    turn: [0, 0.5],
  };
}

/** Corn on the cob lying at a lean: rows of fat yellow grains, the green husk peeled back at the bottom. */
export function cob(): Drawing {
  const profile: Array<[number, number]> = [[0, 0], [0.08, 0.01], [0.1, 0.12], [0.095, 0.3], [0.06, 0.43], [0, 0.48]];
  const radius = (y: number) => (y < 0.12 ? 0.08 + (y / 0.12) * 0.02 : y < 0.3 ? 0.1 : 0.1 - ((y - 0.3) / 0.18) * 0.07);
  const rows = 9;
  const round = 9;
  const grains = Array.from({ length: rows }, (_, j) => {
    const y = 0.06 + j * 0.046;
    return Array.from({ length: round }, (_, i) => swing(place(ball(0.034, YELLOW, 10), [radius(y), y, 0]), ((i + (j % 2) / 2) / round) * TURN));
  }).flat();
  const husk = (yaw: number, lean: number) => swing(place(ellipsoid(0.026, 0.18, 0.075, GREEN, 20), [0.115, 0.08, 0], [0, 0, -lean]), yaw);
  return {
    geo: ground(place(
      merge(
        part(1, lathe(profile, C.amber, 24, 30), ...grains),
        part(2, husk(0.4, 0.55), husk(2.5, 0.6), husk(4.6, 0.5), place(capsule(0.04, 0.06, GREEN), [0, -0.03, 0])),
      ),
      [0, 0, 0], [0.25, 0, -0.95],
    )),
    turn: [0, 0.35],
    scale: 0.95,
  };
}

/** The sun: a round disc with stubby rays all the way round, standing on one of them. No face. */
export function sun(): Drawing {
  const rays = 10;
  const mid = 0.31;
  return {
    geo: merge(
      part(1, ...Array.from({ length: rays }, (_, i) => place(
        place(paint(new THREE.ConeGeometry(0.058, 0.13, 16), C.amber).scale(1, 1, 0.6), [0, 0.245, 0]),
        [0, mid, 0], [0, 0, (i / rays) * TURN + Math.PI],
      ))),
      part(2, place(ellipsoid(0.2, 0.2, 0.07, YELLOW, 36), [0, mid, 0])),
    ),
    turn: [-0.08, 0.35],
  };
}

/** A fishing net on a long handle: a hoop held up, the bag of mesh hanging under it. */
export function net(): Drawing {
  const mesh = (u: number, v: number) => ((u % 1 + 1) % 1 < 0.2 || (v % 1 + 1) % 1 < 0.2 ? C.rockDark : CREAM);
  const bag = lathe([[0, -0.3], [0.07, -0.28], [0.14, -0.16], [0.17, 0]], (p) => mesh((Math.atan2(p.z, p.x) / TURN) * 8, p.y / 0.085), 96, 60);
  const mouth = ellipsoid(0.165, 0.012, 0.165, (p) => mesh(p.x * 2.4, p.z * 2.4), 48);
  return {
    geo: ground(place(
      merge(
        part(1, bag, place(mouth, [0, -0.012, 0])),
        part(2, place(paint(new THREE.TorusGeometry(0.17, 0.028, 12, 44), BLUE), [0, 0, 0], [Math.PI / 2, 0, 0])),
        part(3, place(capsule(0.03, 0.4, C.shipTrim), [-0.4, 0, 0], SIDEWAYS)),
      ),
      [0, 0, 0], [0.55, 0, 0.5],
    )),
    turn: [0, -0.35],
    scale: 0.88,
  };
}

/** A nut: an acorn tipped on its side, smooth and brown, in a dark knobbly cup with a stalk. */
export function nut(): Drawing {
  const cup = C.trunk;
  const knobs = [[0.172, 0.31, 10], [0.15, 0.38, 9], [0.1, 0.435, 6]].flatMap(([r, y, n], j) =>
    Array.from({ length: n }, (_, i) => swing(place(ball(0.036, cup, 10), [r, y, 0]), ((i + j / 2) / n) * TURN)));
  return {
    geo: ground(place(
      merge(
        part(1, lathe([[0, 0], [0.035, 0.012], [0.12, 0.1], [0.16, 0.22], [0.15, 0.32]], C.basket, 40, 40)),
        part(2,
          lathe([[0.168, 0.26], [0.18, 0.32], [0.15, 0.4], [0.07, 0.455], [0, 0.46]], cup, 32, 30),
          ...knobs,
          place(capsule(0.03, 0.07, cup), [0.015, 0.5, 0], [0, 0, -0.3]),
        ),
      ),
      [0, 0, 0], [0.3, 0, 0.75],
    )),
    turn: [0, -0.3],
    scale: 0.95,
  };
}

/** A clothes peg standing on its jaws: two wooden arms pinched shut below a ring of spring, splayed apart above it. */
export function peg(): Drawing {
  const wood = C.shipTrim;
  const arm = (k: number) => merge(
    place(box(0.09, 0.3, 0.14, wood, 0.035), [k * 0.046, 0.15, 0]),
    place(place(box(0.09, 0.32, 0.14, wood, 0.035), [0, 0.13, 0]), [k * 0.046, 0.25, 0], [0, 0, -k * 0.42]),
  );
  return {
    geo: ground(place(
      merge(
        part(1, arm(-1)),
        part(2, arm(1)),
        // The round gap in the jaws where the line goes, and one ring of spring each side.
        part(3, place(ellipsoid(0.034, 0.034, 0.076, C.trunk, 14), [0, 0.12, 0])),
        part(4, ...[-1, 1].map((k) => place(paint(new THREE.TorusGeometry(0.07, 0.026, 10, 28), C.rock), [0, 0.27, k * 0.075]))),
      ),
      [0, 0, 0], [0.1, 0, -0.2],
    )),
    turn: [0, 0.4],
  };
}
