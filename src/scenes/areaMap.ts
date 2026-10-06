import * as THREE from 'three';
import { C, PALETTES } from '../gfx/palette';
import { TAG } from '../gfx/glsl';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { ellipsoid, lathe, place, merge } from '../gfx/geo';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';
import { pushBlob } from '../gfx/uniforms';
import { sfx } from '../audio/sound';
import { Creature } from '../cast/creature';
import { Companion } from '../cast/companion';
import { Spring } from '../cast/spring';
import type { Rescue } from '../cast/species';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Touchable } from '../stage/touch';
import type { Diorama, StageContext } from './diorama';
import { LetterTile } from './letterTile';
import { PROP_MAT, buildFarIsles, bushGeo, rockGeo, treeGeo } from './props';

// One area of an island: a short path of stepping stones ending where
// something big is in the way. Done stones have their rescued creature beside
// them, the current one glows, and locked ones are visible but greyed, so the
// child can see what is coming.

export interface MapNode {
  id: string;
  state: 'done' | 'current' | 'locked';
  /** What the stone shows: the letter it teaches, or an example word. Empty for the checkpoint. */
  label: string;
  /** The creature found here, if this stone gives one. */
  rescue: Rescue | null;
  boss: boolean;
}

export interface AreaMapPlan {
  nodes: MapNode[];
  sleeper: Rescue;
  /** A node finished a moment ago: its creature greets you. */
  fresh: string | null;
  surprise: boolean;
  /** True once the creatures have gone home: the stones stay, the camp is empty. */
  campEmpty: boolean;
  onNode(id: string): void;
  onSurprise(): void;
}

const SHAPE: IslandShape = { radius: 7.2, rise: 0.4, sand: 1.0, seed: 2.6 };
const WIDE_Z = [0.9, -0.5, 0.7, -0.6, 0.6, -0.9];
const TALL_X = [-0.95, 0.85, -0.95, 0.85, -0.7, 0.35];

export function createAreaMap(plan: AreaMapPlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.goldenNoon;
  const y = (x: number, z: number) => islandHeight(SHAPE, x, z);
  const prop = PROP_MAT();
  scene.add(buildSky(palette), buildWater(palette, SHAPE), buildIsland(SHAPE));
  scene.add(buildFarIsles(palette.water, [[-30, -75, 5], [26, -95, 9]]));

  const scenery = [
    { geo: treeGeo(15), wide: [-5.2, -3.2], tall: [-2.6, -4.6], r: 0.95 },
    { geo: treeGeo(27), wide: [-1.6, -3.9], tall: [2.5, -2.2], r: 0.95 },
    { geo: treeGeo(39), wide: [2.2, -3.7], tall: [-2.7, 0.4], r: 0.95 },
    { geo: treeGeo(51), wide: [5.6, -3.0], tall: [2.6, 2.6], r: 0.95 },
    { geo: bushGeo(63), wide: [-3.4, 2.6], tall: [2.4, 0.2], r: 0.55 },
    { geo: bushGeo(75), wide: [3.8, 2.4], tall: [-2.5, -2.2], r: 0.55 },
    { geo: rockGeo(87, 0.4), wide: [0.4, 2.9], tall: [-2.4, 2.9], r: 0.45 },
  ].map((s) => ({ ...s, mesh: new THREE.Mesh(s.geo, prop) }));
  for (const s of scenery) scene.add(s.mesh);

  const stoneGeo = lathe([[0.62, 0], [0.6, 0.14], [0.5, 0.22], [0.3, 0.24], [0, 0.24]], '#ffffff', 32, 20); // bottom to top, or it faces inward
  const ringGeo = lathe([[0.9, 0], [0.86, 0.05], [0.6, 0.06], [0, 0.06]], C.glow, 32, 12);
  const pebbleGeo = place(ellipsoid(0.13, 0.06, 0.11, C.path, 10), [0, 0.03, 0]);
  const TINT = { done: '#efe2c8', current: C.parchment, locked: '#9a938e' };

  interface Spot {
    node: MapNode;
    group: THREE.Group;
    mat: ToonMaterial;
    ring: THREE.Mesh | null;
    tile: LetterTile | null;
    creature: Creature | null;
    wobble: Spring;
  }
  const spots: Spot[] = plan.nodes.map((node) => {
    const group = new THREE.Group();
    const mat = toonMaterial({ tag: TAG.prop, tint: TINT[node.state], flag: node.state === 'locked' ? 0 : -0.7 });
    const stone = new THREE.Mesh(stoneGeo, mat);
    if (node.boss) stone.scale.set(1.5, 1, 1.5);
    group.add(stone);
    let ring: THREE.Mesh | null = null;
    if (node.state === 'current') {
      ring = new THREE.Mesh(ringGeo, toonMaterial({ tag: TAG.tile, unlit: 1, flag: 0.3 }));
      if (node.boss) ring.scale.set(1.5, 1, 1.5);
      group.add(ring);
    }
    scene.add(group);
    let creature: Creature | null = null;
    if (node.boss) {
      creature = new Creature(plan.sleeper);
      creature.root.scale.multiplyScalar(1.7);
      creature.drowse = node.state === 'done' ? null : 0;
    } else if (node.rescue && node.state === 'done' && !plan.campEmpty) {
      creature = new Creature(node.rescue);
    }
    if (creature) scene.add(creature.root);
    return { node, group, mat, ring, tile: null, creature, wobble: new Spring(0) };
  });

  const pebbles = Array.from({ length: (spots.length - 1) * 3 }, () => {
    const m = new THREE.Mesh(pebbleGeo, prop);
    scene.add(m);
    return m;
  });

  // The surprise: something shiny beside the path.
  const pearl = new THREE.Mesh(
    merge(place(ellipsoid(0.24, 0.24, 0.24, C.parchment, 24), [0, 0.42, 0]), rockGeo(5, 0.3)),
    toonMaterial({ tag: TAG.tile, flag: -0.8 }),
  );
  pearl.material.uniforms.uGlint.value = 1;
  pearl.visible = plan.surprise;
  scene.add(pearl);

  const companion = new Companion();
  companion.groundY = y;
  scene.add(companion.root);

  let mode: LayoutMode = 'wide';
  let t = 0;
  let greeted = false;
  const current = spots.find((s) => s.node.state === 'current') ?? null;
  const target = new THREE.Vector3();

  const position = (i: number): [number, number] => {
    const n = spots.length;
    if (mode === 'tall') return [TALL_X[i % TALL_X.length], 3.3 - i * (6.9 / (n - 1))];
    return [-4.6 + i * (9.2 / (n - 1)), WIDE_Z[i % WIDE_Z.length]];
  };

  const touchables: Touchable[] = spots.map((s) => ({
    id: `node:${s.node.id}`,
    object: s.group,
    offset: new THREE.Vector3(0, 0.35, 0),
    radius: 0.8,
    onTap: () => {
      s.wobble.kick(5);
      if (s.node.state === 'locked') {
        // Not yet: the stone wobbles and the companion calls you back to the glowing one.
        sfx.oops();
        companion.nudge();
        companion.act('greet');
      } else {
        sfx.pop();
        plan.onNode(s.node.id);
      }
    },
  }));
  touchables.push({
    id: 'surprise',
    object: pearl,
    offset: new THREE.Vector3(0, 0.4, 0),
    radius: 0.55,
    enabled: () => pearl.visible,
    onTap: () => {
      sfx.sparkle();
      plan.onSurprise();
    },
  });

  return {
    name: 'map',
    palette,
    scene,
    touchables,
    framing(m: LayoutMode): Framing {
      return m === 'tall'
        ? { center: new THREE.Vector3(0, 0.7, -0.2), width: 4.4, height: 7.4, elevation: 32, fov: 34 }
        : { center: new THREE.Vector3(0, 0.9, -0.2), width: 11.6, height: 5.4, elevation: 20 };
    },
    layout(m) {
      mode = m;
      for (const s of scenery) {
        const [x, z] = s[m];
        s.mesh.position.set(x, y(x, z) - 0.04, z);
      }
      spots.forEach((s, i) => {
        const [x, z] = position(i);
        s.group.position.set(x, y(x, z) - 0.02, z);
        s.tile?.snap(new THREE.Vector3(x, y(x, z - 0.5) + 0.1, z - 0.5));
        s.tile?.lean_back(m === 'tall' ? -0.45 : -0.25);
        if (s.creature) {
          s.creature.groundY = y;
          // Whoever stands by a stone stands on its inner side, so nothing falls off a narrow screen.
          const inward = x > 0 ? -1 : 1;
          if (s.node.boss) s.creature.place(x, z - 0.75);
          else s.creature.place(x + inward * 0.85, z + 0.15, inward * 0.3);
        }
        if (i > 0) {
          const [px, pz] = position(i - 1);
          for (let k = 0; k < 3; k++) {
            const f = (k + 1) / 4;
            const bx = px + (x - px) * f + Math.sin((i * 3 + k) * 2.4) * 0.12;
            const bz = pz + (z - pz) * f + Math.cos((i * 3 + k) * 1.7) * 0.12;
            pebbles[(i - 1) * 3 + k].position.set(bx, y(bx, bz), bz);
          }
        }
      });
      const [sx, sz] = m === 'tall' ? [1.75, -0.5] : [1.0, 2.6];
      pearl.position.set(sx, y(sx, sz), sz);
      if (current) {
        const p = current.group.position;
        target.set(p.x, p.y + 0.3, p.z);
        companion.want.at.set(p.x + (p.x > 0 ? -1 : 1) * 0.95, 0, p.z + 0.35);
        companion.want.face = target;
        companion.want.pose = 'point';
      } else {
        companion.want.at.set(0, 0, 2.2);
        companion.want.pose = 'settled';
      }
      companion.place(companion.want.at.x, companion.want.at.z);
    },
    enter(ctx: StageContext) {
      for (const s of spots) {
        if (!s.node.label) continue;
        s.tile = new LetterTile(s.node.label, ctx.glyphs, s.node.label.length > 1 ? 0.5 : 0.58);
        s.tile.dim = s.node.state === 'locked';
        s.tile.done = s.node.state === 'done';
        scene.add(s.tile.root);
      }
    },
    update(dt, camera) {
      t += dt;
      for (const s of scenery) pushBlob(s.mesh.position.x, s.mesh.position.z, s.r, 1.4);
      for (const s of spots) {
        pushBlob(s.group.position.x, s.group.position.z, s.node.boss ? 0.95 : 0.66, 1.1);
        s.group.rotation.z = s.wobble.step(0, 150, 9, dt) * 0.04;
        if (s.ring) s.ring.scale.setScalar((s.node.boss ? 1.5 : 1) * (1 + 0.05 * Math.sin(t * 3.2)));
        s.tile?.update(dt);
        if (s.creature) {
          s.creature.lookTarget = camera.position;
          s.creature.update(dt);
        }
      }
      if (plan.fresh && !greeted && t > 0.7) {
        greeted = true;
        const s = spots.find((x) => x.node.id === plan.fresh);
        s?.creature?.react();
        sfx.sparkle();
      }
      pearl.rotation.y = t * 0.8;
      companion.viewer.copy(camera.position);
      companion.update(dt);
    },
  };
}
