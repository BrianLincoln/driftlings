import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { toonMaterial, type ToonMaterial } from '../gfx/materials';
import { pushBlob } from '../gfx/uniforms';
import { Blinker, Spring, ease, squash } from './spring';
import { angleDelta, gazeAt } from './gaze';
import { sfx } from '../audio/sound';
import { creatureGeo } from './creatureParts';
import type { Rescue } from './species';

// The creature rig and behaviour. What it looks like comes from cast/species.ts.

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
  private headY = 0.56;
  private restYaw: number | null = null;
  private earLean = 0.55;
  private goal: THREE.Vector3 | null = null;
  private hopPhase = 0;
  private air = 0;
  private spin = 0;
  private happyFor = 0;
  private pause = 0;
  private gaze = { x: 0, y: 0 };
  private gazeNow = { x: 0, y: 0 };
  mood: Mood = 'idle';
  /** Null when wide awake. Otherwise 0 (fast asleep) to 1 (nearly awake): lids droop and the body sags. */
  drowse: number | null = null;
  /** What the eyes follow. Null looks straight ahead. */
  lookTarget: THREE.Vector3 | null = null;
  /** If set, the creature picks new spots to hop to inside this radius. */
  wanderRadius = 0;
  groundY: (x: number, z: number) => number = () => 0;

  /** If set, wandering stays around this spot rather than the scene origin. */
  home = new THREE.Vector3();
  readonly size: number;

  constructor(readonly who: Rescue) {
    const geo = creatureGeo(who.species, who.coat);
    const bodyMat = toonMaterial({ tag: TAG.creature, flag: -0.6 });
    this.body.add(new THREE.Mesh(geo.body, bodyMat));
    this.headMat = toonMaterial({ tag: TAG.creature, flag: -0.6, face: geo.face });
    this.head.add(new THREE.Mesh(geo.head, this.headMat));
    this.headY = geo.headY;
    this.head.position.set(0, geo.headY, 0.03);
    this.earLean = geo.earLean;
    if (geo.ear) {
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * geo.earPivot.x, geo.earPivot.y, geo.earPivot.z);
        pivot.rotation.z = -side * geo.earLean;
        pivot.add(new THREE.Mesh(geo.ear, bodyMat));
        this.head.add(pivot);
        this.ears.push(pivot);
      }
    }
    this.body.add(this.head);
    this.root.add(this.body);
    this.size = who.species.size;
    this.root.scale.setScalar(this.size);
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

  /** A small acknowledging bounce. */
  nod(): void {
    this.sq.kick(2.6);
    sfx.hop();
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
        this.goal = new THREE.Vector3(this.home.x + Math.sin(a) * r, 0, this.home.z + Math.cos(a) * r);
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
        this.restYaw = (Math.random() - 0.5) * 1.3;
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

    if (!this.goal && this.restYaw !== null) {
      this.yaw += angleDelta(this.yaw, this.restYaw) * (1 - Math.exp(-5 * dt));
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

    p.y = this.groundY(p.x, p.z) + lift * this.size;
    this.happyFor = Math.max(0, this.happyFor - dt);

    const sitting = this.mood === 'sit';
    const breathe = 1 + Math.sin(performance.now() * 0.0022 + p.x) * 0.012;
    const sag = this.drowse === null ? 1 : 0.78 + 0.2 * this.drowse + Math.sin(performance.now() * 0.0012) * 0.035;
    squash(this.body, this.sq.step((sitting ? 0.8 : 1) * breathe * sag, 180, 13, dt));
    this.head.position.y = ease(this.head.position.y, this.headY - (sitting ? 0.06 : 0), 10, dt);

    const flop = this.earSpring.step(-this.sq.v * 0.05 + (sitting ? 0.25 : 0), 90, 9, dt);
    this.ears.forEach((ear, i) => {
      const side = i === 0 ? -1 : 1;
      ear.rotation.x = flop;
      ear.rotation.z = -side * (this.earLean + flop * 0.6);
    });

    const u = this.headMat.uniforms;
    this.root.updateMatrixWorld();
    if (this.lookTarget) gazeAt(this.head, this.lookTarget, this.gaze);
    else this.gaze.x = this.gaze.y = 0;
    this.gazeNow.x = ease(this.gazeNow.x, this.gaze.x, 9, dt);
    this.gazeNow.y = ease(this.gazeNow.y, this.gaze.y, 9, dt);
    const happy = this.happyFor > 0;
    const awake = this.blink.step(dt);
    const lid = this.drowse === null ? awake : Math.min(awake, 0.06 + 0.7 * this.drowse * this.drowse);
    u.uLook!.value.set(this.gazeNow.x, this.gazeNow.y, happy ? -1 : lid, 0);
    u.uMouth!.value.z = ease(u.uMouth!.value.z, happy ? 0.07 : 0.035, 10, dt);
    u.uBlush!.value.w = ease(u.uBlush!.value.w, happy ? 0.85 : 0.45, 6, dt);

    pushBlob(p.x, p.z, 0.27 * this.size * (1 - Math.min(0.5, lift)), 1.25);
  }
}
