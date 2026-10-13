import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { BLUE, CREAM, PINK, PURPLE, RED, ball, box, eyes, leg, part, swing, type Drawing } from './parts';

// The words of the first two islands: mat, man, pan, fan, pin, tin, fin, tap.

const SIDEWAYS: [number, number, number] = [0, 0, Math.PI / 2];

/** A doormat with stripes and a fringe at each end, its far edge lifted so its top shows. */
export function mat(): Drawing {
  const stripe = (x: number, w: number) => place(box(w, 0.054, 0.47, CREAM, 0.02), [x, 0.027, 0]);
  return {
    geo: place(
      merge(
        part(1, place(box(0.62, 0.05, 0.46, RED, 0.02), [0, 0.025, 0]), stripe(-0.17, 0.07), stripe(0.17, 0.07)),
        part(2, ...[-1, 1].flatMap((k) => [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((i) => place(capsule(0.02, 0.06, CREAM), [k * 0.34, 0.022, i * 0.076], SIDEWAYS)))),
      ),
      [0, 0.1, 0], [0.45, 0, 0],
    ),
    turn: [0, -0.35],
  };
}

/** A man: a toy figure on two fat legs, a round head with hair, arms at his sides. */
export function man(): Drawing {
  const head: [number, number, number] = [0, 0.5, 0.02];
  const skin = C.basket;
  return {
    geo: merge(
      swing(merge(
        part(1, ...[-1, 1].map((k) => place(leg(0.06, 0.2, BLUE), [k * 0.066, 0, 0]))),
        part(2, ...[-1, 1].map((k) => place(ellipsoid(0.062, 0.036, 0.085, C.trunk, 14), [k * 0.066, 0.036, 0.03]))),
        part(3, lathe([[0, 0.13], [0.12, 0.15], [0.135, 0.22], [0.11, 0.34], [0, 0.39]], RED)),
        part(4, ...[-1, 1].map((k) => place(capsule(0.04, 0.1, RED), [k * 0.16, 0.27, 0], [0, 0, k * 0.3]))),
        part(5, ...[-1, 1].map((k) => place(ball(0.042, skin, 12), [k * 0.19, 0.185, 0]))),
      ), -0.3),
      part(6, place(ellipsoid(0.16, 0.15, 0.15, skin, 40), head)),
      part(7, place(ellipsoid(0.166, 0.115, 0.16, C.trunk, 30), [0, 0.565, -0.03])),
    ),
    face: eyes(head, [0.42, 0.06], 1, [-0.42, 0.08]),
    turn: [0, 0.4],
    scale: 0.82,
  };
}

/** A frying pan: shallow, dark, one long handle and no lid. Tipped so its inside shows. */
export function pan(): Drawing {
  return {
    geo: place(
      merge(
        part(1,
          lathe([[0, 0], [0.19, 0], [0.225, 0.025], [0.245, 0.09]], C.trunk),
          place(paint(new THREE.TorusGeometry(0.245, 0.018, 10, 40), C.trunk), [0, 0.09, 0], [Math.PI / 2, 0, 0]),
        ),
        part(2, place(ellipsoid(0.228, 0.01, 0.228, C.rock, 28), [0, 0.078, 0])),
        part(3, place(capsule(0.042, 0.3, RED), [0.44, 0.115, 0], [0, 0, 0.15 - Math.PI / 2])),
      ),
      [0, 0.09, 0], [0.38, 0, 0],
    ),
    turn: [0, -0.5],
  };
}

/** A fan on a stand: a round guard, three blades, a hub. */
export function fan(): Drawing {
  const mid = 0.345;
  return {
    geo: merge(
      part(1,
        place(ellipsoid(0.17, 0.045, 0.13, BLUE, 24), [0, 0.045, 0]),
        place(leg(0.045, 0.16, BLUE), [0, 0, -0.01]),
        place(paint(new THREE.TorusGeometry(0.205, 0.035, 12, 40), BLUE), [0, mid, 0]),
      ),
      part(2, place(ellipsoid(0.2, 0.2, 0.025, C.trunk, 32), [0, mid, -0.015])),
      part(3, ...[0, 1, 2].map((i) => place(place(ellipsoid(0.066, 0.082, 0.012, CREAM, 18), [0, 0.092, 0]), [0, mid, 0.022], [0, 0, 0.5 + i * 2.094]))),
      part(4, place(ball(0.046, RED), [0, mid, 0.035])),
    ),
    turn: [0, 0.45],
    scale: 0.9,
  };
}

/** A drawing pin stuck in the grass at a lean: a fat red head, a short spike. */
export function pin(): Drawing {
  return {
    geo: place(
      merge(
        part(1, lathe([[0, 0], [0.022, 0.05], [0.034, 0.12], [0.036, 0.22]], C.rock, 20)),
        part(2, lathe([
          [0.03, 0.19], [0.125, 0.2], [0.14, 0.225], [0.125, 0.25], [0.072, 0.275], [0.062, 0.33],
          [0.072, 0.395], [0.14, 0.425], [0.155, 0.455], [0.14, 0.492], [0, 0.5],
        ], RED, 36, 90)),
      ),
      [0, 0, 0], [0.3, 0, -0.6],
    ),
    turn: [0, 0.3],
  };
}

/** A round biscuit tin with its lid on: squat, a band round it, a lid that overhangs. */
export function tin(): Drawing {
  return {
    geo: merge(
      part(1, lathe([[0, 0], [0.23, 0], [0.25, 0.02], [0.25, 0.25]], (p) => (p.y > 0.07 && p.y < 0.15 ? CREAM : PURPLE), 40, 60)),
      part(2, lathe([[0.272, 0.2], [0.278, 0.22], [0.278, 0.285], [0.25, 0.312], [0.12, 0.326], [0, 0.328]], PINK, 40, 60)),
    ),
    turn: [0.08, 0.35],
  };
}

/** A shark's fin standing out of a pool of water, a ripple round it. */
export function fin(): Drawing {
  const shape = new THREE.Shape();
  shape.moveTo(-0.2, 0);
  shape.quadraticCurveTo(-0.04, 0.36, 0.17, 0.45);
  shape.quadraticCurveTo(0.07, 0.2, 0.2, 0);
  shape.lineTo(-0.2, 0);
  const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 20 });
  const ripple = paint(new THREE.TorusGeometry(0.25, 0.015, 8, 40), CREAM);
  ripple.rotateX(Math.PI / 2).scale(1, 1, 0.52);
  return {
    geo: merge(
      part(1, place(ellipsoid(0.4, 0.025, 0.25, BLUE, 32), [0, 0.025, 0]), place(ripple, [0, 0.042, 0])),
      part(2, place(paint(blade, C.rockDark), [0, 0.04, -0.025])),
    ),
    turn: [0, 0.45],
  };
}

/** A tap on a pipe out of the ground: a red cross to turn, a spout, a drip. */
export function tap(): Drawing {
  const metal = C.harebell;
  return {
    geo: merge(
      part(1,
        place(ellipsoid(0.12, 0.035, 0.12, metal, 20), [0, 0.035, 0]),
        leg(0.065, 0.42, metal),
        place(capsule(0.055, 0.24, metal), [0.12, 0.31, 0], SIDEWAYS),
        place(paint(new THREE.CylinderGeometry(0.056, 0.07, 0.11, 24), metal), [0.24, 0.255, 0]),
        place(leg(0.035, 0.12, metal), [0, 0.39, 0]),
      ),
      part(2,
        place(capsule(0.036, 0.16, RED), [0, 0.51, 0], SIDEWAYS),
        place(capsule(0.036, 0.16, RED), [0, 0.51, 0], [Math.PI / 2, 0, 0]),
        place(ball(0.05, RED, 12), [0, 0.51, 0]),
      ),
      part(3, place(lathe([[0, 0], [0.04, 0.012], [0.055, 0.05], [0.035, 0.1], [0, 0.15]], BLUE, 24), [0.24, 0.025, 0])),
    ),
    turn: [0, -0.45],
  };
}
