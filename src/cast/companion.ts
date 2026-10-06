import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { capsule, ellipsoid, merge, place } from '../gfx/geo';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';
import { pushBlob } from '../gfx/uniforms';
import { Blinker, Spring, ease, squash } from './spring';
import { angleDelta, gazeAt } from './gaze';
import { chirp, sfx } from '../audio/sound';

// The wordless guide. Same architecture as the reference project: a standing
// WANT that it acts out continuously, and a queue of one-shot ACTS that
// interrupt the want and then return to it. A new instruction is a new field
// and a new branch, not a new system.

export interface Want {
  /** Where to be. */
  at: THREE.Vector3;
  /** What to keep glancing and pointing at. */
  face: THREE.Vector3 | null;
  pose: 'stand' | 'point' | 'settled';
}

/** 'show' is "like this": it reaches out and touches what it is facing. */
export type Act = 'celebrate' | 'greet' | 'show';

const POINT_FOR = 1.7;
const REST_FOR = 2.4;
const DOWN = new THREE.Vector3(0, -1, 0);

export class Companion {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private arms: THREE.Group[] = [];
  private mat: ToonMaterial;
  private sq = new Spring(1);
  private armUp = [new Spring(0), new Spring(0)];
  private blink = new Blinker();
  private yaw = 0;
  private bob = Math.random() * 6;
  private cycle = 0;
  private cyclesDone = 0;
  private acts: Act[] = [];
  private actT = 0;
  private happyFor = 0;
  private gaze = { x: 0, y: 0 };
  private gazeNow = { x: 0, y: 0 };
  want: Want = { at: new THREE.Vector3(), face: null, pose: 'stand' };
  /** Where "you" are: it looks here between glances at its target. */
  viewer = new THREE.Vector3(0, 1.5, 10);
  groundY: (x: number, z: number) => number = () => 0;

  constructor() {
    // The owner's own companion from the reference game: a pebble-round body,
    // big painted eyes, two stubby arms, two feet and a glowing spot on its chest.
    const warm = '#f4b650';
    const geo = merge(
      place(ellipsoid(0.23, 0.235, 0.22, (p, n) => (n.z > 0.5 && p.y < -0.42 ? '#fff1c4' : warm), 44), [0, 0.22, 0]),
      place(ellipsoid(0.07, 0.04, 0.09, '#eda653'), [0.09, 0.0, 0.06]),
      place(ellipsoid(0.07, 0.04, 0.09, '#eda653'), [-0.09, 0.0, 0.06]),
    );
    // Self-lit and exempt from the grade: it stays warm in any palette.
    this.mat = toonMaterial({
      tag: TAG.creature,
      unlit: 0.5,
      flag: 0.5,
      face: {
        origin: [0, 0.22, 0],
        eye: [0.36, 0.2, 0.22, 0.27],
        pupil: [0.085, 0.115, 0.13, 0.11],
        mouth: [-0.2, 0.07],
        blush: [0.7, -0.08, 0.12],
      },
    });
    this.body.add(new THREE.Mesh(geo, this.mat));
    const armMat = toonMaterial({ tag: TAG.creature, unlit: 0.55, flag: 0.5 });
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.215, 0.17, 0.03);
      pivot.add(new THREE.Mesh(place(capsule(0.042, 0.07, '#f3b458'), [0, -0.06, 0]), armMat));
      this.body.add(pivot);
      this.arms.push(pivot);
    }
    this.root.add(this.body);
  }

  place(x: number, z: number): this {
    this.root.position.set(x, this.groundY(x, z), z);
    this.want.at.set(x, 0, z);
    return this;
  }

  act(a: Act): void {
    // A celebrate already in progress is not restarted by a second trigger.
    if (this.acts[0] === a) return;
    this.acts.push(a);
  }

  /** Restart the pointing cycle, e.g. when the thing to point at changes. */
  nudge(): void {
    this.cycle = 0;
    this.cyclesDone = 0;
  }

  update(dt: number): void {
    const p = this.root.position;
    const w = this.want;
    this.bob += dt;
    let lift = 0.035 + Math.abs(Math.sin(this.bob * 2.1)) * 0.02;
    let faceYaw = Math.atan2(this.viewer.x - p.x, this.viewer.z - p.z);
    let lookAt: THREE.Vector3 = this.viewer;
    const armTarget = [0, 0];
    let spin = 0;

    // Travel: it glides rather than walks, leaning into the move.
    const dx = w.at.x - p.x;
    const dz = w.at.z - p.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.05;
    if (moving) {
      const step = Math.min(dist, 2.4 * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      faceYaw = Math.atan2(dx, dz);
    }

    const act = this.acts[0];
    if (act) {
      if (this.actT === 0) {
        this.sq.kick(4);
        if (act === 'celebrate') sfx.cheer();
        else if (act === 'greet') sfx.coo();
      }
      this.actT += dt;
      const len = act === 'celebrate' ? 1.8 : act === 'show' ? 0.8 : 1.0;
      const k = this.actT / len;
      if (act === 'celebrate') {
        armTarget[0] = armTarget[1] = 1;
        lift += Math.abs(Math.sin(this.actT * 7)) * 0.16;
        spin = Math.min(1, this.actT / 0.8) * Math.PI * 2;
        this.happyFor = 1.5;
      } else if (act === 'show' && w.face) {
        // Turn to the thing, hop at it and reach out with the nearer arm.
        const toward = Math.atan2(w.face.x - p.x, w.face.z - p.z);
        armTarget[angleDelta(faceYaw, toward) > 0 ? 1 : 0] = 1;
        faceYaw += angleDelta(faceYaw, toward) * 0.7;
        lookAt = w.face;
        lift += Math.sin(Math.min(1, this.actT / 0.5) * Math.PI) * 0.22;
      } else {
        armTarget[1] = 0.5 + 0.5 * Math.sin(this.actT * 16); // a wave
        this.happyFor = 0.4;
      }
      if (k >= 1) {
        this.acts.shift();
        this.actT = 0;
      }
    } else if (!moving && w.pose === 'point' && w.face) {
      const before = this.cycle;
      this.cycle = (this.cycle + dt) % (POINT_FOR + REST_FOR);
      if (this.cycle < before) this.cyclesDone++;
      if (this.cycle < POINT_FOR) {
        // Point with the arm nearer the target, look at it, and lean toward it.
        const toward = Math.atan2(w.face.x - p.x, w.face.z - p.z);
        const side = angleDelta(faceYaw, toward) > 0 ? 1 : 0;
        armTarget[side] = 1;
        lookAt = w.face;
        faceYaw += angleDelta(faceYaw, toward) * 0.45;
        if (before === 0 || this.cycle < before) {
          this.sq.kick(3);
          // Sound on the first three cycles only, then quiet, so it does not nag.
          if (this.cyclesDone < 3) chirp(700, 1050, 0.1, 0.09);
        }
      }
    } else if (w.pose === 'settled') {
      this.happyFor = Math.max(this.happyFor, Math.sin(this.bob * 0.4) > 0.93 ? 0.6 : 0);
    }

    this.yaw += angleDelta(this.yaw, faceYaw) * (1 - Math.exp(-7 * dt));
    this.root.rotation.y = this.yaw + spin;
    this.root.rotation.z = ease(this.root.rotation.z, moving ? -0.12 : 0, 6, dt);
    p.y = this.groundY(p.x, p.z) + lift;
    squash(this.body, this.sq.step(1 + Math.sin(this.bob * 2.1) * 0.02, 180, 14, dt));
    this.root.updateMatrixWorld();

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const up = this.armUp[i].step(armTarget[i], 120, 12, dt);
      const pivot = this.arms[i];
      const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, side * 0.55));
      let raised: THREE.Quaternion;
      if ((!act || act === 'show') && w.face) {
        // Aim the arm's axis (it hangs along -Y) straight at the target.
        const local = pivot.parent!.worldToLocal(w.face.clone()).sub(pivot.position).normalize();
        raised = new THREE.Quaternion().setFromUnitVectors(DOWN, local);
      } else {
        raised = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, side * 2.5));
      }
      pivot.quaternion.copy(rest).slerp(raised, THREE.MathUtils.clamp(up, 0, 1));
    }

    this.happyFor = Math.max(0, this.happyFor - dt);
    const u = this.mat.uniforms;
    gazeAt(this.body, lookAt, this.gaze);
    this.gaze.y = Math.max(-1, this.gaze.y - 0.25); // its face sits above the body's origin
    this.gazeNow.x = ease(this.gazeNow.x, this.gaze.x, 10, dt);
    this.gazeNow.y = ease(this.gazeNow.y, this.gaze.y, 10, dt);
    const happy = this.happyFor > 0;
    u.uLook!.value.set(this.gazeNow.x, this.gazeNow.y, happy ? -1 : this.blink.step(dt), 0);
    u.uMouth!.value.z = ease(u.uMouth!.value.z, happy ? 0.065 : 0.03, 10, dt);

    pushBlob(p.x, p.z, 0.17, 1.2);
  }
}
