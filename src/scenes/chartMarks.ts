import * as THREE from 'three';
import { C } from '../gfx/palette';
import { ellipsoid, merge, paint, place } from '../gfx/geo';

// The inked marks on the chart: all lying flat on the sheet, built at the origin.

/** A compass rose: four long points and four short, the one pointing up the sheet in red. */
export function compassGeo(): THREE.BufferGeometry {
  const point = (turn: number, long: number, tone: string) => {
    const g = new THREE.ConeGeometry(long * 0.2, long, 4).toNonIndexed();
    g.translate(0, long / 2, 0).rotateX(-Math.PI / 2).scale(1, 0.12, 1).rotateY(turn);
    g.computeVertexNormals();
    return paint(g, tone);
  };
  return merge(
    ...[0, 1, 2, 3].map((i) => point((i * Math.PI) / 2 + Math.PI / 4, 0.34, C.parchmentEdge)),
    ...[0, 1, 2, 3].map((i) => point((i * Math.PI) / 2, 0.62, i === 0 ? C.pennant : C.ink)),
    place(ellipsoid(0.09, 0.03, 0.09, C.parchment, 12), [0, 0.02, 0]),
  );
}

/** Two or three little humps side by side: the sea, as charts draw it. */
export function wavesGeo(): THREE.BufferGeometry {
  const hump = (x: number, z: number) => {
    const g = new THREE.TorusGeometry(0.13, 0.016, 5, 10, Math.PI).rotateX(-Math.PI / 2).scale(1, 1, 0.6);
    g.computeVertexNormals();
    return place(paint(g, C.ink), [x, 0, z]);
  };
  return merge(hump(-0.27, 0), hump(0, 0), hump(0.2, 0.2));
}

/** The cross that marks where we are going. */
export function crossGeo(): THREE.BufferGeometry {
  const bar = (turn: number) => place(paint(new THREE.BoxGeometry(0.62, 0.03, 0.14), C.pennant), [0, 0, 0], [0, turn, 0]);
  return merge(bar(Math.PI / 4), bar(-Math.PI / 4));
}
