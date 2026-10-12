import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { C } from '../gfx/palette';
import { TAG } from '../gfx/glsl';
import { ellipsoid, hash, lathe, merge, paint, place, puff } from '../gfx/geo';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';

// Scenery recipes. Each returns merged geometry: one draw call per prop.

export function treeGeo(seed: number): THREE.BufferGeometry {
  const h = 1.15 + hash(seed) * 0.5;
  const tone = hash(seed + 5) > 0.5 ? C.foliage : C.foliageLight;
  const lean = (hash(seed + 9) - 0.5) * 0.3;
  return merge(
    lathe([[0.17, 0], [0.11, 0.35], [0.09, h + 0.3]], C.trunk, 14, 8),
    place(puff(0.78, tone, seed), [lean, h + 0.55, 0]),
    place(puff(0.52, tone, seed + 1), [lean - 0.55, h + 0.2, 0.12]),
    place(puff(0.56, tone, seed + 2), [lean + 0.55, h + 0.28, -0.05]),
    place(puff(0.46, tone, seed + 3), [lean + 0.1, h + 1.1, 0]),
  );
}

export function bushGeo(seed: number): THREE.BufferGeometry {
  return merge(
    place(puff(0.42, C.bush, seed), [0, 0.26, 0]),
    place(puff(0.3, C.bush, seed + 1), [0.36, 0.18, 0.05]),
    place(puff(0.26, C.bush, seed + 2), [-0.34, 0.16, 0.08]),
  );
}

export function rockGeo(seed: number, size = 0.4): THREE.BufferGeometry {
  const g = puff(size, hash(seed) > 0.5 ? C.rock : C.rockDark, seed, 0.22, 18);
  g.scale(1, 0.62, 0.85);
  return place(g, [0, size * 0.3, 0]);
}

/** A scatter of tiny flowers lying on the ground, merged into one mesh. */
export function flowersGeo(spots: Array<[number, number, number]>, seed: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  spots.forEach(([x, y, z], i) => {
    const col = [C.flower, C.buttercup, C.harebell][Math.floor(hash(seed + i) * 3)];
    const s = 0.085 + hash(seed + i * 3) * 0.035; // big enough that the ink line does not swallow them
    parts.push(place(ellipsoid(s, s * 0.45, s, col, 10), [x, y + 0.035, z]));
    parts.push(place(ellipsoid(s * 0.4, s * 0.4, s * 0.4, C.buttercup, 8), [x, y + 0.05, z]));
  });
  return merge(...parts);
}

export const PROP_MAT = () => toonMaterial({ tag: TAG.prop });
export const FLOWER_MAT = () => toonMaterial({ tag: TAG.prop, flag: -0.7 });

// ---------------------------------------------------------------------------
// Letter tile: the one rule for "this is a letter / this can be touched".
// A parchment slab with an ink ring, exempt from the scene's grade so it stays
// the brightest, cleanest thing in a deliberately muted frame. The glyph itself
// is a DOM element pinned to `anchor` (see stage/glyphs.ts).
// ---------------------------------------------------------------------------

export const TILE = { width: 0.92, height: 1.02, depth: 0.16 };

export interface Tile {
  root: THREE.Group;
  /** The "touch this now" signal: a glowing gold rim behind the slab. */
  halo: THREE.Mesh;
  /** Squash pivot, at the tile's foot. */
  slab: THREE.Group;
  anchor: THREE.Object3D;
  mat: ToonMaterial;
}

let tileGeo: THREE.BufferGeometry | null = null;
let footGeo: THREE.BufferGeometry | null = null;
let haloGeo: THREE.BufferGeometry | null = null;

export function buildTile(): Tile {
  tileGeo ??= place(
    paint(new RoundedBoxGeometry(TILE.width, TILE.height, TILE.depth, 5, 0.075), (_p, n) =>
      n.z > 0.5 ? C.parchment : C.parchmentEdge),
    [0, TILE.height / 2, 0],
  );
  footGeo ??= rockGeo(3, 0.34);
  const root = new THREE.Group();
  const slab = new THREE.Group();
  const mat = toonMaterial({ tag: TAG.tile, flag: -0.92 });
  slab.add(new THREE.Mesh(tileGeo, mat));
  slab.position.set(0, 0.12, 0);
  slab.rotation.x = -0.1;
  const foot = new THREE.Mesh(footGeo, PROP_MAT());
  foot.scale.set(1.5, 0.7, 0.9);
  foot.position.set(0, -0.05, -0.02);
  haloGeo ??= place(
    paint(new RoundedBoxGeometry(TILE.width + 0.1, TILE.height + 0.1, TILE.depth * 0.55, 5, 0.085), C.glow),
    [0, TILE.height / 2, 0],
  );
  const halo = new THREE.Mesh(haloGeo, toonMaterial({ tag: TAG.tile, unlit: 1, flag: 0.3 }));
  halo.visible = false;
  slab.add(halo);
  const anchor = new THREE.Object3D();
  anchor.position.set(0, TILE.height * 0.5, TILE.depth / 2);
  slab.add(anchor);
  root.add(foot, slab);
  return { root, slab, halo, anchor, mat };
}

/** A far-off island: one flat pale tone, so distance reads as layers, not fog. */
export function farIsleGeo(seed: number, tone: string): THREE.BufferGeometry {
  const w = 5 + hash(seed) * 5;
  const parts = [place(ellipsoid(w, 1.1 + hash(seed + 1), 3, tone, 20), [0, -0.2, 0])];
  const n = 2 + Math.floor(hash(seed + 2) * 3);
  for (let i = 0; i < n; i++) {
    const x = (hash(seed + 3 + i) - 0.5) * w * 1.2;
    parts.push(place(puff(1.0 + hash(seed + 9 + i) * 0.8, tone, seed + i, 0.12, 16), [x, 1.5 + hash(seed + i) * 0.6, 0]));
  }
  return merge(...parts);
}

export function buildFarIsles(water: string, seeds: Array<[number, number, number]>): THREE.Group {
  const g = new THREE.Group();
  const tone = '#' + new THREE.Color(water).lerp(new THREE.Color(C.foliage), 0.3).getHexString();
  const mat = toonMaterial({ tag: TAG.prop, unlit: 1, flag: -0.3 });
  for (const [x, z, seed] of seeds) {
    const m = new THREE.Mesh(farIsleGeo(seed, tone), mat);
    m.position.set(x, -0.2, z);
    g.add(m);
  }
  return g;
}
