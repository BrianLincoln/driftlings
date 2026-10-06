import * as THREE from 'three';
import { C, PALETTES } from '../gfx/palette';
import { TAG } from '../gfx/glsl';
import { capsule, ellipsoid, lathe, merge, paint, place } from '../gfx/geo';
import { toonMaterial } from '../gfx/materials';
import { sfx } from '../audio/sound';
import { Spring } from '../cast/spring';
import type { Framing, LayoutMode } from '../stage/framing';
import type { Diorama } from './diorama';
import { treeGeo } from './props';
import { shipModel } from './ship';
import type { Port } from './voyage';
import { compassGeo, crossGeo, wavesGeo } from './chartMarks';

// The chart, shown in the middle of every crossing: a scroll unrolled on the
// deck boards and seen from above. Home is drawn on it under its little
// house, the island being explored under its flag, and further off the pale
// blank shapes of places nobody has been to yet. A dashed line joins the two
// we know, a cross marks where we are going, and a toy ship sails the line,
// rubbing out the dashes as it passes.

export interface ChartPlan {
  to: Port;
  /** The toy ship has got there. A tap gets there sooner. */
  done(): void;
}

/** Seconds the toy ship takes, and how long the picture holds once it is there. */
const CROSSING = 2.6;
const HOLD = 0.7;
const DASHES = 6;
const TOY = 0.3;
/** How far from an island's middle its shore is, at the size the islands are built. */
const SHORE = 1.25;

/**
 * Everything on the sheet for each layout, as fractions of the sheet's half-width and half-depth
 * (so -1,-1 is the far left corner): the two known islands, the blank ones as [x, z, size], the
 * compass, and the little wave marks.
 */
const SHEET = {
  wide: {
    size: [10.4, 5.5], isle: 0.8, home: [-0.66, 0.28], area: [0.16, -0.3],
    blank: [[0.72, 0.42, 0.62], [0.76, -0.56, 0.48], [-0.2, -0.74, 0.34]],
    compass: [-0.8, -0.58], waves: [[-0.3, 0.72], [0.38, 0.6], [-0.42, -0.3], [0.5, -0.82], [0.9, -0.06], [-0.9, 0.82]],
  },
  tall: {
    size: [4.7, 8.0], isle: 0.62, home: [-0.3, 0.7], area: [0.28, -0.1],
    blank: [[-0.4, -0.5, 0.5], [0.44, -0.8, 0.4], [-0.62, 0.12, 0.26]],
    compass: [0.56, 0.74], waves: [[0.5, 0.36], [-0.7, 0.4], [-0.1, -0.78], [0.66, -0.46], [-0.72, -0.86], [0.1, 0.92]],
  },
};

const small = (g: THREE.BufferGeometry, k: number, at: [number, number, number]) => place(g.scale(k, k, k), at);

/** An island as the chart draws it: nearly flat, with a wandering shore. `tone` takes how far out a point is, 0 to 1. */
function drawn(seed: number, tone: (far: number) => THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = lathe([[SHORE, 0], [SHORE * 0.97, 0.035], [SHORE * 0.5, 0.05], [0, 0.055]], (p) => tone(Math.hypot(p.x, p.z) / SHORE), 44, 10);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getX(i), pos.getZ(i));
    const k = 1 + 0.09 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.3);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k);
  }
  return g;
}
const land = (seed: number) => drawn(seed, (far) => (far > 0.8 ? C.sand : C.grass));

function homeToy(): THREE.BufferGeometry {
  // Four flat faces, so each side of the roof takes the light its own way.
  const roof = new THREE.ConeGeometry(0.44, 0.5, 4).toNonIndexed();
  roof.computeVertexNormals();
  return merge(
    land(1.7),
    place(paint(new THREE.BoxGeometry(0.5, 0.44, 0.5), C.parchment), [0, 0.27, 0.15], [0, 0.35, 0]),
    place(paint(roof, C.pennant), [0, 0.74, 0.15], [0, Math.PI / 4 + 0.35, 0]),
    small(treeGeo(11), 0.26, [-0.7, 0.04, -0.15]),
    small(treeGeo(35), 0.26, [0.7, 0.04, -0.1]),
    small(treeGeo(23), 0.24, [0.15, 0.04, -0.62]),
  );
}

function areaToy(): THREE.BufferGeometry {
  const stone = (x: number, z: number) => place(ellipsoid(0.15, 0.05, 0.15, C.parchment, 14), [x, 0.07, z]);
  return merge(
    land(2.6),
    stone(-0.62, 0.3), stone(-0.2, 0.44), stone(0.25, 0.3),
    place(capsule(0.025, 0.62, C.trunk), [0.55, 0.36, 0.0]),
    place(paint(new THREE.BoxGeometry(0.34, 0.2, 0.03), C.pennant), [0.74, 0.6, 0.0]),
    small(treeGeo(15), 0.26, [-0.5, 0.04, -0.45]),
    small(treeGeo(39), 0.24, [0.1, 0.04, -0.62]),
  );
}

export function createChart(plan: ChartPlan): Diorama {
  const scene = new THREE.Scene();
  const palette = PALETTES.goldenNoon;
  const table = new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2);
  scene.add(new THREE.Mesh(paint(table, C.shipTrim), toonMaterial({ tag: TAG.prop, flag: -0.45, wood: true })));
  const paper = toonMaterial({ tag: TAG.tile, flag: -0.92 });
  const sheet = new THREE.Mesh(paint(new THREE.BoxGeometry(1, 0.06, 1), (_p, n) => (n.y > 0.5 ? C.parchment : C.parchmentEdge)), paper);
  sheet.position.y = 0.03;
  // The scroll's two rolled ends, and a ruled border a little way in from its edge.
  const rollGeo = paint(new THREE.CylinderGeometry(0.2, 0.2, 1, 20).rotateX(Math.PI / 2), (_p, n) => (Math.abs(n.z) > 0.5 ? C.shipTrim : C.parchmentEdge));
  const rolls = [new THREE.Mesh(rollGeo, paper), new THREE.Mesh(rollGeo, paper)];
  const ruleGeo = place(paint(new THREE.BoxGeometry(1, 0.012, 0.035), C.parchmentEdge), [0, 0.066, 0]);
  const drawnMat = toonMaterial({ tag: TAG.prop, flag: -0.6 });
  const rules = [0, 1, 2, 3].map(() => new THREE.Mesh(ruleGeo, drawnMat));
  scene.add(sheet, ...rolls, ...rules);

  const isles = { home: new THREE.Mesh(homeToy(), drawnMat), area: new THREE.Mesh(areaToy(), drawnMat) };
  // Places not found yet: the bare shape of each, the colour of the paper's edge.
  const blanks = [3.1, 5.4, 0.6].map((seed) => new THREE.Mesh(drawn(seed, () => C.parchmentEdge), drawnMat));
  const compass = new THREE.Mesh(compassGeo(), drawnMat);
  const waveGeo = wavesGeo();
  const waves = SHEET.wide.waves.map(() => new THREE.Mesh(waveGeo, drawnMat));
  const cross = new THREE.Mesh(crossGeo(), drawnMat);
  const bounce = new Spring(1);
  const dashGeo = place(paint(new THREE.BoxGeometry(0.24, 0.02, 0.07), C.ink), [0, 0.07, 0]);
  const dashes = Array.from({ length: DASHES }, () => ({ mesh: new THREE.Mesh(dashGeo, drawnMat), size: new Spring(1), gone: false }));
  const toy = new THREE.Group();
  toy.add(shipModel());
  toy.scale.setScalar(TOY);
  scene.add(isles.home, isles.area, compass, cross, toy, ...blanks, ...waves, ...dashes.map((d) => d.mesh));

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
  let isle = 1;
  let t = 0;
  let told = false;
  let there = false;
  const finish = () => {
    if (told) return;
    told = true;
    plan.done();
  };

  return {
    name: 'chart',
    palette,
    scene,
    touchables: [],
    framing(m: LayoutMode): Framing {
      return m === 'tall'
        ? { center: new THREE.Vector3(0, 0.2, 0), width: 5.0, height: 7.9, elevation: 74, fov: 34 }
        : { center: new THREE.Vector3(0, 0.2, 0), width: 11.2, height: 5.3, elevation: 68 };
    },
    layout(m) {
      const s = SHEET[m];
      const [w, d] = s.size;
      const on = ([u, v]: number[], y = 0.06) => new THREE.Vector3((u * w) / 2, y, (v * d) / 2);
      sheet.scale.set(w, 1, d);
      // It unrolls sideways on a wide screen and downward on a tall one.
      rolls.forEach((r, i) => {
        const side = i ? 1 : -1;
        r.rotation.y = m === 'tall' ? Math.PI / 2 : 0;
        r.position.set(m === 'tall' ? 0 : side * (w / 2 + 0.1), 0.2, m === 'tall' ? side * (d / 2 + 0.1) : 0);
        r.scale.set(1, 1, (m === 'tall' ? w : d) + 0.3);
      });
      rules.forEach((r, i) => {
        const across = i < 2;
        const side = i % 2 ? 1 : -1;
        r.rotation.y = across ? 0 : Math.PI / 2;
        r.position.set(across ? 0 : side * (w / 2 - 0.22), 0, across ? side * (d / 2 - 0.22) : 0);
        r.scale.set((across ? w : d) - 0.44, 1, 1);
      });
      isle = s.isle;
      isles.home.position.copy(on(s.home));
      isles.area.position.copy(on(s.area));
      blanks.forEach((mesh, i) => {
        mesh.position.copy(on(s.blank[i]));
        mesh.scale.set(s.blank[i][2], 1, s.blank[i][2]);
      });
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
    enter() {},
    pointer(phase) {
      if (phase === 'down' && t > 0.5) finish();
    },
    update(dt) {
      t += dt;
      const k = THREE.MathUtils.smootherstep(Math.min(1, Math.max(0, t - 0.35) / CROSSING), 0, 1);
      toy.rotation.y = heading(k);
      at(k, toy.position);
      toy.position.y += 0.26 * TOY + 0.02 + Math.abs(Math.sin(t * 7)) * 0.03 * (k > 0 && k < 1 ? 1 : 0);
      toy.rotation.z = Math.sin(t * 5) * 0.05;
      dashes.forEach((d, i) => {
        if (!d.gone && k > (i + 0.5) / (DASHES + 0.8)) {
          d.gone = true;
          sfx.hop();
        }
        d.mesh.scale.setScalar(Math.max(0.001, d.size.step(d.gone ? 0 : 1, 260, 22, dt)));
      });
      if (k >= 1 && !there) {
        there = true;
        bounce.kick(4);
        sfx.pop();
      }
      const s = bounce.step(1, 170, 11, dt);
      isles[from].scale.setScalar(isle);
      isles[plan.to].scale.set(isle * (2 - s), isle * s, isle * (2 - s));
      cross.scale.setScalar(isle * (1 + 0.12 * Math.sin(t * 5)));
      if (t > 0.35 + CROSSING + HOLD) finish();
    },
  };
}
