import * as THREE from 'three';
import type { Creature } from '../cast/creature';
import { capsule, ellipsoid, place } from '../gfx/geo';

// A big one's arms: two that stretch as far as they need to, from its shoulders
// to whatever it has hold of.

const UP = new THREE.Vector3(0, 1, 0);
/** How far either side of the middle of its grip each hand goes: wide enough to clear its head. */
const HANDS = 1.1;

export class Reach {
  /** Add these beside the creature: they lie in the world, not on it. */
  readonly parts: THREE.Mesh[];
  private arms: THREE.Mesh[] = [];
  private mitts: THREE.Mesh[] = [];
  private grip: THREE.Object3D | null = null;
  private reach = 0;
  private reachFor = 0;
  private took: (() => void) | null = null;

  constructor(private who: Creature) {
    // A unit-long arm from the shoulder up, stretched to length each frame, and a round mitt for its end.
    const tone = who.who.coat.coat;
    const arm = place(capsule(0.13, 1, tone), [0, 0.5, 0]);
    const mitt = ellipsoid(0.21, 0.19, 0.21, tone, 14);
    for (let i = 0; i < 2; i++) {
      this.arms.push(new THREE.Mesh(arm, who.skin));
      this.mitts.push(new THREE.Mesh(mitt, who.skin));
    }
    this.parts = [...this.arms, ...this.mitts];
    for (const part of this.parts) part.visible = false;
  }

  /**
   * Reach out with both arms and take hold of `thing`. `took` is called once it has a grip;
   * from then on the arms follow the thing wherever it is carried. `atOnce` skips the reaching.
   */
  grab(thing: THREE.Object3D, took?: () => void, atOnce = false): void {
    this.grip = thing;
    this.reachFor = 1;
    this.took = took ?? null;
    if (atOnce) this.reach = 1;
  }

  /** Let go: the arms draw back in. */
  letGo(): void {
    this.reachFor = 0;
  }

  update(dt: number): void {
    const before = this.reach;
    this.reach = THREE.MathUtils.clamp(this.reach + (this.reachFor > 0 ? dt / 0.28 : -dt / 0.2), 0, 1);
    if (this.reach >= 1 && before < 1) {
      this.took?.();
      this.took = null;
    }
    const grip = this.grip;
    for (const part of this.parts) part.visible = this.reach > 0.02 && !!grip;
    if (!grip || this.reach <= 0.02) return;
    const at = this.who.root.position;
    const top = this.who.height * this.who.root.scale.y;
    // It takes hold of the thing where the thing is nearest to it, a hand either side of that
    // spot, the right hand always on the right however the thing is turned.
    const along = new THREE.Vector3(1, 0, 0).applyQuaternion(grip.quaternion);
    if (along.x < 0) along.negate();
    const half = Math.max(0, grip.scale.x * 0.45 - HANDS);
    const nearest = THREE.MathUtils.clamp(at.clone().sub(grip.position).dot(along), -half, half);
    this.arms.forEach((arm, i) => {
      const side = i === 0 ? -1 : 1;
      // The arm starts inside the body, so it always grows out of it and never floats beside it.
      const from = arm.position.set(at.x + side * 0.62, at.y + top * 0.42, at.z + 0.1);
      const to = grip.position.clone().addScaledVector(along, nearest + side * HANDS).sub(from).multiplyScalar(this.reach);
      this.mitts[i].position.copy(from).add(to);
      arm.scale.set(1, Math.max(0.05, to.length()), 1);
      arm.quaternion.setFromUnitVectors(UP, to.normalize());
    });
  }
}
