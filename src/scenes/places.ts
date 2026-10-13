import type * as THREE from 'three';
import { shoreRadius, type IslandShape } from '../gfx/ground';
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
export const HOME_SHAPE: IslandShape = { radius: 24, rise: 1.0, sand: 1.3, seed: 1.7 };
/**
 * Scenes on the far shore of home (who.ts, landfall.ts, and the landing in homeIsland.ts) were laid out when
 * that shore was about ten units from the middle. Add this to a z from then to get the same spot on the beach now.
 */
export const HOME_BACK = 10.13 - shoreRadius(HOME_SHAPE, Math.PI);
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
  // A steep green knoll, round as a bun and hardly any beach: bushes all over it, and the stones in one line up and over the top.
  i1a3: {
    shape: { radius: 6.9, rise: 0.9, sand: 0.55, seed: 4.4, bays: 0.4 },
    palette: PALETTES.goldenNoon,
    wideZ: [1.1, 0.2, -0.7],
    tallX: [-0.95, -0.2, 0.55],
    bigSide: 1,
    scenery: () => [
      tree(17, [-5.3, -3.4], [-2.7, -4.5]),
      bush(29, [-3.7, -4.4], [-2.5, -2.6]),
      bush(31, [-2.2, -3.2], [2.5, -0.2]),
      bush(43, [-0.4, -4.6], [-2.6, -0.6]),
      bush(55, [2.6, -4.4], [2.6, 1.4]),
      tree(67, [5.7, -3.6], [2.7, 3.0]),
      bush(71, [-4.6, 2.7], [-2.5, 1.4]),
      bush(83, [-1.2, 2.9], [-2.4, 3.2]),
      bush(95, [1.6, 2.6], [2.5, 0.6]),
      bush(97, [4.4, 2.3], [-1.9, -3.7]),
    ],
    far: [[-18, -70, 21], [38, -88, 4]],
    dressing: [
      [0.5, -0.5, 'bush'], [0.62, 0.36, 'bush'], [0.78, 0.55, 'bush'], [0.4, 0.3, 'tree'], [0.8, -0.3, 'bush'], [0.3, -0.2, 'bush'],
      [0.84, 0.06, 'stone'], [0.62, 0.02, 'stone'], [0.4, -0.02, 'stone'],
    ],
    chart: [[-0.55, -0.35, 'tree', 17], [-0.1, -0.66, 'tree', 67], [-0.2, -0.2, 'tree', 29]],
  },
  // A low bar of sand with a thin green middle, in the cool of the morning: a ring of standing boulders, one tree, the stones strung across a shallow bowl.
  i1a4: {
    shape: { radius: 7.6, rise: 0.25, sand: 3.2, seed: 0.9, bays: 1.5 },
    palette: PALETTES.mintMorning,
    wideZ: [1.2, 0.0, -0.3, 0.6],
    tallX: [0.9, -0.5, 0.5, -0.9],
    bigSide: -1,
    scenery: () => [
      rock(11, 1.0, [4.9, -3.4], [-2.8, -4.5]),
      rock(14, 0.8, [3.2, -4.7], [-2.7, -2.5]),
      rock(19, 0.9, [-3.0, -5.2], [-3.0, -0.6]),
      rock(23, 0.7, [5.9, -0.9], [2.7, 1.9]),
      tree(31, [5.4, 1.6], [2.7, 3.5]),
      rock(37, 0.6, [2.4, 3.0], [-2.5, 3.0]),
      rock(41, 0.5, [-0.2, 3.3], [2.5, 0.4]),
      rock(47, 0.85, [-2.8, 3.3], [-2.8, 1.2]),
    ],
    far: [[-40, -85, 7], [8, -100, 15], [34, -74, 2]],
    dressing: [
      [0.7, -0.5, 'rock'], [0.66, 0.5, 'rock'], [0.45, 0.25, 'rock'], [0.5, -0.25, 'tree'], [0.88, 0.3, 'rock'], [0.86, -0.28, 'rock'],
      [0.84, 0.06, 'stone'], [0.66, -0.04, 'stone'], [0.5, 0.1, 'stone'], [0.34, 0.0, 'stone'],
    ],
    chart: [[-0.6, -0.25, 'rock', 11], [0.05, -0.68, 'rock', 14], [-0.3, -0.5, 'tree', 31]],
  },
  // Three green lobes with deep bays between, a copse on one, the stones in a wide zigzag.
  i2a1: {
    shape: { radius: 7.4, rise: 0.55, sand: 1.2, seed: 5.6, bays: 2.6 },
    palette: PALETTES.goldenNoon,
    wideZ: [1.0, -0.4, 0.9, -0.5, 1.0, -0.3],
    tallX: [-0.9, 0.6, -0.6, 0.9, -0.3, 0.7],
    bigSide: 1,
    scenery: () => [
      tree(13, [6.3, -2.2], [-2.7, -4.6]),
      tree(25, [5.4, -3.6], [-2.6, -2.9]),
      tree(37, [4.1, -4.7], [2.7, 3.2]),
      rock(52, 0.7, [-4.6, -3.9], [-2.6, -1.2]),
      rock(58, 0.45, [-3.2, -4.9], [2.5, 0.2]),
      bush(61, [-5.7, -2.2], [2.5, 1.6]),
      bush(73, [-3.2, 2.9], [-2.5, 0.6]),
      rock(77, 0.5, [0.6, 3.1], [-2.4, 2.2]),
      bush(85, [3.6, 2.7], [-2.5, 3.4]),
    ],
    far: [[-28, -82, 10], [30, -96, 18]],
    dressing: [
      [0.6, -0.45, 'tree'], [0.48, -0.3, 'tree'], [0.7, 0.5, 'rock'], [0.5, 0.38, 'bush'], [0.85, -0.2, 'bush'],
      [0.84, 0.06, 'stone'], [0.66, -0.04, 'stone'], [0.5, 0.1, 'stone'], [0.34, 0.0, 'stone'],
    ],
    chart: [[-0.6, -0.3, 'tree', 13], [-0.35, -0.6, 'tree', 25], [0.1, -0.66, 'rock', 52]],
  },
};
