import * as THREE from 'three';
import { PALETTES } from '../gfx/palette';
import { buildIsland, buildWater, islandHeight, type IslandShape } from '../gfx/ground';
import { buildSky } from '../gfx/sky';
import { pushBlob } from '../gfx/uniforms';
import { Creature } from '../cast/creature';
import { Companion } from '../cast/companion';
import { Spring } from '../cast/spring';
import type { Rescue } from '../cast/species';
import { say, preloadClips } from '../audio/narrate';
import { sfx } from '../audio/sound';
import { EXERCISES } from '../exercises';
import type { ExerciseRun } from '../exercises/contract';
import type { AttemptDraft } from '../learn/events';
import type { Round } from '../learn/items';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Diorama, StageContext } from './diorama';
import { Dust } from './dust';
import { buildKit } from './exerciseKit';
import { Pips } from '../ui/pips';
import { PROP_MAT, bushGeo, rockGeo, treeGeo } from './props';

// The host for exercises: a small clearing, the companion, and whoever is
// watching. It plays a list of rounds, one exercise after another, and lends
// each a kit. All island, boss and reward knowledge stops here: a boss is the
// same host with a different creature watching and a mixed list of rounds.

export interface ExercisePlan {
  rounds: Round[];
  /** Who watches from the boulder. For a boss, the big one in the way: awake by now, and watching. */
  guest: Rescue;
  boss: boolean;
  onAttempt(a: AttemptDraft): void;
  onFinished(): void;
}

const SHAPE: IslandShape = { radius: 4.6, rise: 0.25, sand: 0.8, seed: 4.1 };
/** The ending: seconds the camera closes in on the guest while it braces, before it pops into colour. */
const SUSPENSE = 1.15;
const FANFARE = 'sfx/success';
/**
 * The boulder's stretch: across, up, deep. Its top, where the guest stands, follows from the
 * middle one. A boss is big enough to clear the tiles from a low rock, and has to fit under the pips.
 */
const PERCH = { little: [1.6, 2.55, 1.25], boss: [1.45, 1.95, 1.15] } as const;
/** How far from the middle of the boulder a boss starts down off it, and how far out it is on the ground. */
const CLEAR = [0.8, 2.1] as const;

export function createExerciseScene(plan: ExercisePlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.mintMorning;
  const y = (x: number, z: number) => islandHeight(SHAPE, x, z);
  const prop = PROP_MAT();
  scene.add(buildSky(palette), buildWater(palette, SHAPE), buildIsland(SHAPE));

  const scenery = [
    { geo: treeGeo(71), wide: [-2.7, -2.2], tall: [-1.25, -3.1], r: 1.0 },
    { geo: treeGeo(83), wide: [2.6, -2.5], tall: [1.4, -3.3], r: 1.0 },
    { geo: bushGeo(90), wide: [1.5, -3.0], tall: [0.2, -3.6], r: 0.55 },
    { geo: bushGeo(97), wide: [-1.4, -3.1], tall: [-1.5, -1.4], r: 0.55 },
    { geo: rockGeo(12, 0.5), wide: [3.3, -0.6], tall: [1.6, -1.2], r: 0.55 },
  ].map((s) => ({ ...s, mesh: new THREE.Mesh(s.geo, prop) }));
  for (const s of scenery) scene.add(s.mesh);

  // The guest stands on a boulder tall enough that its feet clear the top of the
  // biggest tile with air to spare, from either camera.
  const perch = new THREE.Mesh(rockGeo(31, 0.75), prop);
  const [perchX, perchY, perchZ] = PERCH[plan.boss ? 'boss' : 'little'];
  perch.scale.set(perchX, perchY, perchZ);
  scene.add(perch);
  const guest = new Creature(plan.guest);
  if (plan.boss) guest.root.scale.multiplyScalar(3.0);
  // Far from home it has no colour. It all comes back at once when it wakes.
  guest.setColour(0);
  scene.add(guest.root);
  const companion = new Companion();
  companion.groundY = y;
  scene.add(companion.root);
  const dust = new Dust();
  scene.add(dust.root);

  let mode: LayoutMode = 'wide';
  let ctx: StageContext | null = null;
  let run: ExerciseRun | null = null;
  let roundIndex = -1;
  let pause = 0;
  let after: (() => void) | null = null;
  let finished = false;
  const total = plan.rounds.reduce((n, r) => n + r.items.length, 0);
  let doneItems = 0;
  const pips = new Pips(total);
  const v = new THREE.Vector3();
  /** Where a spot on the ground, `x` across at depth `z`, falls on screen: -1 at the left edge, 1 at the right. */
  const across = (x: number, z: number) => v.set(x, y(x, z), z).project(ctx!.camera).x;
  // How far the camera has closed in on the guest: 0 is the whole clearing, 1 is just the guest.
  const zoom = new Spring(0);
  let zoomGoal = 0;

  const lent = buildKit({
    scene, prop, palette, companion, guest, dust, ground: y,
    mode: () => mode,
    ctx: () => ctx!,
  });
  const kit = lent.kit;

  const startRound = () => {
    roundIndex++;
    const round = plan.rounds[roundIndex];
    if (!round) {
      // Everything is done. A boss gets its colour back like anyone else, then moves out of the way.
      // The camera closes in while the guest braces, then: pop.
      finished = true;
      zoomGoal = 1;
      sfx.brace(SUSPENSE);
      guest.wake(SUSPENSE, () => {
        const p = guest.root.position;
        const s = guest.root.scale.x;
        dust.burst(p, 9, 0.45 * s, plan.boss ? 0.9 : 0.6);
        zoomGoal = 0.8;
        zoom.kick(-2.5); // the camera jolts back with it
        companion.quiet = say(FANFARE) > 0;
        companion.act('celebrate');
      });
      if (plan.boss) {
        after = () => {
          zoomGoal = 0;
          guest.hopTo(4.5, -2.5);
          pause = 1.6;
          after = plan.onFinished;
        };
        pause = SUSPENSE + 1.9;
      } else {
        pause = SUSPENSE + 2.2;
        after = plan.onFinished;
      }
      companion.want.pose = 'stand';
      companion.want.face = null;
      return;
    }
    const module = EXERCISES.get(round.exercise);
    if (!module) throw new Error(`no exercise for item kind "${round.exercise}"`);
    run = module.start(round.items, kit, {
      attempt: plan.onAttempt,
      itemDone() {
        doneItems++;
        pips.set(doneItems);
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
    get reframing() {
      return Math.abs(zoom.x - zoomGoal) > 1e-3 || Math.abs(zoom.v) > 1e-3;
    },
    framing(m: LayoutMode): Framing {
      const f: Framing = m === 'tall'
        ? { center: new THREE.Vector3(0, 1.0, 0.9), width: 3.75, height: 5.9, elevation: 17, fov: 40 }
        : { center: new THREE.Vector3(0, 1.0, 0.7), width: 7.0, height: 4.3, elevation: 13 };
      if (zoom.x === 0) return f;
      // Close in on a box around the guest, with room for its jump and the dust.
      const p = guest.root.position;
      const tall = guest.height * guest.root.scale.y;
      f.center.lerp(v.set(p.x, guest.groundY(p.x, p.z) + tall * 0.6, p.z), zoom.x);
      f.width = THREE.MathUtils.lerp(f.width, Math.min(f.width, tall * 2.7), zoom.x);
      f.height = THREE.MathUtils.lerp(f.height, Math.min(f.height, tall * 2.9), zoom.x);
      return f;
    },
    layout(m) {
      mode = m;
      for (const s of scenery) {
        const [x, z] = s[m];
        s.mesh.position.set(x, y(x, z) - 0.04, z);
      }
      perch.position.set(0, y(0, -1.1) - 0.1, -1.1);
      perchTop = perch.position.y + 0.667 * perch.scale.y;
      // It stands on the boulder as long as it is over it. A boss leaving at the end jumps
      // down off the edge: its feet stay above the rock until it is clear of it.
      guest.groundY = (gx, gz) => {
        if (!finished || !plan.boss) return perchTop;
        const k = THREE.MathUtils.clamp((Math.hypot(gx - perch.position.x, gz - perch.position.z) - CLEAR[0]) / (CLEAR[1] - CLEAR[0]), 0, 1);
        return THREE.MathUtils.lerp(perchTop, y(gx, gz), k * k); // falling: slowly at first, then fast
      };
      if (!finished) guest.place(0, -1.0);
      lent.layout(m);
      scene.updateMatrixWorld(true);
      run?.layout();
    },
    enter(c) {
      ctx = c;
      preloadClips([FANFARE, ...plan.rounds.flatMap((r) => EXERCISES.get(r.exercise)?.clips(r.items) ?? [])]);
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
      lent.update(dt);
      companion.viewer.copy(camera.position);
      guest.lookTarget = companion.want.face ?? camera.position;
      guest.update(dt);
      companion.update(dt);
      dust.update(dt);
      zoom.step(zoomGoal, 34, 11, dt);
    },
    // For scripted play.
    debug: () => (finished ? { finished: true } : pause > 0 || !run ? { waiting: true } : run.debug?.() ?? { waiting: true }),
    debugSteer(x: number, z: number) {
      if (run?.pointer && ctx) run.pointer('move', (across(x, z) * 0.5 + 0.5) * ctx.size().width, 300);
    },
  } as Diorama & { debug(): unknown; debugSteer(x: number, z: number): void };
}
