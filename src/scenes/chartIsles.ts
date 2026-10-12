import * as THREE from 'three';
import { C } from '../gfx/palette';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../gfx/geo';
import { tickGeo } from './chartMarks';
import type { Place } from './places';
import { rockGeo, treeGeo } from './props';

// The islands as the chart draws them: little flat models lying on the sheet.

/** How far from an island's middle its shore is, at the size the islands are built. */
export const SHORE = 1.25;

const small = (g: THREE.BufferGeometry, k: number, at: [number, number, number]) => place(g.scale(k, k, k), at);

/** An island as the chart draws it: nearly flat, with a wandering shore. `tone` takes how far out a point is, 0 to 1. */
export function drawn(seed: number, tone: (far: number) => THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = lathe([[SHORE, 0], [SHORE * 0.97, 0.035], [SHORE * 0.5, 0.05], [0, 0.055]], (p) => tone(Math.hypot(p.x, p.z) / SHORE), 44, 10);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getX(i), pos.getZ(i));
    const k = 1 + 0.09 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.3);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
  }
  return g;
}
const land = (seed: number) => drawn(seed, (far) => (far > 0.8 ? C.sand : C.grass));

export function homeToy(): THREE.BufferGeometry {
  // Four flat faces, so each side of the roof takes the light its own way.
  const roof = new THREE.ConeGeometry(0.44, 0.5, 4).toNonIndexed();
  roof.computeVertexNormals();
  return merge(
    land(1.7),
    place(paint(new THREE.BoxGeometry(0.5, 0.44, 0.5), C.parchment), [0, 0.27, 0.15], [0, 0.35, 0]),
    place(paint(roof, C.pennant), [0, 0.74, 0.15], [0, Math.PI / 4 + 0.35, 0]),
    small(treeGeo(11), 0.26, [-0.7, 0.04, -0.15]),
    small(treeGeo(35), 0.26, [0.7, 0.04, -0.1]),
    small(treeGeo(23), 0.24, [0.15, 0.04, -0.62]),
  );
}

/** An area's island once it has been found: its stones, its flag, what grows there, and a tick once it is finished. */
export function areaToy(seed: number, marks: Place['chart'], finished: boolean): THREE.BufferGeometry {
  const stone = (x: number, z: number) => place(ellipsoid(0.15, 0.05, 0.15, C.parchment, 14), [x, 0.07, z]);
  return merge(
    land(seed),
    stone(-0.62, 0.3), stone(-0.2, 0.44), stone(0.25, 0.3),
    place(capsule(0.025, 0.62, C.trunk), [0.55, 0.36, 0.0]),
    place(paint(new THREE.BoxGeometry(0.34, 0.2, 0.03), C.pennant), [0.74, 0.6, 0.0]),
    ...marks.map(([x, z, kind, s]) => small(kind === 'tree' ? treeGeo(s) : rockGeo(s, 0.5), kind === 'tree' ? 0.26 : 0.34, [x, 0.04, z])),
    ...(finished ? [place(tickGeo().scale(1.15, 1, 1.15), [0.2, 0.09, -0.16])] : []),
  );
}
