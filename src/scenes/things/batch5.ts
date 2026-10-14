import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { BLUE, CREAM, ball, box, eyes, leg, limb, part, swing, type Drawing } from './parts';

// The fifth batch: elk, milk, ant, nest. They stand alone; none has a near miss that is drawn.

/** One antler: a beam sweeping up and out, with tines branching off it. `k` is the side, 1 right and -1 left. */
function antler(colour: string, k: number): THREE.BufferGeometry {
  const at = (x: number, y: number, z: number): [number, number, number] => [x * k, y, z];
  const beam = [at(0, 0, 0), at(0.07, 0.12, -0.03), at(0.14, 0.26, -0.03), at(0.17, 0.4, 0)];
  const tine = (from: number, to: [number, number, number]) => limb(beam[from], to, 0.024, colour);
  return merge(
    ...beam.slice(0, -1).map((p, i) => limb(p, beam[i + 1], 0.034 - i * 0.003, colour)),
    ball(0.034, colour, 10),
    tine(1, at(0.03, 0.27, 0.06)),
    tine(2, at(0.04, 0.4, 0.04)),
    tine(2, at(0.28, 0.35, -0.03)),
    tine(3, at(0.25, 0.54, 0)),
    tine(3, at(0.1, 0.55, 0)),
    place(ball(0.03, colour, 10), beam[3]),
  );
}

/** An elk: brown, long in the leg, a pale muzzle and rump, and a great branching rack of antlers. */
export function elk(): Drawing {
  const head: [number, number, number] = [0, 0.56, 0.06];
  const fur = C.trunk;
  const horn = C.shipTrim;
  return {
    geo: merge(
      swing(merge(
        part(1, place(ellipsoid(0.17, 0.17, 0.27, fur), [0, 0.3, -0.2])),
        part(2, ...[-1, 1].flatMap((k) => [-0.04, -0.36].map((z) => place(leg(0.052, 0.22, C.shipHull), [k * 0.09, 0, z])))),
        part(3, place(ellipsoid(0.05, 0.06, 0.05, fur, 14), [0, 0.38, -0.46])),
      ), 0.75),
      part(4, place(ellipsoid(0.115, 0.17, 0.12, fur, 22), [0, 0.42, 0.03], [0.25, 0, 0])),
      part(5, place(ellipsoid(0.15, 0.14, 0.15, fur, 40), head)),
      part(6, ...[-1, 1].map((k) => place(ellipsoid(0.04, 0.075, 0.035, C.shipHull, 14), [k * 0.15, 0.57, -0.03], [0, 0, k * 0.9]))),
      part(7,
        place(ellipsoid(0.085, 0.07, 0.115, C.cutWood, 20), [0, 0.51, 0.17]),
        place(ellipsoid(0.028, 0.02, 0.018, C.faceInk, 12), [0, 0.535, 0.28]),
      ),
      part(8, ...[-1, 1].map((k) => place(antler(horn, k), [k * 0.07, 0.58, -0.03], [0.1, 0, 0]))),
    ),
    face: eyes(head, [0.5, 0.22], 1.1, [-0.5, 0.06]),
    turn: [0, 0.3],
    scale: 0.8,
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

/** An ant from above and a little to the side: black, three round segments, six legs splayed out from the middle one, two feelers. */
export function ant(): Drawing {
  const body = C.faceInk;
  const head: [number, number, number] = [0, 0.24, 0.3];
  // Short black legs bent at the knee, three a side: front ones reach forward, middle ones out, back ones trail.
  const reach: Array<[number, number, number, number]> = [[0.06, 0.1, 0.17, 0.2], [-0.02, 0.0, 0.0, -0.01], [-0.1, -0.1, -0.2, -0.22]];
  const legs = [-1, 1].flatMap((k) => reach.map(([z0, zk, zf]) => merge(
    limb([k * 0.07, 0.19, z0], [k * 0.17, 0.27, zk], 0.022, body),
    limb([k * 0.17, 0.27, zk], [k * 0.24, 0.02, zf], 0.022, body),
  )));
  return {
    geo: merge(
      part(1, ...legs),
      part(2, place(ellipsoid(0.14, 0.13, 0.18, body, 32), [0, 0.2, -0.28])),
      part(3, place(ellipsoid(0.1, 0.095, 0.11, body, 28), [0, 0.2, -0.04])),
      part(4, place(ellipsoid(0.18, 0.16, 0.15, body, 32), head)),
      part(5, ...[-1, 1].flatMap((k) => [
        limb([k * 0.05, 0.3, 0.38], [k * 0.12, 0.44, 0.46], 0.022, body),
        limb([k * 0.12, 0.44, 0.46], [k * 0.2, 0.52, 0.4], 0.022, body),
        place(ball(0.034, body, 10), [k * 0.2, 0.52, 0.4]),
      ])),
    ),
    turn: [0.12, -1.15],
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
