import type * as THREE from 'three';
import type { IslandShape } from '../gfx/ground';
import { PALETTES, type ScenePalette } from '../gfx/palette';
import { bushGeo, rockGeo, treeGeo } from './props';

// What makes each area its own place: the island's outline, the light, what
// grows and lies about on it, and how the stones wander across it. Everything
// here is data for scenes that already exist (areaMap.ts, voyage.ts, chart.ts);
// a new area is a new entry and nothing else.

export type Dress = 'tree' | 'bush' | 'rock' | 'stone';

/** Something standing on the area map: where in a wide and a tall layout, and how much room it takes. */
export interface MapProp {
  geo: THREE.BufferGeometry;
  wide: [number, number];
  tall: [number, number];
  r: number;
}

export interface Place {
  shape: IslandShape;
  palette: ScenePalette;
  /** The stepping stones' path: how far toward the viewer each sits on a wide screen, and how far to the side on a tall one. */
  wideZ: number[];
  tallX: number[];
  /**
   * Which side the big one keeps to on a wide screen until the end: 1 is the right. On a tall one it is always
   * to the right of the plank, where there is room. Keep those corners clear of scenery.
   */
  bigSide: 1 | -1;
  scenery(): MapProp[];
  /** Far-off islands behind the map, as [x, z, seed]. */
  far: Array<[number, number, number]>;
  /** What stands on it seen from the water, as [how far out (0 to 1), angle round from the mooring, kind]. */
  dressing: Array<[number, number, Dress]>;
  /** What is drawn on its island on the chart, as [x, z, kind, seed], on an island about 1.25 across. */
  chart: Array<[number, number, 'tree' | 'rock', number]>;
}

const tree = (seed: number, wide: [number, number], tall: [number, number]): MapProp => ({ geo: treeGeo(seed), wide, tall, r: 0.95 });
const bush = (seed: number, wide: [number, number], tall: [number, number]): MapProp => ({ geo: bushGeo(seed), wide, tall, r: 0.55 });
const rock = (seed: number, size: number, wide: [number, number], tall: [number, number]): MapProp =>
  ({ geo: rockGeo(seed, size), wide, tall, r: size + 0.05 });

/** Home has no map of its own, but the crossing and the chart need to know it. */
export const HOME_SHAPE: IslandShape = { radius: 10.5, rise: 0.7, sand: 1.3, seed: 1.7 };
export const HOME_PALETTE: ScenePalette = PALETTES.goldenNoon;

export const PLACES: Record<string, Place> = {
  // A round, grassy island under a warm noon: trees along the back, the stones in a gentle zigzag.
  i1a1: {
    shape: { radius: 7.2, rise: 0.4, sand: 1.0, seed: 2.6 },
    palette: PALETTES.goldenNoon,
    wideZ: [0.9, -0.5, 0.7, -0.6, 0.6, -0.9],
    tallX: [-0.95, 0.85, -0.95, 0.85, -0.7, 0.35],
    bigSide: 1,
    scenery: () => [
      tree(15, [-5.2, -3.2], [-2.6, -4.6]),
      tree(27, [-3.9, -4.5], [2.5, -2.2]),
      tree(39, [3.4, -3.9], [-2.7, 0.4]),
      tree(51, [5.6, -3.0], [2.6, 2.6]),
      bush(63, [-3.4, 2.6], [2.4, 0.2]),
      bush(75, [3.8, 2.4], [-2.5, -2.2]),
      rock(87, 0.4, [0.4, 2.9], [-2.4, 2.9]),
    ],
    far: [[-30, -75, 5], [26, -95, 9]],
    dressing: [
      [0.62, -0.42, 'tree'], [0.52, 0.4, 'tree'], [0.8, 0.5, 'bush'], [0.86, -0.2, 'rock'],
      [0.84, 0.06, 'stone'], [0.66, -0.04, 'stone'], [0.5, 0.1, 'stone'], [0.34, 0.0, 'stone'],
    ],
    chart: [[-0.5, -0.45, 'tree', 15], [0.1, -0.62, 'tree', 39]],
  },
  // A rocky cove in the cool of the morning: deep bays, a wide beach, boulders, hardly a tree, the stones in a long curve.
  i1a2: {
    shape: { radius: 7.3, rise: 0.6, sand: 1.7, seed: 3.0, bays: 2.1 },
    palette: PALETTES.mintMorning,
    wideZ: [0.8, -0.4, 0.8, -0.5, 0.2],
    tallX: [0.9, -0.9, 0.9, -0.9, 0.5],
    bigSide: -1,
    scenery: () => [
      rock(21, 0.85, [4.6, -3.6], [-2.7, -4.3]),
      rock(22, 0.55, [3.1, -4.6], [2.7, -1.6]),
      tree(43, [5.5, -2.3], [2.7, 2.4]),
      rock(33, 0.7, [-3.4, -5.0], [-2.6, -1.3]),
      rock(38, 0.5, [1.3, 3.0], [-2.5, 1.1]),
      rock(46, 0.4, [-1.7, 2.9], [2.4, 0.5]),
      bush(81, [4.3, 2.4], [-2.4, 3.1]),
      rock(57, 0.6, [-3.9, 3.2], [2.5, -2.9]),
    ],
    far: [[-36, -90, 12], [12, -78, 6], [44, -105, 17]],
    dressing: [
      [0.6, -0.4, 'rock'], [0.5, 0.42, 'tree'], [0.8, 0.5, 'rock'], [0.86, -0.2, 'rock'], [0.72, 0.22, 'rock'],
      [0.84, 0.06, 'stone'], [0.66, -0.04, 'stone'], [0.5, 0.1, 'stone'], [0.34, 0.0, 'stone'],
    ],
    chart: [[-0.62, -0.3, 'rock', 21], [-0.25, -0.62, 'rock', 33], [-0.3, -0.2, 'rock', 46]],
  },
};
