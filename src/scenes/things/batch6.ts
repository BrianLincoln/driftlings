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
      ])),
      // Short arms from the chest down to splayed feet lying flat on the ground (their undersides at y = 0).
      part(3, ...[-1, 1].flatMap((k) => [
        limb([k * 0.13, 0.2, 0.06], [k * 0.15, 0.06, 0.22], 0.05, skin),
        place(ellipsoid(0.085, 0.03, 0.075, skin, 18), [k * 0.17, 0.03, 0.26], [0, k * -0.35, 0]),
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
  // A claw is a thick arm and one chunky C-shaped claw: a big fixed finger outside and a slimmer, curved, movable one
  // inside that closes against its tip, with a curved gap between them.
  const D = Math.PI / 180;
  // A curved finger: part of a ring from angle a0 to a1 (degrees), centred at (cx, cy), with round ends. For the
  // other claw (k = -1) the angles are mirrored.
  const finger = (k: number, cx: number, cy: number, R: number, tube: number, a0: number, a1: number) => {
    const [s0, s1] = k > 0 ? [a0, a1] : [180 - a1, 180 - a0];
    const ring = place(paint(new THREE.TorusGeometry(R, tube, 12, 28, (s1 - s0) * D), shell), [k * cx, cy, 0.33], [0, 0, s0 * D]);
    const cap = (a: number) => place(ball(tube, shell, 12), [k * cx + R * Math.cos(a * D * (k > 0 ? 1 : 1)), cy + R * Math.sin(a * D), 0.33]);
    return merge(ring, cap(s0), cap(s1));
  };
  const claw = (k: number) => merge(
    part(3,
      limb([k * 0.22, 0.16, 0.12], [k * 0.34, 0.22, 0.2], 0.055, shell),
      limb([k * 0.34, 0.22, 0.2], [k * 0.37, 0.42, 0.3], 0.055, shell),
      place(ellipsoid(0.12, 0.1, 0.09, shell, 22), [k * 0.37, 0.48, 0.33]),
    ),
    part(4, finger(k, 0.37 - 0.075, 0.64, 0.15, 0.048, -40, 55)),
    part(5, finger(k, 0.37 + 0.075, 0.64, 0.15, 0.032, 125, 220)),
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

/**
 * A plum: an upright oval in two cheeks with a seam between them (the line is drawn where the two meet),
 * deep purple dusted paler at the shoulder, a short stem and one leaf.
 */
export function plum(): Drawing {
  const skin = (side: number) => (_p: THREE.Vector3, n: THREE.Vector3) => (n.y > 0.35 && n.x * side > 0.1 && n.z > 0 ? C.harebell : PURPLE);
  return {
    geo: merge(
      part(1, place(ellipsoid(0.165, 0.22, 0.18, skin(-1), 40), [-0.03, 0.22, 0])),
      part(2, place(ellipsoid(0.165, 0.22, 0.18, skin(1), 40), [0.03, 0.22, 0])),
      part(3, place(capsule(0.02, 0.07, C.trunk), [0.01, 0.46, 0], [0, 0, -0.25])),
      part(4, place(ellipsoid(0.11, 0.022, 0.055, GREEN, 18), [0.11, 0.47, 0.02], [0, 0.3, 0.45])),
    ),
    turn: [0.15, 0.5],
  };
}
