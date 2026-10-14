import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { ellipsoid, lathe, merge, paint, place, puff } from '../../gfx/geo';
import { BLUE, CREAM, ball, box, eyes, leg, limb, part, swing, type Drawing } from './parts';

// The fifth batch: elk, milk, ant, nest. They stand alone; none has a near miss that is drawn.

/**
 * One antler: a thick beam sweeping up, out and back from the head, with long tines rising forward off it
 * and a forked end. `k` is the side, 1 right and -1 left.
 */
function antler(colour: string, k: number): THREE.BufferGeometry {
  const at = (x: number, y: number, z: number): [number, number, number] => [x * k, y, z];
  const beam = [at(0, 0, 0), at(0.1, 0.07, -0.05), at(0.22, 0.15, -0.12), at(0.32, 0.27, -0.17), at(0.38, 0.4, -0.16)];
  const tine = (from: number, to: [number, number, number]) => merge(limb(beam[from], to, 0.034, colour), place(ball(0.034, colour, 10), to));
  return merge(
    ...beam.slice(0, -1).map((p, i) => limb(p, beam[i + 1], 0.05 - i * 0.004, colour)),
    ...beam.map((p, i) => place(ball(0.05 - i * 0.004, colour, 10), p)),
    tine(0, at(0.06, 0.07, 0.14)),
    tine(1, at(0.15, 0.2, 0.08)),
    tine(2, at(0.24, 0.33, 0.04)),
    tine(3, at(0.31, 0.45, -0.04)),
    tine(4, at(0.48, 0.5, -0.2)),
  );
}

/**
 * An elk, made to be told from a deer: a heavy body the colour of toast, a dark chocolate neck with a shaggy
 * mane hanging under it, a pale rump, and a rack of antlers twice as wide as the body.
 */
export function elk(): Drawing {
  const head: [number, number, number] = [0, 0.6, 0.1];
  const coat = C.basket;
  const dark = C.shipHull;
  const horn = C.cutWood;
  return {
    geo: merge(
      swing(merge(
        part(1, place(ellipsoid(0.2, 0.19, 0.3, coat), [0, 0.34, -0.24]), place(ellipsoid(0.13, 0.13, 0.06, C.cutWood, 20), [0, 0.37, -0.51])),
        part(2, ...[-1, 1].flatMap((k) => [-0.04, -0.44].map((z) => place(leg(0.055, 0.24, dark), [k * 0.12, 0, z])))),
      ), 0.8),
      part(4,
        place(ellipsoid(0.15, 0.2, 0.15, dark, 28), [0, 0.45, 0.02], [0.3, 0, 0]),
        place(puff(0.13, dark, 3, 0.3), [0, 0.32, 0.08]),
      ),
      part(5, place(ellipsoid(0.13, 0.12, 0.14, C.trunk, 36), head)),
      part(6, ...[-1, 1].map((k) => place(ellipsoid(0.035, 0.07, 0.03, C.trunk, 14), [k * 0.15, 0.62, 0.04], [0, 0, k * 1.0]))),
      part(7,
        place(ellipsoid(0.08, 0.075, 0.12, C.basketDark, 20), [0, 0.55, 0.2]),
        place(ellipsoid(0.03, 0.02, 0.018, C.faceInk, 12), [0, 0.57, 0.31]),
      ),
      part(8, ...[-1, 1].map((k) => place(antler(horn, k), [k * 0.06, 0.69, 0.06]))),
    ),
    face: eyes(head, [0.5, 0.2], 1.3, [-0.55, 0.05]),
    turn: [0, 0.3],
    scale: 0.75,
  };
}

/** A carton of milk: white, a blue panel with a drop on it, a gabled top folded shut. */
export function milk(): Drawing {
  const roof = new THREE.Shape();
  roof.moveTo(-0.13, 0);
  roof.lineTo(0.13, 0);
  roof.lineTo(0.13, 0.07);
  roof.lineTo(0.0, 0.2);
  roof.lineTo(-0.13, 0.07);
  const gable = place(paint(new THREE.ExtrudeGeometry(roof, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3 }), BLUE), [0, 0, -0.1]);
  return {
    geo: merge(
      part(1, place(box(0.28, 0.34, 0.28, CREAM, 0.025), [0, 0.17, 0])),
      part(2, place(gable, [0, 0.34, 0]), place(box(0.06, 0.03, 0.22, BLUE, 0.01), [0, 0.57, 0])),
      part(3,
        place(box(0.285, 0.15, 0.285, BLUE, 0.02), [0, 0.15, 0]),
      ),
      part(4, place(ellipsoid(0.055, 0.075, 0.012, CREAM, 18), [0.0, 0.17, 0.145]), place(ellipsoid(0.012, 0.075, 0.055, CREAM, 18), [0.145, 0.17, 0.0])),
    ),
    turn: [0.05, 0.6],
  };
}

/**
 * An ant: a round head looking round at us with the creatures' eyes, then a small middle and a big back end, each
 * pinched off from the next by a narrow waist; six short legs bent at the knee with their feet on the ground, two
 * elbowed feelers with no knob. A dark brown, not black: black that big has no lines or light on it.
 */
export function ant(): Drawing {
  const body = C.shipHull;
  const head: [number, number, number] = [0, 0.27, 0.02];
  // Built along -z behind the head, then swung round under it: the middle, its legs, the waist and the back end.
  const mid: [number, number, number] = [0, 0.2, -0.26];
  const reach: Array<[number, number, number]> = [[0.05, 0.11, 0.17], [0, 0, 0], [-0.05, -0.12, -0.17]];
  const legs = [-1, 1].flatMap((k) => reach.map(([z0, zk, zf]) => merge(
    limb([k * 0.06, 0.18, mid[2] + z0], [k * 0.15, 0.22, mid[2] + zk], 0.026, body),
    limb([k * 0.15, 0.22, mid[2] + zk], [k * 0.2, 0.022, mid[2] + zf], 0.024, body),
  )));
  const feeler = (k: number) => merge(
    limb([k * 0.06, 0.38, 0.06], [k * 0.1, 0.5, 0.02], 0.018, body),
    limb([k * 0.1, 0.5, 0.02], [k * 0.2, 0.55, 0.1], 0.016, body),
  );
  return {
    geo: merge(
      swing(merge(
        part(1, ...legs),
        part(2, place(ellipsoid(0.105, 0.095, 0.13, body, 28), [0, 0.22, mid[2]])),
        part(3, place(ball(0.04, body, 14), [0, 0.19, -0.405])),
        part(4, place(ellipsoid(0.15, 0.14, 0.2, body, 32), [0, 0.23, -0.6], [-0.25, 0, 0])),
      ), 1.45),
      part(5, place(ellipsoid(0.15, 0.14, 0.14, body, 36), head)),
      part(6, feeler(-1), feeler(1)),
    ),
    face: eyes(head, [0.45, 0.15], 1.4),
    turn: [0.15, -0.35],
    scale: 0.8,
  };
}

/** A bird's nest: a solid bowl sitting on the ground, wound round with many small crossing twigs, three pale blue eggs in it. */
export function nest(): Drawing {
  const radius = (y: number) => 0.12 + 0.18 * Math.sin(Math.min(1, y / 0.2) * Math.PI / 2);
  const tones = [C.basket, C.basketDark, C.cutWood];
  const at = (a: number, y: number, out = 0.012): [number, number, number] => {
    const r = radius(y) + out;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  // A pseudo-random but fixed scatter, so the twigs crisscross the same way every time.
  const rnd = (i: number, j: number) => { const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return v - Math.floor(v); };
  const twigs = Array.from({ length: 120 }, (_, i) => {
    const a = rnd(i, 1) * Math.PI * 2;
    const dir = rnd(i, 5) < 0.5 ? 1 : -1;
    const y0 = 0.03 + rnd(i, 2) * 0.2;
    const y1 = Math.min(0.24, Math.max(0.03, y0 + (rnd(i, 3) - 0.5) * 0.12));
    const span = 0.3 + rnd(i, 4) * 0.45;
    return limb(at(a, y0, 0.008 + rnd(i, 6) * 0.014), at(a + dir * span, y1, 0.008 + rnd(i, 7) * 0.014), 0.011 + rnd(i, 8) * 0.004, tones[i % 3]);
  });
  // A few short, uneven ends poking out past the rim.
  const poking = [0.4, 1.3, 2.2, 3.4, 4.0, 5.2].map((a, i) => {
    const len = 0.04 + rnd(i, 9) * 0.07;
    const tilt = a + (rnd(i, 10) - 0.5) * 0.9;
    const base = at(a, 0.21 + rnd(i, 11) * 0.03, 0.0);
    return limb(base, [base[0] + Math.cos(tilt) * len, base[1] + 0.01 + rnd(i, 12) * len * 0.8, base[2] + Math.sin(tilt) * len], 0.012, tones[i % 3]);
  });
  const bowl = lathe([[0, 0], [0.12, 0.004], [0.22, 0.04], [0.28, 0.11], [0.3, 0.2], [0.29, 0.245], [0.25, 0.245], [0.22, 0.17], [0.14, 0.095], [0, 0.085]], C.basketDark, 36, 40);
  return {
    geo: merge(
      part(1, bowl, ...twigs, ...poking),
      part(2, ...[[-0.09, -0.04], [0.1, 0.0], [0.0, 0.1]].map(([x, z], i) => place(ellipsoid(0.08, 0.1, 0.08, C.harebell, 20), [x, 0.19 + (i === 2 ? 0.0 : 0.02), z], [0.2, 0, i - 1 ? 0.2 : -0.2]))),
    ),
    turn: [0.45, 0.3],
  };
}
