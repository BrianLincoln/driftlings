import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { pushBlob } from '../gfx/uniforms';
import { Creature } from '../cast/creature';
import { Companion } from '../cast/companion';
import type { Rescue } from '../cast/species';
import { say, sayLine, preloadClips } from '../audio/narrate';
import { EXERCISES } from '../exercises';
import type { ExerciseKit, ExerciseRun } from '../exercises/contract';
import type { AttemptDraft } from '../learn/events';
import type { Round } from '../learn/items';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Diorama, StageContext } from './diorama';
import { Dust } from './dust';
import { LetterTile } from './letterTile';
import { Pips } from '../ui/pips';
import { PROP_MAT, buildFarIsles, bushGeo, rockGeo, treeGeo } from './props';

// The host for exercises: a small clearing, the companion, and whoever is
// watching. It plays a list of rounds, one exercise after another, and lends
// each a kit. All island, boss and reward knowledge stops here: a boss is the
// same host with a different creature watching and a mixed list of rounds.

export interface ExercisePlan {
  rounds: Round[];
  /** Who watches from the boulder. For a boss, the big sleepy creature in the way. */
  guest: Rescue;
  boss: boolean;
  onAttempt(a: AttemptDraft): void;
  onFinished(): void;
}

const SHAPE: IslandShape = { radius: 4.6, rise: 0.25, sand: 0.8, seed: 4.1 };

export function createExerciseScene(plan: ExercisePlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.mintMorning;
  const y = (x: number, z: number) => islandHeight(SHAPE, x, z);
  const prop = PROP_MAT();
  scene.add(buildSky(palette), buildWater(palette, SHAPE), buildIsland(SHAPE));
  scene.add(buildFarIsles(palette.water, [[-20, -60, 21], [24, -85, 27]]));

  const scenery = [
    { geo: treeGeo(71), wide: [-2.7, -2.2], tall: [-1.25, -3.1], r: 1.0 },
    { geo: treeGeo(83), wide: [2.6, -2.5], tall: [1.4, -3.3], r: 1.0 },
    { geo: bushGeo(90), wide: [1.5, -3.0], tall: [0.2, -3.6], r: 0.55 },
    { geo: bushGeo(97), wide: [-1.4, -3.1], tall: [-1.5, -1.4], r: 0.55 },
    { geo: rockGeo(12, 0.5), wide: [3.3, -0.6], tall: [1.6, -1.2], r: 0.55 },
  ].map((s) => ({ ...s, mesh: new THREE.Mesh(s.geo, prop) }));
  for (const s of scenery) scene.add(s.mesh);

  // The guest stands on a boulder so all of it reads above the tiles. A boss is
  // big enough to sit on the ground behind them.
  const perch = new THREE.Mesh(rockGeo(31, 0.75), prop);
  perch.scale.set(1.45, 1.95, 1.15);
  scene.add(perch);
  const guest = new Creature(plan.guest);
  if (plan.boss) {
    guest.root.scale.multiplyScalar(1.9);
    guest.drowse = 0;
  }
  scene.add(guest.root);
  const companion = new Companion();
  companion.groundY = y;
  scene.add(companion.root);
  const dust = new Dust();
  scene.add(dust.root);

  let mode: LayoutMode = 'wide';
  let ctx: StageContext | null = null;
  const tiles: LetterTile[] = [];
  let run: ExerciseRun | null = null;
  let roundIndex = -1;
  let pause = 0;
  let after: (() => void) | null = null;
  let finished = false;
  const total = plan.rounds.reduce((n, r) => n + r.items.length, 0);
  let doneItems = 0;
  const pips = new Pips(total);
  const v = new THREE.Vector3();

  const kit: ExerciseKit = {
    get mode() { return mode; },
    companion,
    tile(text, scale = 1, icon = false) {
      const t = new LetterTile(text, ctx!.glyphs, scale, icon);
      t.lean_back(mode === 'tall' ? -0.2 : -0.1);
      scene.add(t.root);
      tiles.push(t);
      return t;
    },
    spot(row, index, count) {
      const z = row === 'tiles' ? 1.2 : 2.75;
      const gap = row === 'tiles' ? Math.min(1.14, (mode === 'tall' ? 3.5 : 6) / count) : (mode === 'tall' ? 1.05 : 1.2);
      const x = (index - (count - 1) / 2) * gap;
      return new THREE.Vector3(x, y(x, z), z);
    },
    sideSpot: () => (mode === 'tall' ? new THREE.Vector3(-1.35, 0, 3.75) : new THREE.Vector3(-2.9, 0, 2.0)),
    besideSpot(tile) {
      const x = tile.goal.x;
      // Low and to the left of the tile, clear of its letter.
      const reach = 0.5 * tile.scale;
      return new THREE.Vector3(mode === 'tall' ? x * 0.72 - reach * 0.9 : x - reach - 0.1, 0, mode === 'tall' ? 2.3 : 1.95);
    },
    screenX(tile) {
      tile.anchor.getWorldPosition(v).project(ctx!.camera);
      return (v.x * 0.5 + 0.5) * ctx!.size().width;
    },
    say,
    line: sayLine,
    cheer() {
      if (plan.boss) guest.nod(); // a sleeper only stirs; it wakes at the end
      else guest.react();
      companion.act('celebrate');
    },
    nod: () => guest.nod(),
    trouble() {
      // Down off the rock, over the letters, round and round on top of them in a cloud of dust, and back up.
      const z = 2.0;
      let landed = false;
      return guest.whirl(new THREE.Vector3(0, y(0, z), z), () => {
        dust.burst(guest.root.position, landed ? 6 : 12, 0.3 * guest.root.scale.x);
        landed = true;
      }) + 0.15;
    },
  };

  const startRound = () => {
    roundIndex++;
    const round = plan.rounds[roundIndex];
    if (!round) {
      // Everything is done. A boss wakes up and moves out of the way.
      finished = true;
      if (plan.boss) {
        guest.drowse = null;
        guest.react();
        after = () => {
          guest.hopTo(4.5, -2.5);
          pause = 1.6;
          after = plan.onFinished;
        };
        pause = 1.4;
      } else {
        guest.react();
        pause = 1.5;
        after = plan.onFinished;
      }
      companion.want.pose = 'stand';
      companion.want.face = null;
      companion.act('celebrate');
      return;
    }
    const module = EXERCISES.get(round.exercise);
    if (!module) throw new Error(`no exercise for item kind "${round.exercise}"`);
    run = module.start(round.items, kit, {
      attempt: plan.onAttempt,
      itemDone() {
        doneItems++;
        pips.set(doneItems);
        if (plan.boss) guest.drowse = Math.min(0.85, doneItems / total);
      },
      finished() {
        run?.dispose();
        run = null;
        pause = 0.7;
        after = startRound;
      },
    });
    run.layout();
  };

  let perchTop = 0;

  return {
    name: 'exercise',
    palette,
    scene,
    get touchables() {
      return run && pause <= 0 ? run.touchables() : [];
    },
    framing(m: LayoutMode): Framing {
      return m === 'tall'
        ? { center: new THREE.Vector3(0, 1.0, 0.9), width: 3.75, height: 5.9, elevation: 17, fov: 40 }
        : { center: new THREE.Vector3(0, 1.0, 0.7), width: 7.0, height: 4.3, elevation: 11 };
    },
    layout(m) {
      mode = m;
      for (const s of scenery) {
        const [x, z] = s[m];
        s.mesh.position.set(x, y(x, z) - 0.04, z);
      }
      perch.position.set(0, y(0, -1.1) - 0.1, -1.1);
      perchTop = perch.position.y + 1.3;
      guest.groundY = (gx, gz) => (finished && plan.boss ? y(gx, gz) : perchTop);
      if (!finished) guest.place(0, -1.0);
      for (const t of tiles) t.lean_back(m === 'tall' ? -0.2 : -0.1);
      scene.updateMatrixWorld(true);
      run?.layout();
    },
    enter(c) {
      ctx = c;
      preloadClips(plan.rounds.flatMap((r) => EXERCISES.get(r.exercise)?.clips(r.items) ?? []));
      pips.mount();
      companion.place(kit.sideSpot().x, kit.sideSpot().z);
      pause = 0.5;
      after = startRound;
    },
    exit() {
      run?.dispose();
      run = null;
      pips.unmount();
    },
    pointer(phase, x, yPx) {
      if (pause <= 0) run?.pointer?.(phase, x, yPx);
    },
    update(dt, camera) {
      for (const s of scenery) pushBlob(s.mesh.position.x, s.mesh.position.z, s.r, 1.4);
      pushBlob(perch.position.x, perch.position.z, 1.0, 1.25);
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0 && after) {
          const f = after;
          after = null;
          f();
        }
      }
      run?.update(dt);
      for (let i = tiles.length - 1; i >= 0; i--) {
        const t = tiles[i];
        t.update(dt);
        if (t.gone) {
          t.dispose();
          tiles.splice(i, 1);
        } else if (t.root.scale.x > 0.5) pushBlob(t.root.position.x, t.root.position.z, 0.5 * t.scale, 1.15);
      }
      companion.viewer.copy(camera.position);
      guest.lookTarget = companion.want.face ?? camera.position;
      guest.update(dt);
      companion.update(dt);
      dust.update(dt);
    },
    // For scripted play.
    debug: () => (finished ? { finished: true } : pause > 0 || !run ? { waiting: true } : run.debug?.() ?? { waiting: true }),
    debugSlide() {
      if (!run?.pointer || !ctx) return;
      const w = ctx.size().width;
      run.pointer('down', 2, 300);
      for (let x = 2; x <= w; x += 6) run.pointer('move', x, 300);
      run.pointer('up', w, 300);
    },
  } as Diorama & { debug(): unknown; debugSlide(): void };
}
