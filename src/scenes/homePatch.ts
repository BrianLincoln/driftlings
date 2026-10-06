import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { hash } from '../gfx/geo';
import { pushBlob } from '../gfx/uniforms';
import { Creature, LOOKS } from '../cast/creature';
import { Companion } from '../cast/companion';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';
import type { Diorama } from './diorama';
import { FLOWER_MAT, PROP_MAT, buildFarIsles, bushGeo, flowersGeo, rockGeo, treeGeo } from './props';

// A patch of the home island: no teaching job, just rescued creatures milling
// about and reacting when tapped.

const SHAPE: IslandShape = { radius: 5.2, rise: 0.55, sand: 0.9, seed: 1.7 };
const TREES: Array<[number, number, number]> = [[-3.1, -2.2, 11], [2.9, -2.7, 23], [-0.4, -3.6, 37]];

export function createHomePatch(): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.goldenNoon;
  const y = (x: number, z: number) => islandHeight(SHAPE, x, z);
  const prop = PROP_MAT();

  scene.add(buildSky(palette), buildWater(palette, SHAPE), buildIsland(SHAPE));
  scene.add(buildFarIsles(palette.water, [[-26, -70, 3], [18, -95, 8], [44, -60, 14]]));
  for (const [x, z, seed] of TREES) {
    const m = new THREE.Mesh(treeGeo(seed), prop);
    m.position.set(x, y(x, z) - 0.05, z);
    m.rotation.y = hash(seed) * 6;
    scene.add(m);
  }
  const bushes: Array<[number, number]> = [[-3.9, -0.5], [3.7, -1.0], [1.6, -3.5], [-2.0, -3.4]];
  bushes.forEach(([x, z], i) => {
    const m = new THREE.Mesh(bushGeo(40 + i * 7), prop);
    m.position.set(x, y(x, z) - 0.03, z);
    scene.add(m);
  });
  const rocks: Array<[number, number, number]> = [[3.3, 1.6, 0.42], [-3.6, 1.9, 0.3], [-4.2, 1.2, 0.5]];
  rocks.forEach(([x, z, s], i) => {
    const m = new THREE.Mesh(rockGeo(60 + i, s), prop);
    m.position.set(x, y(x, z) - 0.04, z);
    scene.add(m);
  });
  const spots: Array<[number, number, number]> = [];
  for (let i = 0; i < 34; i++) {
    const a = hash(i * 3.1) * Math.PI * 2;
    const r = 0.6 + hash(i * 7.7) * 3.4;
    spots.push([Math.sin(a) * r, y(Math.sin(a) * r, Math.cos(a) * r), Math.cos(a) * r]);
  }
  scene.add(new THREE.Mesh(flowersGeo(spots, 5), FLOWER_MAT()));

  const creatures = [
    new Creature(LOOKS.apricot),
    new Creature(LOOKS.slate),
    new Creature(LOOKS.moss),
  ];
  const starts: Array<[number, number, number]> = [[-0.9, 0.9, 0.3], [1.4, 0.2, -0.5], [0.2, -1.3, 0.1]];
  creatures.forEach((c, i) => {
    c.groundY = y;
    c.wanderRadius = 2.6;
    c.place(...starts[i]);
    scene.add(c.root);
  });

  const companion = new Companion();
  companion.groundY = y;
  companion.place(2.3, 1.5);
  companion.want.pose = 'settled';
  scene.add(companion.root);

  const touchables: Touchable[] = creatures.map((c, i) => ({
    id: `creature-${i}`,
    object: c.root,
    offset: new THREE.Vector3(0, 0.4, 0),
    radius: 0.5,
    onTap: () => {
      c.react();
      companion.act('greet');
    },
  }));
  touchables.push({
    id: 'companion',
    object: companion.root,
    offset: new THREE.Vector3(0, 0.25, 0),
    radius: 0.35,
    onTap: () => companion.act('celebrate'),
  });

  return {
    name: 'home',
    palette,
    scene,
    touchables,
    framing(mode: LayoutMode): Framing {
      return mode === 'tall'
        ? { center: new THREE.Vector3(0, 1.2, -0.4), width: 5.9, height: 6.4, elevation: 14, fov: 36 }
        : { center: new THREE.Vector3(0, 1.3, -0.6), width: 10.4, height: 5.0, elevation: 10 };
    },
    layout() {},
    enter() {},
    update(dt, camera) {
      for (const [x, z] of TREES) pushBlob(x, z, 0.95, 1.5);
      bushes.forEach(([x, z]) => pushBlob(x, z, 0.55, 1.2));
      rocks.forEach(([x, z, s]) => pushBlob(x, z, s * 1.1, 1.2));
      companion.viewer.copy(camera.position);
      for (const c of creatures) {
        c.lookTarget = camera.position;
        c.update(dt);
      }
      companion.update(dt);
    },
  };
}
