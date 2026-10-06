import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { ellipsoid, lathe, merge, place } from '../gfx/geo';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';
import { pushBlob } from '../gfx/uniforms';
import { Blinker, Spring, ease, squash } from './spring';
import { angleDelta, gazeAt } from './gaze';
import { sfx } from '../audio/sound';

// One creature recipe. A species is this shape; a rescue is a species plus a
// CreatureLook, so a hundred rescues do not need a hundred designs.

export interface CreatureLook {
  coat: string;
  belly: string;
  ear: string;
  sprig: string;
  /** Ear length multiplier. */
  earLength: number;
  size: number;
}

export const LOOKS: Record<string, CreatureLook> = {
  apricot: { coat: '#e8b48a', belly: '#f7e6cf', ear: '#d99a78', sprig: '#8fa862', earLength: 1, size: 1 },
  slate: { coat: '#a9b4c6', belly: '#eef0ee', ear: '#8e9ab2', sprig: '#d9b25c', earLength: 1.25, size: 0.9 },
  moss: { coat: '#b7c08c', belly: '#f3efd6', ear: '#98a56f', sprig: '#e39a86', earLength: 0.8, size: 1.1 },
};

type Mood = 'idle' | 'happy' | 'sit';

export class Creature {
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();
  private body = new THREE.Group();
  private ears: THREE.Group[] = [];
  private headMat: ToonMaterial;
  private sq = new Spring(1);
  private earSpring = new Spring(0);
  private blink = new Blinker();
  private yaw = 0;
  private goal: THREE.Vector3 | null = null;
  private hopPhase = 0;
  private air = 0;
  private spin = 0;
  private happyFor = 0;
  private pause = 0;
  private gaze = { x: 0, y: 0 };
  private gazeNow = { x: 0, y: 0 };
  mood: Mood = 'idle';
  /** What the eyes follow. Null looks straight ahead. */
  lookTarget: THREE.Vector3 | null = null;
  /** If set, the creature picks new spots to hop to inside this radius. */
  wanderRadius = 0;
  groundY: (x: number, z: number) => number = () => 0;

  constructor(readonly look: CreatureLook) {
    const coat = look.coat;
    const bodyGeo = merge(
      lathe([[0, 0.02], [0.2, 0.03], [0.27, 0.16], [0.25, 0.32], [0.17, 0.44], [0, 0.5]],
        (p, n) => (n.z > 0.45 && p.y < 0.4 ? look.belly : coat)),
      place(ellipsoid(0.09, 0.05, 0.13, look.ear), [0.13, 0.04, 0.13]),
      place(ellipsoid(0.09, 0.05, 0.13, look.ear), [-0.13, 0.04, 0.13]),
      place(ellipsoid(0.06, 0.11, 0.06, coat), [0.25, 0.25, 0.04], [0, 0, 0.5]),
      place(ellipsoid(0.06, 0.11, 0.06, coat), [-0.25, 0.25, 0.04], [0, 0, -0.5]),
      place(ellipsoid(0.09, 0.09, 0.09, look.belly), [0, 0.15, -0.27]),
    );
    const bodyMat = toonMaterial({ tag: TAG.creature, flag: -0.6 });
    this.body.add(new THREE.Mesh(bodyGeo, bodyMat));

    this.headMat = toonMaterial({
      tag: TAG.creature,
      flag: -0.6,
      face: {
        origin: [0, 0, 0],
        eye: [0.38, 0.04, 0.215, 0.28],
        pupil: [0.13, 0.17, 0.07, 0.07],
        mouth: [-0.4, 0.12],
        blush: [0.66, -0.24, 0.13],
      },
    });
    const headGeo = merge(
      ellipsoid(0.28, 0.24, 0.25, coat, 40),
      // The sprig: a small two-leaf sprout, this species' silhouette hook.
      place(ellipsoid(0.035, 0.09, 0.02, look.sprig), [0.045, 0.28, 0], [0, 0, -0.6]),
      place(ellipsoid(0.03, 0.07, 0.02, look.sprig), [-0.035, 0.27, 0], [0, 0, 0.7]),
    );
    this.head.add(new THREE.Mesh(headGeo, this.headMat));
    this.head.position.set(0, 0.56, 0.03);

    const earLen = 0.19 * look.earLength;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.17, 0.14, -0.02);
      pivot.rotation.z = -side * 0.55;
      const geo = place(ellipsoid(0.075, earLen, 0.04, (_p, n) => (n.z > 0.5 ? look.belly : look.ear)), [0, earLen * 0.85, 0]);
      pivot.add(new THREE.Mesh(geo, bodyMat));
      this.head.add(pivot);
      this.ears.push(pivot);
    }
    this.body.add(this.head);
    this.root.add(this.body);
    this.root.scale.setScalar(look.size);
    this.yaw = this.root.rotation.y;
  }

  place(x: number, z: number, yaw = 0): this {
    this.root.position.set(x, this.groundY(x, z), z);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
    return this;
  }

  hopTo(x: number, z: number): void {
    this.goal = new THREE.Vector3(x, 0, z);
  }

  /** The tap reaction: a jump, a spin, happy eyes and a coo. */
  react(): void {
    if (this.spin > 0) return;
    this.air = 0.0001;
    this.spin = Math.PI * 2;
    this.happyFor = 1.6;
    this.sq.kick(4);
    sfx.coo();
  }

  sit(): void {
    this.mood = 'sit';
    this.goal = null;
    this.sq.kick(-3.5);
    this.happyFor = 2.4;
  }

  stand(): void {
    this.mood = 'idle';
    this.sq.kick(2.5);
  }

  update(dt: number): void {
    const p = this.root.position;
    let lift = 0;

    if (this.wanderRadius > 0 && !this.goal && this.mood === 'idle' && this.spin <= 0) {
      this.pause -= dt;
      if (this.pause <= 0) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * this.wanderRadius;
        this.goal = new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r);
        this.pause = 1.5 + Math.random() * 4;
      }
    }

    if (this.goal && this.spin <= 0) {
      const dx = this.goal.x - p.x;
      const dz = this.goal.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.08) {
        this.goal = null;
        this.hopPhase = 0;
      } else {
        this.yaw += angleDelta(this.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-8 * dt));
        const before = this.hopPhase;
        this.hopPhase += dt * 2.6;
        const inAir = this.hopPhase % 1;
        lift = Math.sin(inAir * Math.PI) * 0.17;
        const step = Math.min(dist, 1.5 * dt);
        p.x += Math.sin(this.yaw) * step;
        p.z += Math.cos(this.yaw) * step;
        if (Math.floor(before) !== Math.floor(this.hopPhase)) this.sq.kick(-2.2); // landing
      }
    }

    if (this.spin > 0) {
      // A fixed 0.55 s jump-and-spin.
      this.air += dt;
      const k = Math.min(1, this.air / 0.55);
      lift = Math.sin(k * Math.PI) * 0.42;
      this.root.rotation.y = this.yaw + k * Math.PI * 2;
      if (k >= 1) {
        this.spin = 0;
        this.sq.kick(-3);
      }
    } else {
      this.root.rotation.y = this.yaw;
    }

    p.y = this.groundY(p.x, p.z) + lift * this.look.size;
    this.happyFor = Math.max(0, this.happyFor - dt);

    const sitting = this.mood === 'sit';
    const breathe = 1 + Math.sin(performance.now() * 0.0022 + p.x) * 0.012;
    squash(this.body, this.sq.step((sitting ? 0.8 : 1) * breathe, 180, 13, dt));
    this.head.position.y = ease(this.head.position.y, sitting ? 0.5 : 0.56, 10, dt);

    const flop = this.earSpring.step(-this.sq.v * 0.05 + (sitting ? 0.25 : 0), 90, 9, dt);
    this.ears[0].rotation.x = flop;
    this.ears[1].rotation.x = flop;
    this.ears[0].rotation.z = 0.55 + flop * 0.6;
    this.ears[1].rotation.z = -0.55 - flop * 0.6;

    const u = this.headMat.uniforms;
    this.root.updateMatrixWorld();
    if (this.lookTarget) gazeAt(this.head, this.lookTarget, this.gaze);
    else this.gaze.x = this.gaze.y = 0;
    this.gazeNow.x = ease(this.gazeNow.x, this.gaze.x, 9, dt);
    this.gazeNow.y = ease(this.gazeNow.y, this.gaze.y, 9, dt);
    const happy = this.happyFor > 0;
    u.uLook!.value.set(this.gazeNow.x, this.gazeNow.y, happy ? -1 : this.blink.step(dt), 0);
    u.uMouth!.value.z = ease(u.uMouth!.value.z, happy ? 0.07 : 0.035, 10, dt);
    u.uBlush!.value.w = ease(u.uBlush!.value.w, happy ? 0.85 : 0.45, 6, dt);

    pushBlob(p.x, p.z, 0.27 * this.look.size * (1 - Math.min(0.5, lift)), 1.25);
  }
}
