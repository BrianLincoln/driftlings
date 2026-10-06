import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { hash } from '../gfx/geo';
import { pushBlob } from '../gfx/uniforms';
import { Creature } from '../cast/creature';
import { rescue } from '../cast/species';
import { Companion } from '../cast/companion';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';
import type { Diorama } from './diorama';
import { FLOWER_MAT, PROP_MAT, buildFarIsles, bushGeo, flowersGeo, rockGeo, treeGeo } from './props';

// The home island: no teaching job, just rescued creatures milling about and
// reacting when tapped. It is wider than the screen; a sideways drag pans it.
// STYLE TEST: the residents are a fixed sample, not a child's real rescues.

const SHAPE: IslandShape = { radius: 10.5, rise: 0.7, sand: 1.3, seed: 1.7 };
const RESIDENTS = 24;
/** The band of the island the camera looks at, and creatures live in. */
const LIVE = { halfWidth: 7.6, zBack: -6.2, zFront: 0.6 };
const CENTER_Z = -2.6;

export function createHomePatch(): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.goldenNoon;
  const y = (x: number, z: number) => islandHeight(SHAPE, x, z);
  const prop = PROP_MAT();
  const shadows: Array<[number, number, number, number]> = [];

  scene.add(buildSky(palette), buildWater(palette, SHAPE), buildIsland(SHAPE));
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

  // Residents on a loose grid, each with a small patch of its own to wander.
  const creatures: Creature[] = [];
  const cols = 8;
  for (let i = 0; i < RESIDENTS; i++) {
    const c = new Creature(rescue(i));
    const col = i % cols;
    const row = Math.floor(i / cols);
    const hx = -LIVE.halfWidth + ((col + 0.5 + (row % 2) * 0.35) / cols) * LIVE.halfWidth * 2 + (hash(i * 4.4) - 0.5) * 0.6;
    const hz = LIVE.zBack + 0.8 + row * 2.3 + (hash(i * 6.1) - 0.5) * 0.7;
    c.groundY = y;
    c.home.set(hx, 0, hz);
    c.wanderRadius = 0.85;
    c.place(hx, hz, (hash(i * 2.2) - 0.5) * 1.4);
    scene.add(c.root);
    creatures.push(c);
  }

  const companion = new Companion();
  companion.groundY = y;
  companion.place(0.6, 1.0);
  companion.want.pose = 'settled';
  scene.add(companion.root);

  const touchables: Touchable[] = creatures.map((c, i) => ({
    id: `creature-${i}`,
    object: c.root,
    offset: new THREE.Vector3(0, 0.4 * c.size, 0),
    radius: 0.45 * c.size,
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
    panRange: (mode) => Math.max(0, LIVE.halfWidth + 0.6 - box(mode).width / 2),
    framing(mode: LayoutMode): Framing {
      return mode === 'tall'
        ? { center: new THREE.Vector3(0, 0.9, CENTER_Z - 0.4), ...box(mode), elevation: 30, fov: 34 }
        : { center: new THREE.Vector3(0, 1.3, CENTER_Z), ...box(mode), elevation: 11 };
    },
    layout() {},
    enter() {},
    update(dt, camera) {
      for (const [x, z, r, stretch] of shadows) pushBlob(x, z, r, stretch);
      companion.viewer.copy(camera.position);
      for (const c of creatures) {
        c.lookTarget = camera.position;
        c.update(dt);
      }
      companion.update(dt);
    },
  };
}
