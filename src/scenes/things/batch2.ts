import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { BLUE, CREAM, GREEN, RED, ball, box, eyes, part, swing, type Drawing } from './parts';

// The second batch: the words of the third island. Near misses of each other and of cat, pot and map,
// so each has its own outline and its own colours.

/** A cap with a peak: a round crown with a pale front, a button on top. */
export function cap(): Drawing {
  return {
    geo: merge(
      part(1, lathe([[0, 0], [0.25, 0], [0.27, 0.04], [0.26, 0.13], [0.2, 0.25], [0.1, 0.31], [0, 0.32]], (p) => (p.z > 0.13 && p.y > 0.03 ? CREAM : RED), 64, 60)),
      part(2, place(ellipsoid(0.23, 0.024, 0.21, BLUE, 30), [0, 0.05, 0.27], [0.1, 0, 0])),
      part(3, place(ellipsoid(0.045, 0.03, 0.045, BLUE, 14), [0, 0.32, 0])),
    ),
    turn: [0.1, 0.5],
  };
}

/** A baby's cot: a post at each corner, a board at each end, bars down both sides, a mattress low inside. */
export function cot(): Drawing {
  const xs = [-0.2, -0.1, 0, 0.1, 0.2];
  return {
    geo: merge(
      part(1, place(box(0.56, 0.1, 0.34, C.blush, 0.03), [0, 0.2, 0])),
      part(2,
        ...[-1, 1].flatMap((i) => [-1, 1].map((k) => place(box(0.07, 0.54, 0.07, CREAM, 0.03), [i * 0.3, 0.27, k * 0.19]))),
        ...[-1, 1].map((i) => place(box(0.04, 0.3, 0.38, CREAM, 0.018), [i * 0.3, 0.31, 0])),
        ...[-1, 1].flatMap((k) => [0.15, 0.46].map((y) => place(box(0.6, 0.055, 0.045, CREAM, 0.02), [0, y, k * 0.19]))),
      ),
      part(3, ...[-1, 1].flatMap((k) => xs.map((x) => place(capsule(0.018, 0.27, CREAM), [x, 0.305, k * 0.19])))),
    ),
    turn: [0, -0.5],
  };
}

/** A watering can: a long spout with a rose on the end, a loop of a handle behind. */
export function can(): Drawing {
  const slope: [number, number, number] = [0, 0, -0.85];
  return {
    geo: merge(
      part(1, lathe([[0, 0], [0.17, 0], [0.19, 0.03], [0.185, 0.3], [0.17, 0.36], [0.1, 0.39], [0, 0.4]], GREEN)),
      part(2, place(lathe([[0.055, 0], [0.047, 0.17], [0.04, 0.34]], GREEN, 24, 8), [0.12, 0.07, 0], slope)),
      part(3, place(lathe([[0.04, 0], [0.09, 0.07], [0.09, 0.09], [0, 0.1]], (p) => (p.y > 0.085 ? CREAM : GREEN), 28, 30), [0.36, 0.28, 0], slope)),
      part(4, place(paint(new THREE.TorusGeometry(0.115, 0.034, 12, 28), GREEN), [-0.2, 0.22, 0])),
    ),
    turn: [0, -0.45],
    scale: 0.9,
  };
}

/** A dot: one big round spot on a card, and nothing else. */
export function dot(): Drawing {
  return {
    geo: part(1, place(
      merge(box(0.46, 0.46, 0.05, CREAM, 0.022), place(ellipsoid(0.14, 0.14, 0.006, BLUE, 40), [0, 0, 0.026])),
      [0, 0.225, 0], [-0.3, 0, 0],
    )),
    turn: [0, 0.4],
  };
}

/** A spinning top up on its point, leaning as it goes: a fat striped body and a peg to twist. */
export function top(): Drawing {
  return {
    geo: place(
      merge(
        part(1, lathe(
          [[0, 0], [0.035, 0.04], [0.19, 0.2], [0.27, 0.29], [0.2, 0.37], [0.07, 0.41], [0, 0.42]],
          (p) => (p.y < 0.07 ? C.trunk : p.y > 0.23 && p.y < 0.33 ? CREAM : RED), 48, 70,
        )),
        part(2, place(capsule(0.032, 0.1, BLUE), [0, 0.47, 0]), place(ball(0.055, BLUE), [0, 0.55, 0])),
      ),
      [0, 0, 0], [0, 0, 0.22],
    ),
    turn: [0.1, 0.3],
    scale: 0.9,
  };
}

/** A mop standing on its head: a long handle and a skirt of fat strands spread on the ground. */
export function mop(): Drawing {
  const strands = 10;
  // Neighbours take different numbers, so a line falls between every strand and the next.
  const strand = (i: number) => part(2 + (i % 2), swing(merge(
    place(capsule(0.036, 0.2, CREAM), [0.1, 0.115, 0], [0, 0, 0.75]),
    place(ball(0.045, CREAM, 12), [0.19, 0.045, 0]),
  ), (i / strands) * Math.PI * 2));
  return {
    geo: merge(
      part(1, place(ellipsoid(0.12, 0.1, 0.12, CREAM, 20), [0, 0.1, 0])),
      ...Array.from({ length: strands }, (_, i) => strand(i)),
      part(4, place(ellipsoid(0.075, 0.055, 0.075, BLUE, 20), [0, 0.22, 0])),
      part(5, place(capsule(0.027, 0.46, C.shipTrim), [0, 0.5, 0])),
    ),
    turn: [0.08, 0.3],
    scale: 0.85,
  };
}

/** A cod: a fat fish on its belly, nearly side on, a forked tail and a fin on its back. */
export function cod(): Drawing {
  const head: [number, number, number] = [0, 0.2, 0.1];
  const fin = C.amber;
  return {
    geo: merge(
      part(1, place(ellipsoid(0.14, 0.17, 0.3, (p) => (p.y < -0.4 ? CREAM : BLUE), 40), [0, 0.17, 0])),
      part(2, ...[-1, 1].map((k) => place(ellipsoid(0.03, 0.065, 0.13, fin, 16), [0, 0.19 + k * 0.075, -0.36], [k * 0.65, 0, 0]))),
      part(3, place(ellipsoid(0.03, 0.075, 0.13, fin, 16), [0, 0.33, -0.06], [0.25, 0, 0])),
      part(4, ...[-1, 1].map((k) => place(ellipsoid(0.028, 0.05, 0.085, fin, 14), [k * 0.14, 0.07, 0.0], [0.5, 0, -k * 0.6]))),
    ),
    face: eyes(head, [0.95, 0.12], 1.4),
    turn: [0, 1.0],
  };
}

/** Dad: a peg doll of a grown-up in a jumper and tie, with a moustache and his hair going back. */
export function dad(): Drawing {
  const head: [number, number, number] = [0, 0.5, 0];
  const skin = C.cutWood;
  return {
    geo: merge(
      swing(merge(
        part(1,
          lathe([[0, 0], [0.15, 0], [0.165, 0.04], [0.15, 0.2], [0.115, 0.33], [0, 0.37]], (p) => (p.y < 0.13 ? C.trunk : BLUE), 40, 60),
          place(ellipsoid(0.03, 0.075, 0.014, RED, 14), [0, 0.235, 0.137], [-0.2, 0, 0]),
          place(ball(0.032, RED, 12), [0, 0.315, 0.108]),
        ),
        part(2, ...[-1, 1].map((k) => place(capsule(0.042, 0.13, BLUE), [k * 0.17, 0.22, 0], [0, 0, k * 0.16]))),
        part(3, ...[-1, 1].map((k) => place(ball(0.045, skin, 12), [k * 0.187, 0.115, 0]))),
      ), -0.25),
      part(4,
        place(ellipsoid(0.15, 0.145, 0.145, (p) => (p.y - 0.5 * p.z > 0.55 ? C.trunk : skin), 56), head),
        ...[-1, 1].map((k) => place(ellipsoid(0.045, 0.02, 0.016, C.trunk, 12), [k * 0.035, 0.435, 0.132], [0, k * 0.25, -k * 0.3])),
      ),
    ),
    face: eyes(head, [0.42, 0.1], 1.1),
    turn: [0, 0.35],
    scale: 0.88,
  };
}
