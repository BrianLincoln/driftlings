import * as THREE from 'three';
import { angleDelta } from '../cast/gaze';

// How someone riding the ship holds itself. Under way it stands turned most of
// the way to the bow with its eyes on the sea ahead, and now and then steals a
// glance at a shipmate or at us. Fretting, it darts nervous looks about.

export class Lookout {
  private eyes = new THREE.Vector3();
  private wait = 0;

  /**
   * `turn` is how far round from the bow toward us it stands, 0 to 1: each to its own,
   * so a deckful does not line up. `steady` never takes its eyes off the sea.
   */
  constructor(private turn = 0.35 + Math.random() * 0.35, private steady = false) {}

  /** The way to stand facing, for someone at `at` on a ship whose bow points along `bow`. */
  yaw(at: THREE.Vector3, bow: THREE.Vector3, viewer: THREE.Vector3): number {
    const ahead = Math.atan2(bow.x, bow.z);
    return ahead + angleDelta(ahead, Math.atan2(viewer.x - at.x, viewer.z - at.z)) * this.turn;
  }

  /** What to be looking at this moment. `mate` gives where some shipmate is; `worry` is what a fretting one keeps checking on. */
  watch(dt: number, at: THREE.Vector3, bow: THREE.Vector3, viewer: THREE.Vector3, mate: () => THREE.Vector3, worry: THREE.Vector3 | null = null): THREE.Vector3 {
    if (worry) {
      // Nervous glances: at whoever has the plank, at each other, and back.
      if ((this.wait -= dt) <= 0) {
        this.wait = 0.35 + Math.random() * 0.7;
        this.eyes.copy(Math.random() < 0.4 ? worry : mate()).y += 0.2;
      }
      return this.eyes;
    }
    if ((this.wait -= dt) <= 0) {
      const pick = this.steady ? 0 : Math.random();
      // Mostly the sea; a glance elsewhere is a short one.
      this.wait = pick < 0.6 ? 1.2 + Math.random() * 2.4 : 0.5 + Math.random() * 0.7;
      if (pick < 0.6) this.eyes.copy(at).addScaledVector(bow, 30).y += 0.4;
      else if (pick < 0.85) this.eyes.copy(mate()).y += 0.2;
      else this.eyes.copy(viewer);
    }
    return this.eyes;
  }
}
