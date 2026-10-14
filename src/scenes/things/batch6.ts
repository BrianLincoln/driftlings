import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { CREAM, GREEN, PURPLE, RED, ball, eyes, limb, part, type Drawing } from './parts';

// The sixth batch, the first half: frog, crab, drum, flag, plum. Words with two consonants together.

/** A frog crouching: green, a wide pale-bellied head with two small bumps and calm eyes, great folded back legs. */
export function frog(): Drawing {
  const skin = GREEN;
  const head: [number, number, number] = [0, 0.3, 0.13];
  const bump = (k: number): [number, number, number] => [k * 0.1, 0.4, 0.1];
  return {
    geo: merge(
      part(1, place(ellipsoid(0.24, 0.2, 0.28, skin), [0, 0.2, -0.1])),
      part(2, place(ellipsoid(0.15, 0.12, 0.1, C.flower, 20), [0, 0.12, 0.1])),
      part(3, ...[-1, 1].flatMap((k) => [
        place(ellipsoid(0.07, 0.15, 0.17, skin, 22), [k * 0.22, 0.17, -0.12], [0, 0, k * 0.2]),
        place(ellipsoid(0.07, 0.04, 0.14, skin, 18), [k * 0.25, 0.04, 0.05], [0, k * 0.2, 0]),
        place(ellipsoid(0.04, 0.035, 0.09, skin, 14), [k * 0.12, 0.03, 0.27], [0, k * -0.25, 0]),
      ])),
      part(4, place(ellipsoid(0.21, 0.15, 0.17, skin, 40), head)),
      part(4, ...[-1, 1].map((k) => place(ball(0.075, skin, 22), bump(k)))),
    ),
    face: eyes(head, [0.45, 0.25], 1.05, [-0.42, 0.12]),
    turn: [0.1, -0.4],
    scale: 0.95,
  };
}

/** A crab: red, wide, two big claws held up, legs out to each side. */
export function crab(): Drawing {
  const shell = RED;
  const dark = C.heart;
  // A claw is a fat palm and two fingers with a V gap between: a fixed one outside and a thinner, movable one inside.
  const claw = (k: number) => merge(
    part(3,
      limb([k * 0.22, 0.16, 0.12], [k * 0.34, 0.22, 0.2], 0.04, shell),
      limb([k * 0.34, 0.22, 0.2], [k * 0.36, 0.38, 0.3], 0.04, shell),
      place(ellipsoid(0.11, 0.1, 0.075, shell, 22), [k * 0.37, 0.47, 0.33]),
    ),
    part(4,
      place(ellipsoid(0.05, 0.13, 0.055, shell, 18), [k * 0.43, 0.62, 0.33], [0, 0, k * -0.3]),
      place(ellipsoid(0.038, 0.12, 0.045, shell, 18), [k * 0.3, 0.61, 0.33], [0, 0, k * 0.4]),
    ),
  );
  const legs = [-1, 1].flatMap((k) => [-0.1, 0.0, 0.1].map((z, i) => merge(
    limb([k * 0.2, 0.14, z - 0.02], [k * 0.34, 0.16, z + (i - 1) * 0.03], 0.024, dark),
    limb([k * 0.34, 0.16, z + (i - 1) * 0.03], [k * 0.4, 0.015, z + (i - 1) * 0.08], 0.024, dark),
  )));
  const head: [number, number, number] = [0, 0.2, 0.0];
  return {
    geo: merge(
      part(1, ...legs),
      part(2, place(ellipsoid(0.3, 0.14, 0.22, shell, 40), [0, 0.2, -0.02])),
      claw(-1), claw(1),
    ),
    face: eyes(head, [0.45, 0.35], 1.0),
    turn: [0.35, 0.3],
    scale: 0.9,
  };
}

/** A drum: a red drum with a cream skin and cream rims, and two sticks crossed on top. */
export function drum(): Drawing {
  const stick = (turn: number) => place(merge(
    place(capsule(0.017, 0.4, C.cutWood), [0, 0, 0], [0, 0, Math.PI / 2]),
    place(ball(0.034, C.cutWood, 12), [0.21, 0, 0]),
  ), [0, 0.345, 0], [0, turn, 0]);
  return {
    geo: merge(
      part(1, lathe([[0, 0.02], [0.2, 0.02], [0.27, 0.06], [0.27, 0.27], [0.25, 0.3]], RED, 40, 40)),
      part(2,
        place(paint(new THREE.TorusGeometry(0.265, 0.025, 10, 40), CREAM), [0, 0.065, 0], [Math.PI / 2, 0, 0]),
        place(paint(new THREE.TorusGeometry(0.265, 0.025, 10, 40), CREAM), [0, 0.275, 0], [Math.PI / 2, 0, 0]),
        ...Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return place(ellipsoid(0.02, 0.1, 0.02, CREAM, 10), [Math.cos(a) * 0.27, 0.17, Math.sin(a) * 0.27]);
        }),
      ),
      part(3, place(ellipsoid(0.255, 0.02, 0.255, C.flower, 36), [0, 0.285, 0])),
      part(4, stick(0.7), stick(-0.7)),
    ),
    turn: [0.35, -0.3],
    scale: 0.95,
  };
}

/** A flag on a pole: red with one pale stripe, waving, no country's. */
export function flag(): Drawing {
  const W = 0.5;
  const H = 0.32;
  const n = 18;
  const wave = (x: number) => Math.sin((x / W) * 5.2) * 0.04 * Math.min(1, x / 0.15 + 0.15);
  // Each stripe of each slice is its own flat box, so the colours stay hard-edged.
  const slices = Array.from({ length: n }, (_, i) => {
    const x0 = (i / n) * W;
    const w = W / n;
    const slope = Math.atan2(wave(x0 + w) - wave(x0), w);
    const rows = Array.from({ length: 5 }, (_, r) => {
      const g = paint(new THREE.BoxGeometry(w * 1.25, H / 5 + 0.002, 0.025), r === 1 ? CREAM : RED);
      return g.translate(w / 2, (r + 0.5) * (H / 5), 0);
    });
    return place(merge(...rows), [x0, 0, wave(x0)], [0, -slope, 0]);
  });
  return {
    geo: merge(
      part(1, place(merge(...slices), [0.03, 0.6 - H - 0.02, 0])),
      part(2, place(capsule(0.02, 0.66, C.cutWood), [0, 0.35, 0]), place(ball(0.04, C.buttercup, 14), [0, 0.7, 0])),
      part(3, place(ellipsoid(0.1, 0.035, 0.1, C.basketDark, 20), [0, 0.01, 0])),
    ),
    turn: [0, -0.45],
  };
}

/** A plum: a plump purple fruit with a pale bloom, a short stem and a leaf. */
export function plum(): Drawing {
  return {
    geo: merge(
      part(1,
        place(ellipsoid(0.22, 0.2, 0.2, PURPLE, 40), [0, 0.2, 0]),
        place(ellipsoid(0.05, 0.03, 0.03, C.harebell, 14), [0.09, 0.32, 0.15], [0, 0, 0.5]),
      ),
      part(2, place(capsule(0.016, 0.1, C.trunk), [0, 0.41, 0], [0.15, 0, 0])),
      part(3, place(ellipsoid(0.1, 0.02, 0.05, C.foliageLight, 18), [0.11, 0.45, 0.0], [0, 0, 0.35])),
    ),
    turn: [0.1, -0.3],
    scale: 0.95,
  };
}
