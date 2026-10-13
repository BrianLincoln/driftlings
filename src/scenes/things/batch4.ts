import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { BLUE, CREAM, GREEN, PINK, PURPLE, RED, ball, eyes, leg, part, swing, type Drawing } from './parts';

// The fourth batch: tub, gum, mud, hat, hen, rat, log, lip. Near misses of bat, cat, mat, dog, bud and
// cap, so each has its own outline and its own colours.

const SIDEWAYS: [number, number, number] = [0, 0, Math.PI / 2];

/** Stretch something round along x into an oval, keeping its light smooth. */
function oval(g: THREE.BufferGeometry, k: number): THREE.BufferGeometry {
  g.scale(k, 1, 1);
  const nor = g.getAttribute('normal') as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let i = 0; i < nor.count; i++) {
    n.fromBufferAttribute(nor, i);
    n.x /= k;
    n.normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** A bath tub on four feet, full of water, suds piled at one end and a tap at the other. */
export function tub(): Drawing {
  const metal = C.harebell;
  return {
    geo: merge(
      part(1, ...[-1, 1].flatMap((i) => [-1, 1].map((k) => place(ball(0.06, metal, 12), [i * 0.2, 0.055, k * 0.13])))),
      part(2,
        oval(lathe([[0, 0.07], [0.14, 0.07], [0.2, 0.11], [0.235, 0.22], [0.245, 0.36]], CREAM), 1.5),
        oval(place(paint(new THREE.TorusGeometry(0.245, 0.028, 10, 40), CREAM), [0, 0.36, 0], [Math.PI / 2, 0, 0]), 1.5),
      ),
      part(3, place(ellipsoid(0.35, 0.012, 0.235, BLUE, 28), [0, 0.35, 0])),
      part(4,
        place(ball(0.085, C.foamInk, 14), [-0.2, 0.38, 0.02]),
        place(ball(0.065, C.foamInk, 14), [-0.1, 0.37, -0.08]),
        place(ball(0.06, C.foamInk, 14), [-0.1, 0.37, 0.1]),
        place(ball(0.05, C.foamInk, 14), [-0.24, 0.45, 0]),
      ),
      part(5,
        place(leg(0.04, 0.17, metal), [0.36, 0.36, 0]),
        place(capsule(0.036, 0.08, metal), [0.3, 0.5, 0], SIDEWAYS),
      ),
    ),
    turn: [0.08, 0.45],
    scale: 0.92,
  };
}

const GUMBALLS = [RED, BLUE, GREEN, C.buttercup, PURPLE, PINK];

/** Gum: a gumball machine, a glass globe of coloured balls on a red stand. */
export function gum(): Drawing {
  const mid = 0.43;
  const n = 16;
  // Settled in the bottom of the globe, each showing through the glass without breaking its round outline.
  const balls = Array.from({ length: n }, (_, i) => {
    const y = -0.85 + (1.35 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.4;
    return place(ball(0.078, GUMBALLS[i % GUMBALLS.length], 16), [Math.cos(a) * r * 0.14, mid + y * 0.14, Math.sin(a) * r * 0.14]);
  });
  return {
    geo: merge(
      part(1, lathe([[0, 0], [0.17, 0], [0.19, 0.03], [0.17, 0.09], [0.12, 0.2], [0.13, 0.27]], RED)),
      part(2, place(ball(0.2, C.foamInk, 36), [0, mid, 0]), ...balls),
      part(3, place(ellipsoid(0.1, 0.045, 0.1, RED, 20), [0, mid + 0.2, 0]), place(ball(0.035, RED, 12), [0, mid + 0.26, 0])),
      part(4, place(ellipsoid(0.05, 0.04, 0.03, C.trunk, 14), [0, 0.07, 0.17])),
    ),
    turn: [0.05, -0.35],
    scale: 0.78,
  };
}

/** Mud: a wet brown puddle, shining where the light catches it, a few splashes round it. */
export function mud(): Drawing {
  const blob = (rx: number, rz: number, x: number, z: number, colour: string = C.trunk, h = 0.035) => place(ellipsoid(rx, h, rz, colour, 24), [x, 0, z]);
  const shine = C.basket;
  return {
    geo: place(
      merge(
        part(1,
          blob(0.3, 0.2, 0, 0), blob(0.18, 0.15, 0.22, 0.08), blob(0.16, 0.13, -0.22, -0.08), blob(0.14, 0.1, -0.13, 0.14), blob(0.13, 0.1, 0.16, -0.13),
          // Wet: long pale glints lying on it.
          place(blob(0.15, 0.04, -0.07, -0.08, shine, 0.042), [0, 0, 0], [0, 0.25, 0]),
          place(blob(0.07, 0.03, 0.17, -0.02, shine, 0.042), [0, 0, 0], [0, 0.25, 0]),
          blob(0.09, 0.032, 0.1, 0.12, shine, 0.042),
        ),
        part(1, blob(0.06, 0.045, 0.43, -0.1), blob(0.045, 0.035, -0.4, 0.12), blob(0.04, 0.03, 0.34, 0.24), blob(0.035, 0.03, -0.3, -0.24)),
      ),
      [0, 0.13, 0], [0.5, 0, 0],
    ),
    turn: [0, 0.3],
  };
}

/** A hat: a tall top hat with a band round it, tipped back a little. */
export function hat(): Drawing {
  return {
    geo: place(
      merge(
        part(1, place(ellipsoid(0.31, 0.028, 0.31, PURPLE, 36), [0, 0.028, 0])),
        part(2, lathe(
          [[0.175, 0.03], [0.17, 0.2], [0.195, 0.43], [0.18, 0.46], [0, 0.465]],
          (p) => (p.y > 0.06 && p.y < 0.15 ? CREAM : PURPLE), 48, 70,
        )),
      ),
      [0, 0.03, 0], [0, 0, -0.12],
    ),
    turn: [0.2, -0.4],
    scale: 0.95,
  };
}

/** A hen: plump and white, a red comb and wattle, a beak, a tail standing up behind. */
export function hen(): Drawing {
  const head: [number, number, number] = [0, 0.42, 0.03];
  const feather = (y: number, z: number, lean: number) => place(ellipsoid(0.04, 0.11, 0.05, CREAM, 14), [0, y, z], [lean, 0, 0]);
  return {
    geo: merge(
      swing(merge(
        part(1, ...[-1, 1].flatMap((k) => [
          place(leg(0.03, 0.12, C.amber), [k * 0.095, 0, -0.16]),
          place(ellipsoid(0.045, 0.02, 0.06, C.amber, 12), [k * 0.095, 0.02, -0.13]),
        ])),
        part(2, place(ellipsoid(0.18, 0.17, 0.24, CREAM, 36), [0, 0.25, -0.19])),
        part(3, feather(0.44, -0.4, -0.5), feather(0.4, -0.45, -0.9), feather(0.34, -0.47, -1.3)),
        part(4, ...[-1, 1].map((k) => place(ellipsoid(0.03, 0.09, 0.13, C.parchmentEdge, 16), [k * 0.17, 0.25, -0.2], [-0.25, 0, 0]))),
      ), 0.8),
      part(5, place(ellipsoid(0.15, 0.145, 0.14, CREAM, 40), head)),
      part(6,
        place(ball(0.05, RED, 12), [0, 0.57, 0.07]),
        place(ball(0.058, RED, 12), [0, 0.59, 0]),
        place(ball(0.046, RED, 12), [0, 0.56, -0.07]),
        place(ellipsoid(0.028, 0.045, 0.025, RED, 12), [0, 0.31, 0.135]),
      ),
      part(7, place(paint(new THREE.ConeGeometry(0.05, 0.1, 16), C.amber), [0, 0.375, 0.2], [Math.PI / 2, 0, 0])),
    ),
    face: eyes(head, [0.52, 0.22], 1.05),
    turn: [0, 0.3],
    scale: 0.88,
  };
}

/** A rat: low and grey on four short legs, big round ears, a pointed nose and a long pink tail. */
export function rat(): Drawing {
  const head: [number, number, number] = [0, 0.33, 0.02];
  const fur = C.rock;
  const R = 0.22;
  const thick = 0.026;
  const arc = 2.9;
  const tail = merge(
    place(paint(new THREE.TorusGeometry(R, thick, 10, 28, arc), C.blush), [R, thick, 0], [-Math.PI / 2, Math.PI, 0]),
    place(ball(thick * 1.1, C.blush, 10), [R - R * Math.cos(arc), thick, -R * Math.sin(arc)]),
  );
  return {
    geo: merge(
      swing(merge(
        part(1, place(ellipsoid(0.15, 0.14, 0.24, fur), [0, 0.2, -0.22])),
        part(2, ...[-1, 1].flatMap((k) => [-0.07, -0.36].map((z) => place(leg(0.05, 0.12, fur), [k * 0.09, 0, z])))),
        part(3, place(tail, [0, 0, -0.42])),
      ), -0.75),
      part(4, place(ellipsoid(0.165, 0.145, 0.15, fur, 40), head)),
      part(5, ...[-1, 1].map((k) => place(merge(
        ellipsoid(0.082, 0.082, 0.025, fur, 20),
        place(ellipsoid(0.052, 0.052, 0.012, C.blush, 16), [0, 0, 0.018]),
      ), [k * 0.15, 0.455, -0.03], [0, k * 0.3, -k * 0.25]))),
      part(6,
        place(ellipsoid(0.066, 0.055, 0.17, CREAM, 20), [0, 0.285, 0.13]),
        place(ball(0.028, PINK, 12), [0, 0.3, 0.297]),
      ),
    ),
    face: eyes(head, [0.5, 0.28], 1.05, [-0.42, 0.06]),
    turn: [0, -0.3],
  };
}

/** A log lying on the grass: bark, a pale cut end with a ring in it, the stump of a branch. */
export function log(): Drawing {
  /** The cut face of a log of radius `r`, looking along +y. */
  const cut = (r: number) => merge(
    ellipsoid(r, 0.012, r, C.cutWood, 28),
    ...(r > 0.1 ? [ellipsoid(r * 0.62, 0.016, r * 0.62, C.basket, 24), ellipsoid(r * 0.42, 0.02, r * 0.42, C.cutWood, 20), ellipsoid(r * 0.14, 0.024, r * 0.14, C.basket, 12)] : []),
  );
  const bark = C.trunk;
  return {
    geo: merge(
      place(merge(
        part(1, paint(new THREE.CylinderGeometry(0.17, 0.17, 0.66, 36), bark)),
        part(2, place(cut(0.15), [0, 0.33, 0]), place(cut(0.15), [0, -0.33, 0], [Math.PI, 0, 0])),
      ), [0, 0.17, 0], [0, 0, -Math.PI / 2]),
      part(3, place(paint(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 20), bark), [-0.12, 0.36, 0], [0, 0, 0.35])),
      part(4, place(cut(0.05), [-0.144, 0.426, 0], [0, 0, 0.35])),
    ),
    turn: [0, -0.55],
  };
}

/** Lips: a red mouth, shut and smiling, standing on the grass like a sweet. */
export function lip(): Drawing {
  const solid = (s: THREE.Shape) => paint(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.012, bevelSegments: 4, curveSegments: 24 }), RED);
  const upper = new THREE.Shape();
  upper.moveTo(-0.33, 0.21);
  upper.quadraticCurveTo(-0.2, 0.36, -0.09, 0.35);
  upper.quadraticCurveTo(-0.03, 0.34, 0, 0.3);
  upper.quadraticCurveTo(0.03, 0.34, 0.09, 0.35);
  upper.quadraticCurveTo(0.2, 0.36, 0.33, 0.21);
  upper.quadraticCurveTo(0, 0.13, -0.33, 0.21);
  const lower = new THREE.Shape();
  lower.moveTo(-0.33, 0.21);
  lower.quadraticCurveTo(0, 0.13, 0.33, 0.21);
  lower.quadraticCurveTo(0.2, 0.03, 0, 0.035);
  lower.quadraticCurveTo(-0.2, 0.03, -0.33, 0.21);
  return {
    geo: place(merge(part(1, solid(lower), place(ellipsoid(0.075, 0.02, 0.012, C.blush, 16), [-0.11, 0.105, 0.094], [0, 0, -0.2])), part(2, solid(upper))), [0, 0, 0], [-0.25, 0, 0]),
    turn: [0, 0.35],
    scale: 0.95,
  };
}
