import * as THREE from 'three';
import { C } from '../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../gfx/geo';

// The ship: a stout wooden galleon, built from code like everything else.
// Bow toward +x, keel along x, about 3.4 long before the scene scales it.

export const HALF = 1.7;
const at = (x: number) => (x + HALF) / (HALF * 2); // 0 at the stern, 1 at the bow
const smooth = (k: number) => k * k * (3 - 2 * k);
/** Half the width amidships: broad, so there is a deck to stand about on. */
const BEAM = 0.64;

/** Half the width of the hull at x. */
export function beam(x: number): number {
  const t = at(x);
  if (t < 0.4) return BEAM * (0.8 + 0.2 * smooth(t / 0.4));
  return BEAM * Math.pow(Math.max(0, 1 - Math.pow((t - 0.4) / 0.6, 2.4)), 0.6) + 0.02;
}

/** Height of the rail at x: lowest amidships, sweeping up to bow and stern. */
export function sheer(x: number): number {
  const u = at(x) * 2 - 1;
  return 0.6 + 0.2 * u * u;
}

const keel = (x: number) => {
  const t = at(x);
  return t > 0.7 ? 0.5 * ((t - 0.7) / 0.3) ** 2 : t < 0.15 ? 0.25 * ((0.15 - t) / 0.15) ** 2 : 0;
};

const RAIL = 0.1;
/** Where the foremast stands: at the back of the forecastle, leaving its front clear. */
const FOREMAST = 0.88;
/** The raised decks: where each runs from and to, and how far above the rail it stands. */
const CASTLES = [[-HALF, -0.85, 0.34], [0.8, 1.42, 0.2]];
/** Height of the deck underfoot at x: the main deck, or a castle's. */
export const deckY = (x: number) => {
  const up = CASTLES.find(([from, to]) => x >= from && x <= to);
  return up ? sheer(x) + up[2] - 0.07 : sheer(x) - RAIL;
};

interface Section {
  hw: number;
  top: number;
  bottom: number;
}

type V = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Flat faces, each turned to face the way `out` says. */
function flat(faces: V[][], out: (centre: V) => V, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const n = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (const f of faces) {
    for (const [a, b, d] of f.length === 4 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [f]) {
      n.crossVectors(b.clone().sub(a), d.clone().sub(a)).normalize();
      c.copy(a).add(b).add(d).divideScalar(3);
      const flip = n.dot(out(c)) < 0;
      if (flip) n.negate();
      for (const p of flip ? [a, d, b] : [a, b, d]) {
        pos.push(p.x, p.y, p.z);
        nor.push(n.x, n.y, n.z);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return paint(g, color);
}

/**
 * A length of hull: a U-shaped shell from x0 to x1 with a deck sunk inside its
 * rail. `square` near 0 gives a boxy section, near 1 a round one.
 */
function shell(
  x0: number, x1: number, section: (x: number) => Section, square: number, rail: number,
  skin: (p: V) => THREE.ColorRepresentation, ends: [boolean, boolean],
): THREE.BufferGeometry {
  const N = 26;
  const M = 14;
  const xs = Array.from({ length: N + 1 }, (_, i) => x0 + ((x1 - x0) * i) / N);
  const ring = (x: number): V[] => {
    const s = section(x);
    return Array.from({ length: M + 1 }, (_, j) => {
      const a = (j / M) * Math.PI;
      return v(x, s.top - (s.top - s.bottom) * Math.pow(Math.sin(a), square), s.hw * Math.cos(a));
    });
  };
  const rings = xs.map(ring);
  const pos: number[] = [];
  const idx: number[] = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j;
    const b = a + M + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const skinGeo = new THREE.BufferGeometry();
  skinGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  skinGeo.setIndex(idx);
  skinGeo.computeVertexNormals();
  const parts = [paint(skinGeo, (p) => skin(p))];

  const up = () => v(0, 1, 0);
  const deck: V[][] = [];
  const cap: V[][] = [];
  const inner: V[][] = [];
  const IN = 0.9;
  for (let i = 0; i < N; i++) {
    const [a, b] = [section(xs[i]), section(xs[i + 1])];
    const [xa, xb] = [xs[i], xs[i + 1]];
    deck.push([v(xa, a.top - rail, a.hw * IN), v(xb, b.top - rail, b.hw * IN), v(xb, b.top - rail, -b.hw * IN), v(xa, a.top - rail, -a.hw * IN)]);
    for (const s of [-1, 1]) {
      cap.push([v(xa, a.top, s * a.hw), v(xb, b.top, s * b.hw), v(xb, b.top, s * b.hw * IN), v(xa, a.top, s * a.hw * IN)]);
      inner.push([v(xa, a.top, s * a.hw * IN), v(xb, b.top, s * b.hw * IN), v(xb, b.top - rail, s * b.hw * IN), v(xa, a.top - rail, s * a.hw * IN)]);
    }
  }
  parts.push(flat(deck, up, C.cutWood), flat(cap, up, C.shipTrim), flat(inner, (c) => v(0, 0, -Math.sign(c.z)), C.shipTrim));
  ends.forEach((on, e) => {
    if (!on) return;
    const r = rings[e === 0 ? 0 : N];
    const mid = v(r[0].x, (r[0].y + r[M / 2].y) / 2, 0);
    const fan = r.slice(0, M).map((p, j) => [mid, p, r[j + 1]]);
    fan.push([mid, r[M], r[0]]);
    parts.push(flat(fan, () => v(e === 0 ? -1 : 1, 0, 0), skin(mid)));
  });
  return merge(...parts);
}

function sail(w: number, h: number, belly: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.035, h, w, 1, 8, 10);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const across = Math.cos((pos.getZ(i) / w) * Math.PI);
    const down = 0.5 - pos.getY(i) / h; // 0 at the yard, 1 at the foot
    pos.setX(i, pos.getX(i) + belly * across * (0.35 + 0.65 * Math.sin(down * 2.4)));
  }
  g.computeVertexNormals();
  return paint(g, C.sail);
}

/**
 * A mast at x with square sails braced round to catch the eye as well as the wind. It is a slim
 * pole where it meets the deck, and its lowest sail is set well over the heads of whoever stands there.
 */
function mast(x: number, foot: number, height: number, sails: Array<[number, number, number]>): THREE.BufferGeometry[] {
  const BRACE = -0.42;
  const parts = [place(lathe([[0.04, 0], [0.036, height * 0.6], [0.024, height]], C.trunk, 12, 6), [x, foot, 0])];
  for (const [y, w, h] of sails) {
    parts.push(place(capsule(0.028, w + 0.08, C.trunk), [x + 0.06, foot + y, 0], [Math.PI / 2, 0, -BRACE]));
    parts.push(place(sail(w, h, h * 0.22), [x + 0.09, foot + y - h / 2 - 0.02, 0], [0, BRACE, 0]));
  }
  return parts;
}

/** The planked parts, and everything else (rigging, sails, windows). */
export function shipGeo(): { wood: THREE.BufferGeometry; rig: THREE.BufferGeometry } {
  const hull = shell(-HALF, HALF, (x) => ({ hw: beam(x), top: sheer(x), bottom: keel(x) }), 0.6, RAIL,
    (p) => (p.y > sheer(p.x) - 0.09 ? C.shipTrim : C.shipHull), [true, false]);
  const castle = (x0: number, x1: number, rise: number) =>
    shell(x0, x1, (x) => ({ hw: beam(x) * 1.02, top: sheer(x) + rise, bottom: sheer(x) - 0.2 }), 0.22, 0.07,
      (p) => (p.y > sheer(p.x) + rise - 0.07 ? C.shipTrim : C.shipHull), [true, true]);
  const window = (x: number, y: number, z: number, side: boolean) =>
    place(paint(new THREE.BoxGeometry(side ? 0.13 : 0.03, 0.13, side ? 0.03 : 0.13), C.buttercup), [x, y, z]);
  const lit: THREE.BufferGeometry[] = [];
  for (const x of [-1.45, -1.15]) for (const s of [-1, 1]) lit.push(window(x, sheer(x) + 0.14, s * beam(x) * 1.02, true));
  for (const z of [-0.2, 0, 0.2]) lit.push(window(-HALF * 1.0 - 0.005, sheer(-HALF) + 0.16, z, false));

  const top = 1.8;
  const wood = merge(hull, ...CASTLES.map(([from, to, rise]) => castle(from, to, rise)));
  const rig = merge(
    ...lit,
    ...mast(0.05, deckY(0.05), top, [[1.18, 1.5, 0.62], [1.7, 1.1, 0.44]]),
    ...mast(FOREMAST, deckY(FOREMAST), top * 0.8, [[0.92, 1.1, 0.48], [1.34, 0.8, 0.36]]),
    ...mast(-1.3, deckY(-1.3), top * 0.62, [[0.96, 0.9, 0.5]]),
    place(capsule(0.03, 0.85, C.trunk), [1.9, sheer(HALF) + 0.22, 0], [0, 0, -1.15]),
    place(ellipsoid(0.11, 0.05, 0.11, C.shipTrim, 14), [0.05, deckY(0.05) + top * 0.97, 0]),
    place(paint(new THREE.BoxGeometry(0.36, 0.15, 0.025), C.pennant), [0.25, deckY(0.05) + top + 0.1, 0]),
  );
  return { wood, rig };
}
