import * as THREE from 'three';
import { buildIsland, buildWater, islandHeight } from '../gfx/ground';
import { hash } from '../gfx/geo';
import { buildSky } from '../gfx/sky';
import { pushBlob } from '../gfx/uniforms';
import { sfx } from '../audio/sound';
import { Creature } from '../cast/creature';
import { rescue } from '../cast/species';
import type { Child } from '../game/children';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';
import type { Diorama } from './diorama';
import { HOME_BACK, HOME_PALETTE, HOME_SHAPE } from './places';
import { PROP_MAT, buildFarIsles, bushGeo, treeGeo } from './props';

// Who is playing? Each child on this device is a creature of their own, stood in
// a row on the home island. A child taps theirs and the game is theirs. Nothing
// here has to be read: a name, if a grown-up gave one, is only a label under it.

export interface WhoPlan {
  children: Child[];
  pick(child: Child): void;
}

/** They are the stars here: far bigger than the little ones they will rescue, and all one size, whatever the species. */
const BIG = 1.08;
const GAP = 1.75;
const ROW_Z = -2.4 + HOME_BACK;
/** On a tall screen they stand in rows of this many, the back row up the slope. */
const PER_ROW = 2;
const ROW_BACK = 2.8;
/** Seconds between the tap and the game starting: long enough to see it was you. */
const CHOSEN_FOR = 0.9;

export function createWho(plan: WhoPlan): Diorama {
  const scene = new THREE.Scene();
  const palette = HOME_PALETTE;
  const y = (x: number, z: number) => islandHeight(HOME_SHAPE, x, z);
  scene.add(buildSky(palette), buildWater(palette, HOME_SHAPE), buildIsland(HOME_SHAPE));
  scene.add(buildFarIsles(palette.water, [[-34, -80, 3], [20, -110, 8], [58, -72, 14], [-70, -95, 19]]));
  const prop = PROP_MAT();
  const shadows: Array<[number, number, number, number]> = [];
  const put = (geo: THREE.BufferGeometry, x: number, z: number, shadow: number, stretch: number) => {
    const m = new THREE.Mesh(geo, prop);
    m.position.set(x, y(x, z) - 0.04, z);
    scene.add(m);
    shadows.push([x, z, shadow, stretch]);
  };
  for (let i = 0; i < 9; i++) {
    const x = -8.4 + i * 2.1 + (hash(i * 5.3) - 0.5) * 0.9;
    put(treeGeo(11 + i * 12), x, HOME_BACK - 7.6 - hash(i * 2.9) * 1.4 + Math.abs(x) * 0.05, 0.95, 1.5);
  }
  for (let i = 0; i < 6; i++) put(bushGeo(40 + i * 7), (hash(i * 9.1 + 2) - 0.5) * 17, HOME_BACK - 6.4 + hash(i * 3.3) * 0.8, 0.55, 1.2);

  const n = plan.children.length;
  const cast = plan.children.map((child) => {
    const c = new Creature(rescue(child.look));
    c.root.scale.setScalar(BIG);
    c.groundY = y;
    const label = new THREE.Object3D();
    scene.add(c.root, label);
    return { child, c, label };
  });
  let chosen: Child | null = null;
  let chosenFor = 0;

  const touchables: Touchable[] = cast.map(({ child, c }, i) => ({
    id: `child:${i}`,
    object: c.root,
    offset: new THREE.Vector3(0, 0.45 * c.root.scale.y, 0),
    radius: 0.5 * c.root.scale.y,
    enabled: () => !chosen,
    onTap: () => {
      chosen = child;
      c.react();
      sfx.sparkle();
      for (const other of cast) if (other.c !== c) other.c.nod();
    },
  }));

  const rows = (mode: LayoutMode) => (mode === 'tall' ? Math.ceil(n / PER_ROW) : 1);

  return {
    name: 'who',
    palette,
    scene,
    touchables,
    framing(mode: LayoutMode): Framing {
      const back = (rows(mode) - 1) * ROW_BACK;
      const ground = y(0, ROW_Z);
      return mode === 'tall'
        ? { center: new THREE.Vector3(0, ground + 0.1, ROW_Z - back / 2), width: 4.3, height: 3.4 + back * 0.65, elevation: 38, fov: 34 }
        : { center: new THREE.Vector3(0, ground + 0.65, ROW_Z), width: Math.max(7, n * GAP + 1.2), height: 4.4, elevation: 11 };
    },
    layout(mode) {
      const perRow = mode === 'tall' ? PER_ROW : Math.max(1, n);
      cast.forEach(({ c, label }, i) => {
        // The front row fills first; a short back row stands in the gaps of the one in front.
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, n - row * perRow);
        const x = (i % perRow - (inRow - 1) / 2) * GAP;
        const z = ROW_Z - row * ROW_BACK;
        if (!chosen) c.place(x, z);
        label.position.set(x, y(x, z + 0.75) + 0.02, z + 0.75);
      });
    },
    enter(ctx) {
      for (const { child, label } of cast) {
        if (child.name) ctx.glyphs.add(child.name, label, 0.3).el.classList.add('name');
      }
    },
    update(dt, camera) {
      for (const [x, z, r, stretch] of shadows) pushBlob(x, z, r, stretch);
      for (const { c } of cast) {
        c.lookTarget = camera.position;
        c.update(dt);
      }
      if (chosen && chosenFor < CHOSEN_FOR && (chosenFor += dt) >= CHOSEN_FOR) plan.pick(chosen);
    },
  };
}
