import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { capsule, merge, paint, place } from '../gfx/geo';
import { toonMaterial } from '../gfx/materials';
import { C } from '../gfx/palette';
import { Spring } from '../cast/spring';

// The raft the ship tows: where someone far too big for the deck rides. It
// trails behind the stern on a rope, swinging round after the ship a moment
// late. It floats well clear of the water, so that when something heavy lands
// on it, it can duck and bob back up without ever going under.

/** Along the keel and across it. */
export const RAFT = { length: 2.5, width: 2.3 };
const LOG = 0.19;
/** Water between the stern and the raft. */
const GAP = 0.8;
const UP = new THREE.Vector3(0, 1, 0);
/** How high its middle rides: the water is at -0.22. */
const FLOAT = -0.12;

let geo: { logs: THREE.BufferGeometry; rope: THREE.BufferGeometry } | null = null;

function raftGeo() {
  const n = Math.round(RAFT.width / (LOG * 2));
  const logs = Array.from({ length: n }, (_, i) => {
    const z = (i - (n - 1) / 2) * LOG * 2;
    // No two logs quite the same length, and their sawn ends show pale.
    const len = RAFT.length - 0.5 + Math.sin(i * 2.3) * 0.14;
    const tone = (p: THREE.Vector3) => (Math.abs(p.y) > len / 2 + LOG * 0.45 ? C.cutWood : i % 2 ? C.trunk : C.shipHull);
    return place(capsule(LOG, len, tone), [Math.cos(i * 1.7) * 0.07, 0, z], [0, 0, Math.PI / 2]);
  });
  const lash = (x: number) => place(paint(new THREE.BoxGeometry(0.14, 0.07, RAFT.width - 0.1), C.sail), [x, LOG - 0.01, 0]);
  return {
    logs: merge(...logs, lash(RAFT.length * 0.3), lash(-RAFT.length * 0.3)),
    rope: place(capsule(0.035, 1, C.sail), [0, 0.5, 0]),
  };
}

export class Raft {
  readonly root = new THREE.Group();
  /** Lies in the world between ship and raft: add it to the scene beside `root`. */
  readonly rope: THREE.Mesh;
  private yaw = 0;
  private t = Math.random() * 6;
  /** How far it is pushed down, sprung: a landing sends it down and it bobs back to a little lower than before. */
  private dip = new Spring(0);
  private load = 0;
  private spot = new THREE.Vector3();
  private at = new THREE.Vector3();

  constructor() {
    geo ??= raftGeo();
    const mat = toonMaterial({ tag: TAG.prop, flag: -0.45, unlit: 0.3 });
    this.root.add(new THREE.Mesh(geo.logs, mat));
    this.rope = new THREE.Mesh(geo.rope, toonMaterial({ tag: TAG.prop, flag: -0.45 }));
  }

  /** The middle of its deck, where its passenger stands. */
  seat(): THREE.Vector3 {
    return this.spot.copy(this.root.position).setY(this.root.position.y + LOG);
  }

  /** Someone heavy lands on it: it ducks, bobs, and rides a little lower from now on. */
  thump(): void {
    this.dip.kick(1.1);
    this.load = 0.04;
  }

  /** Trail after a stern at `stern`, on a ship heading along `ahead`. A long `dt` puts it straight there. */
  follow(stern: THREE.Vector3, ahead: THREE.Vector3, dt: number): void {
    const p = this.root.position;
    const k = 1 - Math.exp(-3.5 * dt);
    this.at.copy(stern).addScaledVector(ahead, -(GAP + RAFT.length / 2));
    p.x += (this.at.x - p.x) * k;
    p.z += (this.at.z - p.z) * k;
    // It points along the rope, not along the ship.
    const want = Math.atan2(-(stern.z - p.z), stern.x - p.x);
    this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * k;
    this.t += Math.min(dt, 0.1);
    const down = THREE.MathUtils.clamp(this.dip.step(this.load, 70, 7, Math.min(dt, 0.05)), -0.05, 0.16);
    p.y = FLOAT - down + Math.sin(this.t * 1.3) * 0.02;
    // It rocks harder while it is still bobbing from a landing.
    const rock = 0.02 + Math.min(0.06, Math.abs(this.dip.v) * 0.08);
    this.root.rotation.set(Math.sin(this.t * 0.9) * 0.02, this.yaw, Math.sin(this.t * 3.1) * rock);

    const from = this.rope.position.set(p.x + Math.cos(this.yaw) * RAFT.length * 0.42, p.y + LOG, p.z - Math.sin(this.yaw) * RAFT.length * 0.42);
    const to = this.at.copy(stern).sub(from);
    this.rope.scale.set(1, Math.max(0.05, to.length()), 1);
    this.rope.quaternion.setFromUnitVectors(UP, to.normalize());
  }
}
