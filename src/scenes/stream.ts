import * as THREE from 'three';
import { Spring } from '../cast/spring';
import { paint } from '../gfx/geo';
import type { ScenePalette } from '../gfx/palette';
import type { LayoutMode } from '../stage/framing';
import { rockGeo } from './props';

// A little stream across the front of the clearing, running out to the sea, and the stepping stones
// that come up in it one at a time. It is crossed from one side to the other, never lost in: the water
// is only somewhere the stones are not yet.

/** Per layout: half the stream's width, how far down the clearing the stones are, where the stream rises, and how big a stone is. */
const BED = {
  tall: { half: 0.9, z: 3.55, head: 3.0, stone: 0.8 },
  wide: { half: 1.5, z: 2.5, head: 1.95, stone: 1 },
} as const;
/** How far a bank's standing place is from the water. */
const BANK = 0.3;
const MOUTH = 5.4;
const STONE = 0.25;
/** How far a stone's top is above the ground it comes up through. */
export const STONE_TOP = 0.09;

/** The water as a sheet lying on the ground: round at the head, straight from there to the sea. `grow` widens it, for the foam round its edge. */
function bedGeo(half: number, head: number, ground: (x: number, z: number) => number, colour: string, grow: number, lift: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(2, 1, 28, 90);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = 0.5 - pos.getY(i); // 0 at the head, 1 at the mouth
    const z = head - grow + v * (MOUTH - head + grow);
    const round = Math.min(1, (z - (head - grow)) / (half + grow));
    const x = u * (half + grow) * Math.sqrt(1 - (1 - round) * (1 - round));
    pos.setXYZ(i, x, Math.max(ground(x, z), -0.3) + lift, z);
  }
  g.computeVertexNormals();
  return paint(g, colour);
}

export class Crossing {
  readonly root = new THREE.Group();
  gone = false;
  private water = new THREE.Mesh();
  private foam = new THREE.Mesh();
  private stones: Array<{ mesh: THREE.Mesh; up: Spring; raised: boolean }> = [];
  private well = new Spring(0);
  private leaving = false;
  private mode: LayoutMode = 'wide';

  constructor(count: number, material: THREE.Material, private palette: ScenePalette, private ground: (x: number, z: number) => number) {
    this.water.material = this.foam.material = material;
    this.root.add(this.foam, this.water);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(rockGeo(40 + i * 7, STONE), material);
      mesh.rotation.y = i * 1.9;
      mesh.visible = false;
      this.root.add(mesh);
      this.stones.push({ mesh, up: new Spring(0), raised: false });
    }
  }

  layout(mode: LayoutMode): void {
    this.mode = mode;
    const { half, head } = BED[mode];
    this.water.geometry.dispose();
    this.foam.geometry.dispose();
    this.water.geometry = bedGeo(half, head, this.ground, this.palette.water, 0, 0.03);
    this.foam.geometry = bedGeo(half, head, this.ground, this.palette.foam, 0.09, 0.018);
    this.stones.forEach((s, i) => s.mesh.position.copy(this.place(i + 1)));
  }

  /** Where to stand: 0 is the bank on the left, then each stone, then the bank on the right. */
  place(i: number): THREE.Vector3 {
    const { half, z } = BED[this.mode];
    const n = this.stones.length;
    const gap = Math.min(0.75, (half * 1.84) / n);
    const x = i === 0 ? -half - BANK : i > n ? half + BANK : (i - 1 - (n - 1) / 2) * gap;
    return new THREE.Vector3(x, this.ground(x, z), z);
  }

  /** Stone `i`, from 0 at the left, comes up out of the water. */
  raise(i: number): void {
    const s = this.stones[i];
    if (!s || s.raised) return;
    s.raised = true;
    s.up.kick(5);
  }

  /** How far above the ground something at this spot stands: on a stone that is up, its top. */
  lift(x: number, z: number): number {
    for (const s of this.stones) {
      if (s.raised && Math.hypot(x - s.mesh.position.x, z - s.mesh.position.z) < STONE * 0.9) return STONE_TOP * Math.min(1, s.up.x);
    }
    return 0;
  }

  vanish(): void {
    this.leaving = true;
  }

  update(dt: number): void {
    // The water wells up from its head and drains back the same way; the stones sink first.
    const w = Math.max(0.001, this.well.step(this.leaving ? 0 : 1, 60, 14, dt));
    const { head } = BED[this.mode];
    for (const m of [this.water, this.foam]) {
      m.scale.set(Math.min(1, w * 1.4), 1, w);
      m.position.z = head * (1 - w);
    }
    for (const s of this.stones) {
      const k = Math.max(0, s.up.step(s.raised && !this.leaving ? 1 : 0, 150, 13, dt));
      s.mesh.visible = k > 0.02;
      const across = BED[this.mode].stone * Math.min(1, k * 1.5);
      s.mesh.scale.set(across, 0.55 * k, across);
    }
    if (this.leaving && w < 0.03) this.gone = true;
  }

  dispose(): void {
    this.water.geometry.dispose();
    this.foam.geometry.dispose();
    this.root.removeFromParent();
  }
}
