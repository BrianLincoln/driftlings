import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { pushBlob } from '../gfx/uniforms';
import { Creature } from '../cast/creature';
import { rescue } from '../cast/species';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Diorama } from './diorama';
import { PROP_MAT, bushGeo, treeGeo } from './props';
import { THING_NAMES, Thing } from './things';

// The sheet the drawings in things/ are judged on: not part of the game. The exercise scene's
// clearing, light and camera, with the things standing where an exercise would stand them and
// nothing else in the way. `?scene=things` is a page of them at play size beside a creature;
// `&thing=cat` is one of them with the camera three times closer. See docs/things.md.

export interface SheetPlan {
  /** One thing, seen three times closer. Otherwise a page of them at play size. */
  only: string | null;
  page: number;
  /** Just these, in a row. */
  row?: string[];
}

/** How many stand on one page at play size. */
export const SHEET_PAGE = 9;

// The clearing and the two cameras are the exercise scene's own (exerciseScene.ts): keep them the same.
const SHAPE: IslandShape = { radius: 4.6, rise: 0.25, sand: 0.8, seed: 4.1 };
const PLAY: Record<LayoutMode, Framing> = {
  tall: { center: new THREE.Vector3(0, 1.0, 0.9), width: 3.75, height: 5.9, elevation: 17, fov: 40 },
  wide: { center: new THREE.Vector3(0, 1.0, 0.7), width: 7.0, height: 4.3, elevation: 13 },
};
/** The front row is where an exercise stands its things; the rows behind are only so a page holds more. */
const ROWS = { tall: { across: 3, gap: 1.05 }, wide: { across: 5, gap: 1.2 } };
const FRONT = 2.75;
const CLOSER = 3;

export function createThingsSheet(plan: SheetPlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.mintMorning;
  const y = (x: number, z: number) => islandHeight(SHAPE, x, z);
  const prop = PROP_MAT();
  scene.add(buildSky(palette), buildWater(palette, SHAPE), buildIsland(SHAPE));

  const scenery = [
    { geo: treeGeo(71), wide: [-2.7, -2.2], tall: [-1.25, -3.1], r: 1.0 },
    { geo: treeGeo(83), wide: [2.6, -2.5], tall: [1.4, -3.3], r: 1.0 },
    { geo: bushGeo(90), wide: [1.5, -3.0], tall: [0.2, -3.6], r: 0.55 },
  ].map((s) => ({ ...s, mesh: new THREE.Mesh(s.geo, prop) }));
  for (const s of scenery) scene.add(s.mesh);

  const names = plan.row ?? (plan.only ? [plan.only] : THING_NAMES.slice(plan.page * SHEET_PAGE, (plan.page + 1) * SHEET_PAGE));
  const things = names.map((name) => new Thing(name));
  for (const t of things) scene.add(t.root);
  // Someone who lives here, to judge the things against. Not in the close view: there it is the thing alone.
  const neighbour = plan.only ? null : new Creature(rescue(2));
  if (neighbour) scene.add(neighbour.root);

  return {
    name: 'things',
    palette,
    scene,
    touchables: [],
    framing(m: LayoutMode): Framing {
      const f = { ...PLAY[m], center: PLAY[m].center.clone() };
      if (!plan.only) return f;
      f.center.set(0, y(0, FRONT) + 0.36, FRONT);
      f.width /= CLOSER;
      f.height /= CLOSER;
      return f;
    },
    layout(m) {
      for (const s of scenery) {
        const [x, z] = s[m];
        s.mesh.position.set(x, y(x, z) - 0.04, z);
      }
      const { across, gap } = ROWS[m];
      things.forEach((t, i) => {
        const row = Math.floor(i / across);
        const inRow = Math.min(across, things.length - row * across);
        const x = ((i % across) - (inRow - 1) / 2) * gap;
        const z = FRONT - row * (m === 'tall' ? 1.7 : 1.4);
        t.root.position.set(x, y(x, z), z);
      });
      if (neighbour) {
        const [x, z] = m === 'tall' ? [1.3, -1.2] : [3.1, 1.6];
        neighbour.groundY = y;
        neighbour.place(x, z, m === 'tall' ? 0 : -0.3);
      }
      scene.updateMatrixWorld(true);
    },
    enter() {},
    update(dt, camera) {
      for (const s of scenery) pushBlob(s.mesh.position.x, s.mesh.position.z, s.r, 1.4);
      for (const t of things) {
        t.update(dt);
        pushBlob(t.root.position.x, t.root.position.z, 0.34, 1.1);
      }
      if (neighbour) {
        neighbour.lookTarget = camera.position;
        neighbour.update(dt);
      }
    },
  };
}
