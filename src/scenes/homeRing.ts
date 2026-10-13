import * as THREE from 'three';
import { shoreRadius } from '../gfx/ground';
import { hash } from '../gfx/geo';
import { HOME_SHAPE } from './places';
import { FLOWER_MAT, PROP_MAT, bushGeo, flowersGeo, rockGeo, treeGeo } from './props';

// The lie of the home island. The camera there always looks the same way, at
// the far shore where the ship is, so the trees stand round that shore and down
// the sides, where they frame whoever is in front of them, and the near side is
// left open: a tree there would stand between the camera and everything.

/** Something standing on the island: its full size, whether it is tall enough to hide what is behind it, and its shadow at full size. */
export interface Standing {
  m: THREE.Object3D;
  size: number;
  tall: boolean;
  blob: Blob;
  shade: number;
}

/** A shadow on the ground: x, z, radius, stretch along the light. */
export type Blob = [number, number, number, number];

const shore = (round: number) => shoreRadius(HOME_SHAPE, Math.PI - round);

/** The spot on the rim `round` from where the ship lies (radians, to the right as we look at it) and `inset` from the water. */
export function ringAt(round: number, inset: number): [number, number] {
  const r = shore(round) - inset;
  return [Math.sin(round) * r, -Math.cos(round) * r];
}

/** The nearest spot to (x, z) that is on the island and at least `margin` from the water. */
export function ashore(x: number, z: number, margin: number): [number, number] {
  const r = Math.hypot(x, z);
  const most = shore(Math.atan2(x, -z)) - margin;
  return r <= most ? [x, z] : [(x / r) * most, (z / r) * most];
}

/** How far round either way the trees go. */
const WOODED = 2.05;

/**
 * Everything that grows and lies about: trees round the far shore, bushes at their feet and all round the rim,
 * bushes and rocks dotted over the middle, and flowers everywhere. Nothing is put down within `clear`
 * ([x, z, radius]). Returns the shadows, and the things themselves.
 */
export function dressHome(scene: THREE.Scene, y: (x: number, z: number) => number, clear: Array<[number, number, number]>): { shadows: Blob[]; standing: Standing[] } {
  const prop = PROP_MAT();
  const shadows: Blob[] = [];
  const standing: Standing[] = [];
  const put = (geo: THREE.BufferGeometry, [x, z]: [number, number], shadow: number, stretch: number, size = 1) => {
    if (clear.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) return;
    const m = new THREE.Mesh(geo, prop);
    m.position.set(x, y(x, z) - 0.04, z);
    m.rotation.y = hash(x * 3.7 + z * 9.1) * 6;
    m.scale.setScalar(size);
    scene.add(m);
    const blob: Blob = [x, z, shadow * size, stretch];
    standing.push({ m, size, tall: shadow > 0.9, blob, shade: blob[2] });
    shadows.push(blob);
  };
  /** `n` of them evenly round the island, each nudged a little, as [round, a number from 0 to 1 that is its own]. */
  const round = (n: number, seed: number) =>
    Array.from({ length: n }, (_, i): [number, number] => [((i + 0.5 + (hash(i * 5.3 + seed) - 0.5) * 0.45) / n - 0.5) * Math.PI * 2, hash(i * 2.9 + seed)]);
  /** `n` spots scattered over the middle, out to `reach` of the way to the shore. */
  const scatter = (n: number, seed: number, reach: number) =>
    Array.from({ length: n }, (_, i) => ringAt(hash(i * 7.3 + seed) * Math.PI * 2, HOME_SHAPE.radius * (1 - reach * Math.sqrt(hash(i * 3.9 + seed * 2)))));

  // A handful of each, turned and sized differently: fifty trees do not need fifty shapes.
  const trees = Array.from({ length: 8 }, (_, i) => treeGeo(11 + i * 12));
  const bushes = Array.from({ length: 5 }, (_, i) => bushGeo(40 + i * 7));
  const rocks = Array.from({ length: 5 }, (_, i) => rockGeo(60 + i, 0.3 + i * 0.06));
  round(62, 1).forEach(([a, k], i) => {
    // A gap here and there, to see the water through.
    if (Math.abs(a) > WOODED || hash(i * 7.9) > 0.88) return;
    put(trees[i % trees.length], ringAt(a, 1.1 + k * 1.6), 0.95, 1.5, 0.92 + hash(i * 1.3) * 0.26);
  });
  round(40, 2).forEach(([a, k], i) => put(bushes[i % bushes.length], ringAt(a, (Math.abs(a) > WOODED ? 2.2 : 3.5) + k * 0.8), 0.55, 1.2));
  round(16, 3).forEach(([a, k], i) => put(rocks[i % rocks.length], ringAt(a, 2.0 + k * 1.4), 0.4, 1.2));
  scatter(26, 4, 0.8).forEach((at, i) => put(bushes[i % bushes.length], at, 0.55, 1.2));
  scatter(22, 5, 0.8).forEach((at, i) => put(rocks[i % rocks.length], at, 0.4, 1.2));

  // Flowers in patches rather than one mesh, so those out of the picture are not drawn.
  const mat = FLOWER_MAT();
  const PATCHES = 16;
  for (let s = 0; s < PATCHES; s++) {
    const spots: Array<[number, number, number]> = [];
    for (let i = 0; i < 34; i++) {
      const a = ((s + hash(s * 13.7 + i * 3.1)) / PATCHES) * Math.PI * 2;
      const [x, z] = ringAt(a, 2 + (HOME_SHAPE.radius - 2) * (1 - Math.sqrt(hash(s * 5.9 + i * 7.7))));
      spots.push([x, y(x, z), z]);
    }
    scene.add(new THREE.Mesh(flowersGeo(spots, 5 + s), mat));
  }
  return { shadows, standing };
}
