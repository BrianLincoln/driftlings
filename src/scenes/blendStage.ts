import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { pushBlob } from '../gfx/uniforms';
import { Creature } from '../cast/creature';
import { rescue } from '../cast/species';
import { Companion } from '../cast/companion';
import { Spring, squash } from '../cast/spring';
import { playClip, preload, sfx } from '../audio/sound';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Glyph } from '../stage/glyphs';
import type { Touchable } from '../stage/touch';
import type { Diorama } from './diorama';
import { PROP_MAT, buildFarIsles, bushGeo, buildTile, rockGeo, treeGeo, type Tile } from './props';

// STYLE TEST ONLY. A staged exercise scene with three letter tiles, to judge
// the look and the letters. It is not the blending exercise: there is no
// learning logic here and the word is hard-coded.

const SHAPE: IslandShape = { radius: 4.4, rise: 0.25, sand: 0.8, seed: 4.1 };
const WORD = ['s', 'a', 't'];
const AUDIO = (n: string) => `${import.meta.env.BASE_URL}audio/style-test/${n}.mp3`;
const GAP = 1.14;

interface Slot {
  tile: Tile;
  glyph: Glyph | null;
  sq: Spring;
  lean: Spring;
  tapped: boolean;
}

export function createBlendStage(): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.mintMorning;
  const y = (x: number, z: number) => islandHeight(SHAPE, x, z);
  const prop = PROP_MAT();
  scene.add(buildSky(palette), buildWater(palette, SHAPE), buildIsland(SHAPE));

  scene.add(buildFarIsles(palette.water, [[-20, -60, 21], [24, -85, 27]]));

  // Scenery has a place for each layout: wide spreads it out, tall stacks it
  // behind the tiles so depth fills the height of a phone.
  const scenery = [
    { geo: treeGeo(71), wide: [-2.7, -2.2], tall: [-1.25, -3.1], r: 1.0 },
    { geo: treeGeo(83), wide: [2.6, -2.5], tall: [1.4, -3.3], r: 1.0 },
    { geo: bushGeo(90), wide: [1.5, -3.0], tall: [0.2, -3.6], r: 0.55 },
    { geo: bushGeo(97), wide: [-1.4, -3.1], tall: [-1.5, -1.4], r: 0.55 },
    { geo: rockGeo(12, 0.5), wide: [3.1, -0.4], tall: [1.55, -1.0], r: 0.55 },
  ].map((s) => ({ ...s, mesh: new THREE.Mesh(s.geo, prop) }));
  for (const s of scenery) scene.add(s.mesh);
  // A boulder for the creature to stand on, so all of it reads above the tiles.
  const perch = new THREE.Mesh(rockGeo(31, 0.75), prop);
  perch.scale.set(1.45, 1.95, 1.15);
  scene.add(perch);

  const creature = new Creature(rescue(0));
  scene.add(creature.root);
  const companion = new Companion();
  companion.groundY = y;
  scene.add(companion.root);

  const slots: Slot[] = WORD.map((_, i) => {
    const tile = buildTile();
    const x = (i - (WORD.length - 1) / 2) * GAP;
    tile.root.position.set(x, y(x, 1.2), 1.2);
    scene.add(tile.root);
    return { tile, glyph: null, sq: new Spring(1), lean: new Spring(0), tapped: false };
  });

  let next = 0;
  let tall = false;
  let resetIn = 0;
  let sayIn = -1;
  const target = new THREE.Vector3();

  // Pointing at near things is strong and at far things is weak, so the
  // companion always stands just in front of the tile it wants touched.
  const pointAtNext = (snap = false) => {
    if (next < slots.length) {
      const tile = slots[next].tile;
      tile.anchor.getWorldPosition(target);
      const tx = tile.root.position.x;
      companion.want.at.set(tall ? tx * 0.72 : tx - 0.5, 0, tall ? 2.25 : 1.95);
      companion.want.face = target;
      companion.want.pose = 'point';
    } else {
      companion.want.face = null;
      companion.want.pose = 'stand';
    }
    if (snap) companion.place(companion.want.at.x, companion.want.at.z);
    companion.nudge();
  };

  const tap = (i: number) => {
    const s = slots[i];
    s.sq.kick(-4.5);
    s.lean.kick((Math.random() - 0.5) * 3);
    sfx.pop();
    playClip(AUDIO(WORD[i]), 0.03);
    if (i !== next) return; // any tile can be heard; only the next one advances
    s.tapped = true;
    next++;
    pointAtNext();
    if (next === slots.length) sayIn = 0.75;
  };

  const touchables: Touchable[] = slots.map((s, i) => ({
    id: `tile-${i}`,
    object: s.tile.anchor,
    radius: 0.52,
    onTap: () => tap(i),
  }));
  touchables.push({
    id: 'creature',
    object: creature.root,
    offset: new THREE.Vector3(0, 0.4, 0),
    radius: 0.5,
    onTap: () => creature.react(),
  });

  let perchTop = 0;
  let pulse = 0;

  return {
    name: 'blend',
    palette,
    scene,
    touchables,
    framing(mode: LayoutMode): Framing {
      return mode === 'tall'
        ? { center: new THREE.Vector3(0, 1.3, 0.2), width: 3.75, height: 5.2, elevation: 16, fov: 40 }
        : { center: new THREE.Vector3(0, 1.2, 0.4), width: 6.8, height: 3.9, elevation: 10 };
    },
    layout(mode) {
      tall = mode === 'tall';
      for (const s of scenery) {
        const [x, z] = s[mode];
        s.mesh.position.set(x, y(x, z) - 0.04, z);
      }
      perch.position.set(0, y(0, -1.1) - 0.1, -1.1);
      perchTop = perch.position.y + 1.3;
      creature.groundY = () => perchTop;
      creature.place(0, -1.0);
      // Lean the tiles back to face the camera.
      for (const s of slots) s.tile.slab.rotation.x = mode === 'tall' ? -0.2 : -0.1;
      scene.updateMatrixWorld(true);
      pointAtNext(true);
    },
    enter({ glyphs }) {
      void preload([...WORD, 'sat'].map(AUDIO));
      slots.forEach((s, i) => (s.glyph = glyphs.add(WORD[i], s.tile.anchor, 0.74)));
      next = 0;
      slots.forEach((s) => (s.tapped = false));
      creature.stand();
      pointAtNext();
    },
    update(dt, camera) {
      pulse += dt;
      for (const s of scenery) pushBlob(s.mesh.position.x, s.mesh.position.z, s.r, 1.4);
      pushBlob(perch.position.x, perch.position.z, 1.0, 1.25);

      slots.forEach((s, i) => {
        const sy = s.sq.step(1, 220, 13, dt);
        squash(s.tile.slab, sy);
        s.tile.slab.rotation.z = s.lean.step(0, 140, 10, dt) * 0.05;
        // Only the tile to touch next carries the glint.
        s.tile.mat.uniforms.uGlint.value = i === next ? 0.6 : 0;
        s.tile.halo.visible = i === next;
        s.tile.halo.scale.setScalar(1 + 0.012 * Math.sin(pulse * 3.2));
        s.tile.slab.position.y = 0.12 + (s.tapped ? 0.07 : 0);
        if (s.glyph) {
          s.glyph.scaleY = sy;
          s.glyph.scaleX = 1 / Math.sqrt(Math.max(0.4, sy));
          s.glyph.tilt = -s.tile.slab.rotation.z;
          s.glyph.el.classList.toggle('done', s.tapped);
        }
        pushBlob(s.tile.root.position.x, s.tile.root.position.z, 0.5, 1.15);
      });

      // The word does something: say "sat", and the creature sits.
      if (sayIn >= 0) {
        sayIn -= dt;
        if (sayIn < 0) {
          playClip(AUDIO('sat'));
          creature.sit();
          companion.act('celebrate');
          slots.forEach((s, i) => s.sq.kick(3 + i));
          resetIn = 4.5;
        }
      }
      if (resetIn > 0) {
        resetIn -= dt;
        if (resetIn <= 0) {
          next = 0;
          slots.forEach((s) => (s.tapped = false));
          creature.stand();
          pointAtNext();
        }
      }

      companion.viewer.copy(camera.position);
      creature.lookTarget = next < slots.length ? target : camera.position;
      creature.update(dt);
      companion.update(dt);
    },
  };
}
