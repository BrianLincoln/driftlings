import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { BLUE, CREAM, RED, ball, box, limb, part, type Drawing } from './parts';

// The sixth batch, the second half: sled, belt, desk, mask, hand.

/** A sled: red planks on two steel runners that curl up at the front, a rope to pull it by. */
export function sled(): Drawing {
  const runner = (k: number) => merge(
    place(box(0.62, 0.05, 0.06, C.rockDark, 0.015), [0, 0.03, k * 0.17]),
    place(paint(new THREE.TorusGeometry(0.1, 0.022, 8, 20, Math.PI * 0.62), C.rockDark), [0.31, 0.12, k * 0.14], [0, 0, -Math.PI / 2 + 0.05]),
    place(box(0.04, 0.12, 0.04, C.trunk, 0.01), [-0.18, 0.1, k * 0.14]),
    place(box(0.04, 0.12, 0.04, C.trunk, 0.01), [0.14, 0.1, k * 0.14]),
  );
  return {
    geo: merge(
      part(1, runner(-1), runner(1)),
      part(2, ...[-0.26, -0.13, 0, 0.13, 0.26].map((x) => place(box(0.1, 0.055, 0.46, RED, 0.015), [x, 0.18, 0]))),
      part(3, limb([0.4, 0.14, -0.14], [0.55, 0.06, -0.1], 0.026, C.buttercup), limb([0.55, 0.06, -0.1], [0.55, 0.06, 0.1], 0.026, C.buttercup), limb([0.55, 0.06, 0.1], [0.4, 0.14, 0.14], 0.026, C.buttercup)),
    ),
    turn: [0.1, -0.5],
  };
}

/** A belt lying in a loop: brown leather, a big gold buckle, the tail through it with its row of holes. */
export function belt(): Drawing {
  const R = 0.27;
  const strap = C.basketDark;
  const band = lathe([[R - 0.014, 0.0], [R + 0.014, 0.0], [R + 0.016, 0.07], [R + 0.014, 0.14], [R - 0.014, 0.14], [R - 0.016, 0.07]], strap, 48, 40);
  return {
    geo: merge(
      part(1, band),
      part(2,
        // The buckle at the front: a gold frame with the dark strap showing through.
        place(box(0.26, 0.2, 0.045, C.buttercup, 0.02), [0, 0.07, R + 0.01]),
        place(box(0.13, 0.1, 0.06, strap, 0.01), [0, 0.07, R + 0.012]),
      ),
      part(3, place(box(0.07, 0.025, 0.07, C.buttercup, 0.01), [0, 0.07, R + 0.035])),
      part(4, ...[-0.2, -0.14, -0.08].map((x) => place(ellipsoid(0.014, 0.018, 0.01, C.faceInk, 10), [x - 0.12, 0.07, R + 0.018]))),
      part(5, place(box(0.28, 0.1, 0.03, strap, 0.012), [-0.22, 0.07, R + 0.035])),
    ),
    turn: [0.45, 0.35],
    scale: 0.95,
  };
}

/** A desk: a wide top, a stack of drawers with knobs on one side, an open space with legs on the other. */
export function desk(): Drawing {
  const wood = C.shipTrim;
  const side = C.basket;
  return {
    geo: merge(
      part(1, place(box(0.78, 0.045, 0.42, wood, 0.015), [0, 0.37, 0])),
      part(2, place(box(0.26, 0.34, 0.38, side, 0.02), [-0.24, 0.17, 0])),
      part(3,
        ...[0.27, 0.12].map((y) => place(box(0.22, 0.14, 0.02, wood, 0.012), [-0.24, y, 0.19])),
        ...[0.27, 0.12].map((y) => place(ball(0.03, C.trunk, 10), [-0.24, y, 0.215])),
      ),
      part(4, ...[-1, 1].map((k) => place(box(0.05, 0.34, 0.05, side, 0.012), [0.34, 0.17, k * 0.17]))),
      part(5, place(box(0.025, 0.28, 0.36, side, 0.01), [0.375, 0.2, 0])),
    ),
    turn: [0.12, -0.5],
  };
}

/** A mask on a stick: a red half-mask with two eyeholes and a gold edge, a little plume. */
export function mask(): Drawing {
  const outline = new THREE.Shape();
  outline.moveTo(-0.3, 0.1);
  outline.quadraticCurveTo(-0.28, 0.2, -0.12, 0.17);
  outline.quadraticCurveTo(0, 0.12, 0.12, 0.17);
  outline.quadraticCurveTo(0.28, 0.2, 0.3, 0.1);
  outline.quadraticCurveTo(0.28, -0.07, 0.12, -0.06);
  outline.quadraticCurveTo(0.05, -0.06, 0, -0.02);
  outline.quadraticCurveTo(-0.05, -0.06, -0.12, -0.06);
  outline.quadraticCurveTo(-0.28, -0.07, -0.3, 0.1);
  const hole = (k: number) => {
    const h = new THREE.Path();
    h.absellipse(k * 0.14, 0.07, 0.07, 0.042, 0, Math.PI * 2, false, k * -0.2);
    return h;
  };
  outline.holes.push(hole(-1), hole(1));
  const face = paint(new THREE.ExtrudeGeometry(outline, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 24 }), RED);
  return {
    geo: merge(
      part(1, place(face, [0, 0.32, -0.015])),
      part(2, place(capsule(0.02, 0.3, C.cutWood), [0, 0.17, -0.02])),
      part(3, ...[-1, 1].map((k) => place(ball(0.03, C.buttercup, 10), [k * 0.28, 0.45, 0.01]))),
    ),
    turn: [-0.1, 0.35],
  };
}

/** A hand held up, palm toward us, fingers spread, a thumb out to one side and a blue cuff. */
export function hand(): Drawing {
  const skin = C.blush;
  const finger = (x: number, len: number, lean: number) => {
    const base: [number, number, number] = [x, 0.3, 0];
    const tip: [number, number, number] = [x + Math.sin(lean) * len, 0.3 + Math.cos(lean) * len, 0];
    return merge(limb(base, tip, 0.048, skin), ball(0.048, skin, 12).translate(...tip));
  };
  return {
    geo: merge(
      part(1,
        place(ellipsoid(0.17, 0.16, 0.06, skin, 28), [0, 0.28, 0]),
        finger(-0.115, 0.23, -0.22),
        finger(-0.04, 0.28, -0.06),
        finger(0.04, 0.28, 0.06),
        finger(0.115, 0.23, 0.22),
        merge(limb([0.12, 0.2, 0], [0.28, 0.34, 0], 0.06, skin), place(ball(0.06, skin, 12), [0.28, 0.34, 0])),
      ),
      part(2, lathe([[0.14, 0.0], [0.16, 0.0], [0.17, 0.1], [0.16, 0.2], [0.14, 0.27], [0.12, 0.3]], (p) => (p.y > 0.13 && p.y < 0.2 ? CREAM : BLUE), 28, 30)),
    ),
    turn: [0, 0.35],
  };
}
