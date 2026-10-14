import * as THREE from 'three';
import { C } from '../../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../../gfx/geo';
import { CREAM, GREEN, PURPLE, RED, ball, eyes, limb, part, type Drawing } from './parts';

// The sixth batch, the first half: frog, crab, drum, flag, plum. Words with two consonants together.

/**
 * A frog's foot lying flat on the ground: `n` thin toes fanned out over `spread` radians, pointing down +z,
 * each ending in a round pad, with webbing between them scalloped back between the toes.
 */
function webFoot(len: number, n: number, spread: number, pad: number, skin: string): THREE.BufferGeometry {
  const angle = (i: number) => -spread / 2 + (i * spread) / (n - 1);
  const along = (a: number, d: number) => new THREE.Vector2(Math.sin(a) * d, Math.cos(a) * d);
  const web = new THREE.Shape();
  web.moveTo(0, 0);
  for (let i = 0; i < n; i++) {
    const tip = along(angle(i), len * 0.72);
    if (i === 0) web.lineTo(tip.x, tip.y);
    else {
      const dip = along((angle(i - 1) + angle(i)) / 2, len * 0.38);
      web.quadraticCurveTo(dip.x, dip.y, tip.x, tip.y);
    }
  }
  web.lineTo(0, 0);
  const flat = place(paint(new THREE.ExtrudeGeometry(web, { depth: 0.01, bevelEnabled: false, curveSegments: 8 }), skin), [0, 0.022, 0], [Math.PI / 2, 0, 0]);
  return merge(
    flat,
    ...Array.from({ length: n }, (_, i) => {
      const end = along(angle(i), len);
      return merge(
        limb([0, 0.016, 0], [end.x, 0.016, end.y], 0.016, skin),
        place(ellipsoid(pad, 0.018, pad, skin, 14), [end.x, 0.018, end.y]),
      );
    }),
    ellipsoid(0.035, 0.022, 0.035, skin, 14).translate(0, 0.02, 0),
  );
}

/** A frog crouching: green, a wide pale-bellied head with two small bumps and calm eyes, great folded back legs, webbed feet with toe pads. */
export function frog(): Drawing {
  const skin = GREEN;
  const head: [number, number, number] = [0, 0.3, 0.13];
  const bump = (k: number): [number, number, number] => [k * 0.1, 0.4, 0.1];
  return {
    geo: merge(
      part(1, place(ellipsoid(0.24, 0.2, 0.28, skin), [0, 0.2, -0.1])),
      part(2, place(ellipsoid(0.15, 0.12, 0.1, C.flower, 20), [0, 0.12, 0.1])),
      // The back legs folded: a big thigh, a shin lying low along the ground, and a long webbed foot pointing forward and out.
      part(3, ...[-1, 1].flatMap((k) => [
        place(ellipsoid(0.07, 0.15, 0.17, skin, 22), [k * 0.22, 0.17, -0.12], [0, 0, k * 0.2]),
        limb([k * 0.25, 0.06, -0.17], [k * 0.29, 0.035, 0.03], 0.04, skin),
        place(webFoot(0.13, 4, 1.0, 0.026, skin), [k * 0.3, 0, 0.04], [0, k * 0.55, 0]),
      ])),
      // Short arms from the chest down to small splayed feet.
      part(3, ...[-1, 1].flatMap((k) => [
        limb([k * 0.13, 0.2, 0.06], [k * 0.15, 0.04, 0.21], 0.045, skin),
        place(webFoot(0.075, 4, 1.4, 0.02, skin), [k * 0.155, 0, 0.22], [0, k * 0.35, 0]),
      ])),
      part(4, place(ellipsoid(0.21, 0.15, 0.17, skin, 40), head)),
      part(4, ...[-1, 1].map((k) => place(ball(0.075, skin, 22), bump(k)))),
    ),
    face: eyes(head, [0.45, 0.25], 1.05, [-0.42, 0.12]),
    turn: [0.1, -0.4],
    scale: 0.95,
  };
}

/**
 * One finger of a crab's claw: a cone standing on its base, flattened front to back, its tip darker and bent over
 * sideways by `bend`, so that it tapers sharply to a point.
 */
function pincer(r: number, h: number, bend: number, shell: string, tip: string): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, 16, 10).translate(0, h / 2, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / h;
    pos.setX(i, pos.getX(i) + bend * t * t);
    pos.setZ(i, pos.getZ(i) * 0.7);
  }
  g.computeVertexNormals();
  return paint(g, (p) => (p.y > h * 0.55 ? tip : shell));
}

/** A crab: red, wide, two big claws held up (each a broad swollen palm and two short pointed fingers), legs out to each side. */
export function crab(): Drawing {
  const shell = RED;
  const tip = C.shipHull;
  const claw = (k: number) => merge(
    part(3,
      limb([k * 0.22, 0.16, 0.12], [k * 0.34, 0.22, 0.2], 0.05, shell),
      limb([k * 0.34, 0.22, 0.2], [k * 0.37, 0.4, 0.3], 0.05, shell),
    ),
    // The palm and the fixed finger, outside, are one piece; the movable finger, inside, is hinged on. Built round the
    // middle of the palm, then tipped forward and in, so the fingers reach toward us and each other and not up like horns.
    place(merge(
      part(4,
        place(ellipsoid(0.14, 0.14, 0.075, shell, 28), [0, 0, 0], [0, 0, k * -0.15]),
        place(pincer(0.068, 0.21, k * -0.08, shell, tip), [k * 0.07, 0.08, 0], [0, 0, k * -0.12]),
      ),
      part(5, place(pincer(0.052, 0.18, k * 0.08, shell, tip), [k * -0.06, 0.1, 0], [0, 0, k * 0.35])),
    ), [k * 0.38, 0.5, 0.32], [0.2, 0, k * 0.2]),
  );
  // Four bent legs a side, splayed wide, each tapering to a point on the ground.
  const legs = [-1, 1].flatMap((k) => [-0.15, -0.05, 0.05, 0.15].map((z) => merge(
    limb([k * 0.2, 0.15, z * 0.8], [k * 0.38, 0.2, z * 1.3], 0.03, shell),
    limb([k * 0.38, 0.2, z * 1.3], [k * 0.47, 0.015, z * 1.8], 0.022, shell),
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
