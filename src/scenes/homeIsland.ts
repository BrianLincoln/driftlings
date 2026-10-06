import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { hash } from '../gfx/geo';
import { pushBlob } from '../gfx/uniforms';
import { sfx } from '../audio/sound';
import { Creature } from '../cast/creature';
import { rescue, type Rescue } from '../cast/species';
import { Companion } from '../cast/companion';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';
import type { Diorama } from './diorama';
import { SIZE } from './blockade';
import { Ship } from './ship';
import { FLOWER_MAT, PROP_MAT, buildFarIsles, bushGeo, flowersGeo, rockGeo, treeGeo } from './props';

// The home island: no teaching job. It starts empty and fills with the
// creatures the child has rescued, who mill about and react when tapped.
// It is wider than the screen; a sideways drag pans it. The ship lies off the
// far shore, bow on, in a gap in the trees: whoever it has just brought home
// (landfall.ts shows them getting off) comes up from the sand in front of it,
// and whoever is still waiting to go back out stays on deck.

export interface HomePlan {
  /** Rescue numbers living here, in the order they came. */
  residents: number[];
  /** How many of them have been here before. The rest hop in from the shore now. */
  welcomed: number;
  onWelcomed(count: number): void;
  /** Little ones waiting on the ship's deck: woken, but their island is not finished with. */
  aboard: Rescue[];
  /** The big ones that live here. */
  big: Rescue[];
}

export const HOME_SHAPE: IslandShape = { radius: 10.5, rise: 0.7, sand: 1.3, seed: 1.7 };
/** The band of the island the camera looks at, and creatures live in. */
const LIVE = { halfWidth: 7.6, zBack: -6.2, zFront: 0.6 };
const CENTER_Z = -2.6;
/** Where the ship lies, and the tree that would stand in front of it. */
const SHIP = { x: 2.8, z: -14.9, gap: 5 };
/** Where the big ones settle: at the back, to the ship's side of the island. */
const BIG_AT: Array<[number, number]> = [[5.6, -6.7], [-5.8, -6.9], [0.4, -7.2]];

export function createHomeIsland(plan: HomePlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.goldenNoon;
  const y = (x: number, z: number) => islandHeight(HOME_SHAPE, x, z);
  const prop = PROP_MAT();
  const shadows: Array<[number, number, number, number]> = [];

  scene.add(buildSky(palette), buildWater(palette, HOME_SHAPE), buildIsland(HOME_SHAPE));
  scene.add(buildFarIsles(palette.water, [[-34, -80, 3], [20, -110, 8], [58, -72, 14], [-70, -95, 19]]));

  const put = (geo: THREE.BufferGeometry, x: number, z: number, shadow: number, stretch: number, turn = 0) => {
    const m = new THREE.Mesh(geo, prop);
    m.position.set(x, y(x, z) - 0.04, z);
    m.rotation.y = turn;
    scene.add(m);
    shadows.push([x, z, shadow, stretch]);
  };
  // Trees stand along the back so they frame the creatures and never hide them.
  for (let i = 0; i < 9; i++) {
    if (i === SHIP.gap) continue;
    const x = -8.4 + i * 2.1 + (hash(i * 5.3) - 0.5) * 0.9;
    const z = -7.4 - hash(i * 2.9) * 1.6 + Math.abs(x) * 0.12;
    put(treeGeo(11 + i * 12), x, z, 0.95, 1.5, hash(i) * 6);
  }
  for (let i = 0; i < 10; i++) {
    const x = (hash(i * 9.1 + 2) - 0.5) * 17;
    const z = i % 2 ? -6.6 + hash(i * 3.3) * 0.8 : 1.6 + hash(i * 4.1) * 1.2;
    put(bushGeo(40 + i * 7), x, z, 0.55, 1.2);
  }
  for (let i = 0; i < 7; i++) {
    const x = (hash(i * 6.7 + 4) - 0.5) * 16;
    const z = 1.2 + hash(i * 8.3) * 2.2;
    put(rockGeo(60 + i, 0.3 + hash(i * 1.9) * 0.25), x, z, 0.4, 1.2);
  }
  const spots: Array<[number, number, number]> = [];
  for (let i = 0; i < 90; i++) {
    const x = (hash(i * 3.1) - 0.5) * 17;
    const z = -6.5 + hash(i * 7.7) * 9;
    spots.push([x, y(x, z), z]);
  }
  scene.add(new THREE.Mesh(flowersGeo(spots, 5), FLOWER_MAT()));

  const ship = new Ship();
  scene.add(ship.root);
  const waiting = plan.aboard.map((who) => new Creature(who));
  /** Whoever the ship is looking after for now: the scene leaves them to it. */
  const onShip = new Set<Creature>();

  // Residents on a loose grid, each with a small patch of its own to wander.
  const creatures: Creature[] = [];
  const cols = 8;
  const arrivals: Array<{ c: Creature; at: number; x: number; z: number }> = [];
  plan.residents.forEach((who, i) => {
    const c = new Creature(rescue(who));
    // Fill from the middle outward, so the first arrivals are in view without panning.
    const col = [3, 4, 2, 5, 1, 6, 0, 7][i % cols];
    const row = Math.floor(i / cols);
    const hx = -LIVE.halfWidth + ((col + 0.5 + (row % 2) * 0.35) / cols) * LIVE.halfWidth * 2 + (hash(i * 4.4) - 0.5) * 0.6;
    const hz = LIVE.zBack + 0.8 + row * 2.3 + (hash(i * 6.1) - 0.5) * 0.7;
    c.groundY = y;
    c.home.set(hx, 0, hz);
    if (i < plan.welcomed) {
      c.wanderRadius = 0.85;
      c.place(hx, hz, (hash(i * 2.2) - 0.5) * 1.4);
    } else {
      // A new arrival, just off the ship: it waits on the sand in front of it, and they come up one after another.
      const n = i - plan.welcomed;
      c.place(SHIP.x - 1.6 + (n % 4) * 0.8, -8.9 + (n % 2) * 0.5, 0);
      arrivals.push({ c, at: 0.8 + n * 0.55, x: hx, z: hz });
    }
    scene.add(c.root);
    creatures.push(c);
  });
  for (const c of waiting) {
    ship.seat(c);
    onShip.add(c);
    scene.add(c.root);
  }
  // The big ones. One that has only just come home stands on the sand with the rest, and is the last to come up.
  const fresh = plan.welcomed < plan.residents.length;
  plan.big.forEach((who, i) => {
    const c = new Creature(who);
    c.root.scale.multiplyScalar(SIZE);
    const [bx, bz] = BIG_AT[i % BIG_AT.length];
    c.groundY = y;
    c.home.set(bx, 0, bz);
    if (fresh && i === plan.big.length - 1) {
      c.place(SHIP.x + 2.4, -8.6, 0);
      arrivals.push({ c, at: 1.4 + (plan.residents.length - plan.welcomed) * 0.55, x: bx, z: bz });
    } else c.place(bx, bz, -0.3);
    scene.add(c.root);
    creatures.push(c);
  });
  let t = 0;
  let told = false;

  const companion = new Companion();
  companion.groundY = y;
  companion.place(0.6, 1.0);
  companion.want.pose = 'settled';
  scene.add(companion.root);

  const touchables: Touchable[] = creatures.map((c, i) => ({
    id: `creature-${i}`,
    object: c.root,
    offset: new THREE.Vector3(0, 0.4 * c.root.scale.y, 0),
    radius: Math.max(0.4, 0.4 * c.root.scale.y), // a finger, not the creature: most of them are small
    onTap: () => c.react(),
  }));
  touchables.push({
    id: 'companion',
    object: companion.root,
    offset: new THREE.Vector3(0, 0.25, 0),
    radius: 0.35,
    onTap: () => companion.act('celebrate'),
  });

  const box = (mode: LayoutMode) => (mode === 'tall' ? { width: 5.6, height: 6.6 } : { width: 11.5, height: 5.6 });

  return {
    name: 'home',
    palette,
    scene,
    touchables,
    // Nothing to pan to until the island has filled up a little.
    panRange: (mode) => (plan.residents.length > 8 ? Math.max(0, LIVE.halfWidth + 0.6 - box(mode).width / 2) : 0),
    framing(mode: LayoutMode): Framing {
      return mode === 'tall'
        ? { center: new THREE.Vector3(0, 0.9, CENTER_Z - 0.4), ...box(mode), elevation: 30, fov: 34 }
        : { center: new THREE.Vector3(0, 1.3, CENTER_Z), ...box(mode), elevation: 11 };
    },
    layout(mode) {
      // Nearer the middle on a tall screen, or it would be off the side.
      ship.place(mode === 'tall' ? SHIP.x - 0.7 : SHIP.x, SHIP.z, -Math.PI / 2);
    },
    enter() {},
    update(dt, camera) {
      for (const [x, z, r, stretch] of shadows) pushBlob(x, z, r, stretch);
      companion.viewer.copy(camera.position);
      t += dt;
      for (const a of arrivals) {
        if (a.at > 0 && t >= a.at) {
          a.at = -1;
          a.c.hopTo(a.x, a.z);
          if (a.c.root.scale.y < 1) a.c.wanderRadius = 0.85;
          sfx.sparkle();
        }
      }
      ship.update(dt, camera);
      if (arrivals.length && !told && t > arrivals[arrivals.length - 1].at + 3 && arrivals.every((a) => a.at < 0)) {
        told = true;
        companion.act('celebrate');
        plan.onWelcomed(plan.residents.length);
      }
      for (const c of creatures) {
        if (!c.root.visible || onShip.has(c)) continue;
        c.lookTarget = camera.position;
        c.update(dt);
      }
      companion.update(dt);
    },
  };
}
