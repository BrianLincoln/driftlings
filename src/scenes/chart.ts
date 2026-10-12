import * as THREE from 'three';
import { C } from '../gfx/palette';
import { TAG } from '../gfx/glsl';
import { paint, place } from '../gfx/geo';
import { toonMaterial } from '../gfx/materials';
import { sfx } from '../audio/sound';
import { Spring } from '../cast/spring';
import { fitDistance, type Insets, type LayoutMode } from '../stage/framing';
import type { Place } from './places';
import { shipModel } from './ship';
import type { Port } from './voyage';
import { compassGeo, crossGeo, wavesGeo } from './chartMarks';
import { SHORE, areaToy, drawn, homeToy } from './chartIsles';
import { SHEETS } from './chartSheets';

// The chart, held up in front of the ship as it gets under way (voyage.ts): a
// scroll that unrolls across the picture. Home is drawn on it under its little
// house, each island found so far under its flag (with a tick once it is
// finished), and further off the pale blank shapes of places nobody has been
// to yet. A dashed line joins home and the island this crossing is to or from,
// a cross marks where we are going, and a toy ship sails the line, rubbing out
// the dashes as it passes.

export interface ChartPlan {
  to: Port;
  /** Which sheet: the id of the island in the curriculum (chartSheets.ts). */
  sheet: string;
  /** The islands found so far, in the order they were found. The rest of the sheet's islands stay blank. */
  isles: Array<{ place: Place; finished: boolean }>;
  /** Which of them this crossing is to or from. */
  isle: number;
}

export interface Chart {
  /** Hangs in front of the camera: add it to the camera, and the camera to the scene. */
  readonly root: THREE.Group;
  layout(m: LayoutMode): void;
  /** Unroll, then sail the toy ship across. True once it is there and the picture has held a moment. */
  update(dt: number, camera: THREE.PerspectiveCamera): boolean;
}

/** Seconds to unroll, seconds the toy ship takes, and how long the picture holds once it is there. */
const UNROLL = 0.4;
const CROSSING = 1.15;
const HOLD = 0.4;
const DASHES = 6;
const TOY = 0.3;
/** How far in front of the camera it hangs: nearer than anything in the scene behind it. */
const NEAR = 3;
/** How much of the screen stays clear around it, so the sea still shows at the edges. */
const MARGIN: Insets = { top: 0.07, bottom: 0.07, left: 0.045, right: 0.045 };
const UP = new THREE.Vector3(0, 1, 0);

export function createChart(plan: ChartPlan): Chart {
  const SHEET = SHEETS[plan.sheet];
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  root.visible = false;
  const paper = toonMaterial({ tag: TAG.tile, flag: -0.92 });
  const sheet = new THREE.Mesh(paint(new THREE.BoxGeometry(1, 0.06, 1), (_p, n) => (n.y > 0.5 ? C.parchment : C.parchmentEdge)), paper);
  sheet.position.y = 0.03;
  // The scroll's two rolled ends, and a ruled border a little way in from its edge.
  const rollGeo = paint(new THREE.CylinderGeometry(0.2, 0.2, 1, 20).rotateX(Math.PI / 2), (_p, n) => (Math.abs(n.z) > 0.5 ? C.shipTrim : C.parchmentEdge));
  const rolls = [new THREE.Mesh(rollGeo, paper), new THREE.Mesh(rollGeo, paper)];
  const ruleGeo = place(paint(new THREE.BoxGeometry(1, 0.012, 0.035), C.parchmentEdge), [0, 0.066, 0]);
  const drawnMat = toonMaterial({ tag: TAG.prop, flag: -0.6 });
  const rules = [0, 1, 2, 3].map(() => new THREE.Mesh(ruleGeo, drawnMat));
  root.add(sheet, ...rolls, ...rules);

  // Places not found yet are the bare shape of each, the colour of the paper's edge.
  const areas = SHEET.seeds.map((seed, i) => {
    const found = plan.isles[i];
    return new THREE.Mesh(found ? areaToy(seed, found.place.chart, found.finished) : drawn(seed, () => C.parchmentEdge), drawnMat);
  });
  const isles = { home: new THREE.Mesh(homeToy(), drawnMat), area: areas[plan.isle] };
  const compass = new THREE.Mesh(compassGeo(), drawnMat);
  const waveGeo = wavesGeo();
  const waves = SHEET.wide.waves.map(() => new THREE.Mesh(waveGeo, drawnMat));
  const cross = new THREE.Mesh(crossGeo(), drawnMat);
  const bounce = new Spring(1);
  const dashGeo = place(paint(new THREE.BoxGeometry(0.24, 0.02, 0.07), C.ink), [0, 0.07, 0]);
  const dashes = Array.from({ length: DASHES }, () => ({ mesh: new THREE.Mesh(dashGeo, drawnMat), size: new Spring(1), gone: false }));
  const toy = new THREE.Group();
  toy.add(shipModel());
  root.add(isles.home, compass, cross, toy, ...areas, ...waves, ...dashes.map((d) => d.mesh));

  const from: Port = plan.to === 'home' ? 'area' : 'home';
  // The line between them, bowed: where it starts, where it bends toward, where it ends.
  const a = new THREE.Vector3();
  const bend = new THREE.Vector3();
  const b = new THREE.Vector3();
  const at = (k: number, into: THREE.Vector3) => into.copy(a).multiplyScalar((1 - k) * (1 - k)).addScaledVector(bend, 2 * k * (1 - k)).addScaledVector(b, k * k);
  const heading = (k: number) => {
    at(Math.min(1, k + 0.02), next).sub(at(Math.max(0, k - 0.02), spot));
    return Math.atan2(-next.z, next.x);
  };
  const spot = new THREE.Vector3();
  const next = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const view = new THREE.Matrix4();
  let mode: LayoutMode = 'wide';
  /** How much of the sheet lies open, from its middle to either roll. */
  let half = 0;
  let isle = 1;
  let t = 0;
  let there = false;

  /** Hang it square in front of the camera, as big as the screen allows. */
  const hang = (camera: THREE.PerspectiveCamera) => {
    const { box, tilt } = SHEET[mode];
    const center = spot.set(0, 0.2, 0);
    const el = THREE.MathUtils.degToRad(tilt);
    const d = fitDistance({ center, width: box[0], height: box[1], elevation: tilt }, camera.fov, camera.aspect, MARGIN);
    eye.set(0, Math.sin(el), Math.cos(el)).multiplyScalar(d).add(center);
    // Seen from `eye` it fills the box; shrunk toward the camera it looks the same, and is in front of everything.
    root.matrix.copy(view.lookAt(eye, center, UP).setPosition(eye)).invert();
    root.matrix.premultiply(view.makeScale(NEAR / d, NEAR / d, NEAR / d));
    root.matrixWorldNeedsUpdate = true;
  };

  /** Lay the sheet open by `k` of its length: sideways on a wide screen, downward on a tall one. */
  const unroll = (k: number) => {
    const [w, d] = SHEET[mode].size;
    const tall = mode === 'tall';
    const span = Math.max(0.01, (tall ? d : w) * k);
    half = span / 2;
    sheet.scale.set(tall ? w : span, 1, tall ? span : d);
    rolls.forEach((r, i) => {
      const edge = (i ? 1 : -1) * (half + 0.1);
      r.position.set(tall ? 0 : edge, 0.2, tall ? edge : 0);
    });
    rules.forEach((r, i) => {
      const across = i < 2;
      const side = i % 2 ? 1 : -1;
      // Two run the way it unrolls and grow with it; the other two ride just inside the rolls.
      const grows = across !== tall;
      const off = grows ? (tall ? w : d) / 2 - 0.22 : half - 0.22;
      r.visible = span > 0.7;
      r.position.set(across ? 0 : side * off, 0, across ? side * off : 0);
      r.scale.set(Math.max(0.01, (grows ? span : tall ? w : d) - 0.44), 1, 1);
    });
  };
  /** Size something drawn on the sheet: nothing until the paper is open under all of it, about `SHORE` times `x` across. */
  const ink = (o: THREE.Object3D, x: number, y = x, z = x) => {
    const tall = mode === 'tall';
    const full = SHEET[mode].size[tall ? 1 : 0] / 2;
    const needs = Math.min(Math.abs(tall ? o.position.z : o.position.x) + SHORE * x, full - 0.3);
    const k = Math.max(1e-3, THREE.MathUtils.clamp((half - needs) / 0.3, 0, 1));
    o.scale.set(x * k, y * k, z * k);
  };

  return {
    root,
    layout(m) {
      mode = m;
      const s = SHEET[m];
      const [w, d] = s.size;
      const on = ([u, v]: number[], y = 0.06) => new THREE.Vector3((u * w) / 2, y, (v * d) / 2);
      rolls.forEach((r) => {
        r.rotation.y = m === 'tall' ? Math.PI / 2 : 0;
        r.scale.set(1, 1, (m === 'tall' ? w : d) + 0.3);
      });
      rules.forEach((r, i) => (r.rotation.y = i < 2 ? 0 : Math.PI / 2));
      isle = s.isle;
      isles.home.position.copy(on(s.home));
      areas.forEach((mesh, i) => mesh.position.copy(on(s.areas[i])));
      compass.position.copy(on(s.compass, 0.07));
      waves.forEach((mesh, i) => mesh.position.copy(on(s.waves[i], 0.07)));

      const [p, q] = [isles[from].position, isles[plan.to].position];
      const along = spot.copy(q).sub(p).setY(0).normalize().clone();
      const off = SHORE * isle + 0.6;
      a.copy(p).addScaledVector(along, off).setY(0.06);
      b.copy(q).addScaledVector(along, -off).setY(0.06);
      cross.position.copy(q).addScaledVector(along, -SHORE * isle * 0.84).setY(0.11);
      // It bows toward the viewer on its way out and away on its way back, like a round trip.
      bend.copy(a).add(b).multiplyScalar(0.5).add(new THREE.Vector3(-along.z, 0, along.x).multiplyScalar(a.distanceTo(b) * 0.35));
      dashes.forEach((dash, i) => {
        const k = (i + 0.9) / (DASHES + 0.8);
        at(k, dash.mesh.position);
        dash.mesh.rotation.y = heading(k);
      });
    },
    update(dt, camera) {
      if (!root.visible) {
        root.visible = true;
        sfx.whoosh();
      }
      t += dt;
      hang(camera);
      unroll(THREE.MathUtils.smootherstep(t / UNROLL, 0, 1));
      const k = THREE.MathUtils.smootherstep((t - UNROLL) / CROSSING, 0, 1);
      toy.rotation.y = heading(k);
      at(k, toy.position);
      toy.position.y += 0.26 * TOY + 0.02 + Math.abs(Math.sin(t * 12)) * 0.03 * (k > 0 && k < 1 ? 1 : 0);
      toy.rotation.z = Math.sin(t * 8) * 0.05;
      ink(toy, TOY);
      dashes.forEach((d, i) => {
        if (!d.gone && k > (i + 0.5) / (DASHES + 0.8)) {
          d.gone = true;
          sfx.hop();
        }
        ink(d.mesh, Math.max(0.001, d.size.step(d.gone ? 0 : 1, 260, 22, dt)));
      });
      if (k >= 1 && !there) {
        there = true;
        bounce.kick(4);
        sfx.pop();
      }
      const s = bounce.step(1, 170, 11, dt);
      areas.forEach((mesh, i) => {
        // A found island is drawn bigger than its blank, which lies flat at the size the sheet gives it.
        const size = i < plan.isles.length ? isle : SHEET[mode].areas[i][2];
        if (mesh !== isles[plan.to]) ink(mesh, size, i < plan.isles.length ? size : 1, size);
      });
      if (from === 'home') ink(isles.home, isle);
      ink(isles[plan.to], isle * (2 - s), isle * s, isle * (2 - s));
      ink(cross, isle * (1 + 0.12 * Math.sin(t * 5)));
      ink(compass, 1);
      for (const w of waves) ink(w, 1);
      return t > UNROLL + CROSSING + HOLD;
    },
  };
}
