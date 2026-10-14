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

/** An ant seen from above and a little to the side: three round parts, six legs, two feelers. */
export function ant(): Drawing {
  const body = C.shipHull;
  const head: [number, number, number] = [0, 0.24, 0.3];
  const legs = [-1, 1].flatMap((k) => [0.06, 0.0, -0.08].map((z, i) => {
    const out = 0.2 + (i === 1 ? 0.03 : 0);
    return merge(
      limb([k * 0.08, 0.17, z], [k * out, 0.25 - i * 0.0, z + (i - 1) * 0.07], 0.028, C.basketDark),
      limb([k * out, 0.25, z + (i - 1) * 0.07], [k * (out + 0.06), 0.015, z + (i - 1) * 0.12], 0.028, C.basketDark),
    );
  }));
  return {
    geo: merge(
      part(1, ...legs),
      part(2, place(ellipsoid(0.14, 0.13, 0.18, body, 32), [0, 0.2, -0.26])),
      part(3, place(ellipsoid(0.1, 0.095, 0.11, body, 28), [0, 0.2, -0.02])),
      part(4, place(ellipsoid(0.18, 0.16, 0.15, body, 32), head)),
      part(5, ...[-1, 1].flatMap((k) => [
        limb([k * 0.05, 0.3, 0.38], [k * 0.12, 0.44, 0.46], 0.022, C.basketDark),
        limb([k * 0.12, 0.44, 0.46], [k * 0.2, 0.52, 0.4], 0.022, C.basketDark),
        place(ball(0.034, C.basketDark, 10), [k * 0.2, 0.52, 0.4]),
      ])),
    ),
    face: eyes(head, [0.5, 0.2], 1.4, [-0.5, 0.06]),
    turn: [0.12, -1.15],
  };
}

/** A bird's nest: a bowl woven of twigs with three pale blue eggs in it. */
export function nest(): Drawing {
  const twig = C.basket;
  const dark = C.basketDark;
  const rings = Array.from({ length: 9 }, (_, i) => {
    const y = 0.07 + (i % 3) * 0.06;
    const r = 0.23 + (i % 3) * 0.025 - (i % 2) * 0.02;
    const ring = place(paint(new THREE.TorusGeometry(r, 0.03, 8, 36), i % 2 ? twig : dark), [0, y, 0], [Math.PI / 2 + (i % 3 - 1) * 0.12, 0, i * 0.7]);
    return ring;
  });
  const sticks = [0.5, 2.0, 3.4, 4.7].map((a) => limb([Math.cos(a) * 0.2, 0.16, Math.sin(a) * 0.2], [Math.cos(a) * 0.37, 0.24, Math.sin(a) * 0.37], 0.025, dark));
  return {
    geo: merge(
      part(1,
        place(lathe([[0, 0.02], [0.16, 0.02], [0.24, 0.08], [0.27, 0.18], [0.25, 0.22]], dark, 32), [0, 0, 0]),
        ...rings, ...sticks,
      ),
      part(2, ...[[-0.1, -0.04], [0.1, 0.0], [-0.0, 0.1]].map(([x, z], i) => place(ellipsoid(0.08, 0.1, 0.08, C.harebell, 20), [x, 0.2 + (i === 2 ? 0.0 : 0.02), z], [0.2, 0, i - 1 ? 0.2 : -0.2]))),
    ),
    turn: [0.45, 0.3],
  };
}
