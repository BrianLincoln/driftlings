import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, merge, paint, place } from '../../gfx/geo';
import { BLUE, RED, ball, box, ground, part, tube, type Drawing } from './parts';

// The sixth batch, the second half: sled, belt, desk, mask, hand.

/** A sled: a low deck of wooden planks on two red runners that curl right up and over at the front, a short rope to pull it by. */
export function sled(): Drawing {
  const runner = (z: number) => tube(
    [[-0.38, 0.07, z], [-0.33, 0.03, z], [0.16, 0.03, z], [0.29, 0.06, z], [0.37, 0.15, z], [0.35, 0.25, z], [0.27, 0.28, z], [0.22, 0.22, z], [0.26, 0.17, z]],
    0.03, RED, 64,
  );
  const wood = C.shipTrim;
  return {
    geo: ground(merge(
      part(2, runner(-0.15), runner(0.15)),
      part(3, ...[-0.24, -0.02, 0.17].flatMap((x) => [-1, 1].map((k) => place(box(0.045, 0.08, 0.04, RED, 0.01), [x, 0.07, k * 0.15])))),
      part(4, ...[-0.115, 0, 0.115].map((z) => place(box(0.58, 0.035, 0.1, wood, 0.012), [-0.06, 0.125, z]))),
      part(5, place(box(0.05, 0.04, 0.38, wood, 0.012), [0.21, 0.13, 0])),
      // A short rope from the far end of the front bar, out to the side and clear of the curls.
      part(6, tube([[0.21, 0.15, -0.19], [0.3, 0.09, -0.26], [0.42, 0.03, -0.32], [0.56, 0.02, -0.32]], 0.024, BLUE)),
    )),
    turn: [0.15, -0.5],
    scale: 0.85,
  };
}

/** A belt laid out nearly straight on the grass: a wide brown strap, a big square steel buckle with its tongue, a keeper loop, a row of holes along the middle. */
export function belt(): Drawing {
  const strap = C.basketDark;
  const L = 0.36;
  const W = 0.12;
  const path = (x: number) => 0.05 * Math.sin(((x + L) / (2 * L)) * Math.PI);
  const n = 30;
  const pieces = Array.from({ length: n }, (_, i) => {
    const x = -L + ((i + 0.5) / n) * 2 * L;
    const slope = Math.atan((path(x + 0.01) - path(x - 0.01)) / 0.02);
    return place(box(((2 * L) / n) * 1.6, 0.03, W, strap, 0.008), [x, 0.015, path(x)], [0, -slope, 0]);
  });
  const frame = (w: number, d: number, t: number) => merge(
    place(box(w, 0.04, t, C.rock, 0.012), [0, 0, -d / 2 + t / 2]),
    place(box(w, 0.04, t, C.rock, 0.012), [0, 0, d / 2 - t / 2]),
    place(box(t, 0.04, d, C.rock, 0.012), [-w / 2 + t / 2, 0, 0]),
    place(box(t, 0.04, d, C.rock, 0.012), [w / 2 - t / 2, 0, 0]),
  );
  const bx = -L - 0.1;
  return {
    // Its far side lifted off the grass, as the map's is, so the strap and the buckle face the camera.
    geo: ground(place(merge(
      part(1, ...pieces, place(box(0.06, 0.03, W, strap, 0.03), [L, 0.015, path(L)])),
      part(2, place(frame(0.24, 0.27, 0.05), [bx, 0.03, path(-L)])),
      part(3, place(box(0.2, 0.03, 0.04, C.rock, 0.015), [bx + 0.01, 0.055, path(-L)])),
      part(4, place(box(0.045, 0.045, W + 0.03, strap, 0.012), [-L + 0.12, 0.022, path(-L + 0.12)])),
      part(5, ...[0.06, 0.12, 0.18, 0.24, 0.3].map((x) => place(ellipsoid(0.02, 0.01, 0.02, C.faceInk, 12), [x, 0.031, path(x)]))),
    ), [0, 0, 0], [0.75, 0, 0])),
    turn: [0, 0.35],
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

/** A mask's band, flat: wide, pointed up at the outer corners, a notch for the nose, two big eyeholes. */
function maskShape(): THREE.Shape {
  const right: Array<[number, number]> = [[0.1, 0.085], [0.2, 0.11], [0.27, 0.14], [0.255, 0.03], [0.2, -0.05], [0.12, -0.09], [0.06, -0.08]];
  const ring = [[0, 0.07] as [number, number], ...right, [0, -0.03] as [number, number], ...right.slice().reverse().map(([x, y]) => [-x, y] as [number, number])];
  const s = new THREE.Shape();
  s.moveTo(...ring[0]);
  s.splineThru([...ring.slice(1), ring[0]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const k of [-1, 1]) {
    const eye = new THREE.Path();
    eye.absellipse(k * 0.11, 0.015, 0.075, 0.052, 0, Math.PI * 2, false, k * 0.15);
    s.holes.push(eye);
  }
  return s;
}

/** The band extruded and curved round, as it would sit on a face: the sides sweep back. */
function maskBand(colour: string): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(maskShape(), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 12 });
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) - 3 * x * x);
    n.fromBufferAttribute(nor, i);
    if (Math.abs(n.z) > 0.5) {
      n.set(6 * x, 0, 1).normalize().multiplyScalar(Math.sign(nor.getZ(i)));
      nor.setXYZ(i, n.x, n.y, n.z);
    }
  }
  return paint(g, colour);
}

/** A superhero's eye mask standing on the grass: one red band with two big eyeholes, its ties running back round to a knot behind. */
export function mask(): Drawing {
  const y = 0.13;
  const tie = (k: number) => tube([[k * 0.255, y + 0.02, -0.2], [k * 0.24, y - 0.03, -0.33], [k * 0.13, 0.04, -0.42], [0, 0.03, -0.44]], 0.022, RED);
  return {
    geo: ground(merge(
      part(1, place(maskBand(RED), [0, y, 0])),
      part(2, tie(-1), tie(1), place(ball(0.04, RED, 12), [0, 0.03, -0.44]),
        tube([[0, 0.03, -0.44], [0.06, 0.02, -0.52], [0.1, 0.02, -0.6]], 0.022, RED),
        tube([[0, 0.03, -0.44], [-0.05, 0.02, -0.53], [-0.04, 0.02, -0.62]], 0.022, RED)),
    )),
    turn: [-0.3, 0.3],
    scale: 1.25,
  };
}

/** A hand laid back on the grass, palm up toward us: a round palm, four fingers fanned apart, a thumb out to one side, a wrist that simply ends. */
export function hand(): Drawing {
  const skin = C.blush;
  const finger = (x: number, len: number, lean: number) =>
    place(capsule(0.047, len, skin), [x + (Math.sin(lean) * len) / 2, 0.08 + (Math.cos(lean) * len) / 2, 0], [0, 0, -lean]);
  const flat = merge(
    ellipsoid(0.16, 0.165, 0.06, skin, 32),
    place(ellipsoid(0.1, 0.1, 0.05, skin, 24), [0, -0.15, 0]),
    finger(-0.11, 0.17, -0.5),
    finger(-0.04, 0.22, -0.17),
    finger(0.04, 0.23, 0.15),
    finger(0.11, 0.19, 0.48),
    place(capsule(0.05, 0.12, skin), [-0.18, 0.0, 0], [0, 0, 0.95]),
  );
  return {
    geo: ground(part(1, place(flat, [0, 0, 0], [-1.2, 0, 0.35]))),
    turn: [0, 0.3],
  };
}
