import * as THREE from 'three';
import { C } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { ellipsoid, place } from '../gfx/geo';
import { pushBlob } from '../gfx/uniforms';
import { sfx } from '../audio/sound';
import { Creature } from '../cast/creature';
import { Companion } from '../cast/companion';
import type { Rescue } from '../cast/species';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Diorama } from './diorama';
import { SIZE } from './blockade';
import { createChart, type ChartPlan } from './chart';
import { Lookout } from './lookout';
import { HOME_PALETTE, HOME_SHAPE, type Dress, type Place } from './places';
import { PROP_MAT, buildFarIsles, bushGeo, rockGeo, treeGeo } from './props';
import { Raft } from './raft';
import { BOW, Ship } from './ship';

// A crossing, seen from the water: the ship pulls away from an island with
// everyone aboard, and before it has gone far the chart unrolls in front of it
// (chart.ts) and a toy ship makes the trip there. Home is always off to the
// left and the island being explored off to the right, here and on the chart,
// so the ship sails right to go out and left to come back. Whoever is too big
// for the deck trails behind on the raft.

export type Port = 'home' | 'area';

export interface VoyagePlan {
  /** The island being left. */
  isle: Port;
  /** The island at the far end of this crossing from home. */
  place: Place;
  /** The little ones on deck. */
  crew: Rescue[];
  /** Someone on the raft, if anyone. */
  big: Rescue | null;
  /** What the chart shows of this crossing. Null leaves it rolled up, for a look at the ship alone. */
  chart: ChartPlan | null;
  /** The toy ship on the chart has got there. A tap gets there sooner. */
  done(): void;
}

/** Seconds it takes to gather way, and how far that takes it. */
const UNDER_WAY = 1.8;
const FAR = 9;
/** How long the ship has the picture to itself before the chart unrolls over it. */
const CHART_AT = 0.9;
/** How much of the ship's travel the camera keeps up with. */
const KEEP_UP = 0.9;

/** What stands on the home island, as [how far out (0 to 1), angle round from the mooring, kind]. */
const HOME_DRESSING: Array<[number, number, Dress]> = [
  [0.8, -0.55, 'tree'], [0.7, -0.28, 'tree'], [0.6, 0.02, 'tree'], [0.74, 0.36, 'tree'], [0.46, -0.16, 'tree'],
  [0.44, 0.3, 'tree'], [0.84, 0.72, 'tree'], [0.86, -0.08, 'bush'], [0.82, 0.2, 'bush'], [0.9, -0.36, 'rock'],
];

export function createVoyage(plan: VoyagePlan): Diorama {
  const scene = new THREE.Scene();
  const palette = plan.isle === 'home' ? HOME_PALETTE : plan.place.palette;
  const shape = plan.isle === 'home' ? HOME_SHAPE : plan.place.shape;
  const y = (x: number, z: number) => islandHeight(shape, x, z);
  /** Which way out to sea is: +x from home, -x from the island. */
  const out = plan.isle === 'home' ? 1 : -1;
  const bow = new THREE.Vector3(out, 0, 0);
  /** Where the ship lies when it is at the island: off its near corner, with room astern for the raft. */
  const berth = shape.radius * 0.72 + 4.2;
  scene.add(buildSky(palette), buildWater(palette, shape), buildIsland(shape));
  scene.add(buildFarIsles(palette.water, [[-out * 40, -70, 4], [out * 24, -95, 9], [out * 70, -80, 15]]));

  const prop = PROP_MAT();
  const stoneGeo = place(ellipsoid(0.55, 0.16, 0.55, C.parchment, 20), [0, 0.1, 0]);
  const shadows: Array<[number, number, number, number]> = [];
  (plan.isle === 'home' ? HOME_DRESSING : plan.place.dressing).forEach(([far, round, kind], i) => {
    const a = Math.PI / 4 + round;
    const x = out * Math.sin(a) * far * shape.radius;
    const z = Math.cos(a) * far * shape.radius;
    const geo = kind === 'tree' ? treeGeo(11 + i * 12) : kind === 'bush' ? bushGeo(40 + i * 7) : kind === 'rock' ? rockGeo(60 + i, 0.4) : stoneGeo;
    const m = new THREE.Mesh(geo, prop);
    m.position.set(x, y(x, z) - 0.04, z);
    scene.add(m);
    shadows.push([x, z, kind === 'tree' ? 0.95 : 0.5, kind === 'tree' ? 1.5 : 1.15]);
  });

  const ship = new Ship(plan.big ? new Raft() : null);
  ship.underWay = true;
  scene.add(ship.root);
  if (ship.raft) scene.add(ship.raft.root, ship.raft.rope);
  for (const who of plan.crew) {
    const c = new Creature(who);
    scene.add(c.root);
    ship.seat(c);
  }
  if (plan.big) {
    const c = new Creature(plan.big);
    c.root.scale.multiplyScalar(SIZE);
    scene.add(c.root);
    ship.seat(c, 'raft');
  }
  const companion = new Companion();
  companion.quiet = true;
  scene.add(companion.root);
  // It leads the way: turned to the bow, eyes on where they are going.
  const lookout = new Lookout(0.5, true);
  const chart = plan.chart && createChart(plan.chart);
  let lens: THREE.Camera | null = null;

  let t = 0;
  let told = false;
  const finish = () => {
    if (told) return;
    told = true;
    plan.done();
  };

  /** How far out from its berth the ship is. */
  const reach = () => {
    const k = t / UNDER_WAY;
    return FAR * (k < 1 ? k * k : 2 * k - 1); // gathers way, then holds its speed
  };
  const sail = (settle: boolean) => ship.place(out * (berth + reach()), berth, out > 0 ? 0 : Math.PI, settle);
  sail(true);

  return {
    name: 'voyage',
    palette,
    scene,
    touchables: [],
    reframing: true,
    framing(m: LayoutMode): Framing {
      const center = new THREE.Vector3(out * (berth + reach() * KEEP_UP), 2.0, berth);
      // With a raft in tow the picture is of the pair of them, not of the ship.
      if (ship.raft) center.x -= out * (m === 'tall' ? 1.9 : 1.6);
      return m === 'tall'
        ? { center, width: ship.raft ? 11.4 : 8.0, height: 7.4, elevation: 20, fov: 34 }
        : { center, width: ship.raft ? 13.6 : 11.6, height: 6.8, elevation: 13 };
    },
    layout(m) {
      chart?.layout(m);
    },
    enter(ctx) {
      if (!chart) return;
      // The chart hangs off the camera, so the camera has to be in the scene.
      lens = ctx.camera;
      scene.add(lens);
      lens.add(chart.root);
    },
    exit() {
      if (chart) lens?.remove(chart.root);
      if (lens) scene.remove(lens);
    },
    pointer(phase) {
      if (phase === 'down' && t > 0.5) finish();
    },
    update(dt, camera) {
      if (t === 0 && dt > 0) sfx.whoosh();
      t += dt;
      for (const [x, z, r, stretch] of shadows) pushBlob(x, z, r, stretch);
      sail(false);
      ship.update(dt, camera);
      const at = ship.deck(BOW);
      const deck = at.y;
      companion.groundY = () => deck;
      companion.root.position.x = at.x;
      companion.root.position.z = at.z;
      companion.want.at.set(at.x, 0, at.z);
      companion.want.heading = lookout.yaw(at, bow, camera.position);
      companion.want.glance = lookout.watch(dt, at, bow, camera.position, () => at);
      companion.viewer.copy(camera.position);
      companion.update(dt);

      if (chart && t > CHART_AT && chart.update(dt, camera)) finish();
    },
  };
}
