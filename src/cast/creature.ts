import * as THREE from 'three';
import type { ToonMaterial } from '../gfx/materials';
import { pushBlob } from '../gfx/uniforms';
import { Blinker, Spring, ease, squash } from './spring';
import { angleDelta, gazeAt } from './gaze';
import { sfx } from '../audio/sound';
import { Colour, WAKE_DIP } from './creatureColour';
import { buildRig } from './creatureRig';
import { WHIRL, stepWhirl, type Whirling } from './creatureWhirl';
import type { Rescue } from './species';

// The creature rig and behaviour. What it looks like comes from cast/species.ts.

type Mood = 'idle' | 'happy' | 'sit';

/** Creatures are little ones beside the companion, everywhere. */
const LITTLE = 0.62;
/** How fast a sleeper breathes, in radians a second. */
export const BREATH = 1.6;

export class Creature {
  readonly root = new THREE.Group();
  readonly head: THREE.Group;
  private body: THREE.Group;
  private ears: THREE.Group[];
  private headMat: ToonMaterial;
  private mats: ToonMaterial[];
  /** Standing height, before the root's scale. */
  readonly height: number;
  private tint = new Colour();
  private sq = new Spring(1);
  private earSpring = new Spring(0);
  private blink = new Blinker();
  private yaw = 0;
  private headY: number;
  private restYaw: number | null = null;
  private earLean: number;
  private goal: THREE.Vector3 | null = null;
  private hopPhase = 0;
  private air = 0;
  private spin = 0;
  private happyFor = 0;
  private pause = 0;
  private whirling: Whirling | null = null;
  private gaze = { x: 0, y: 0 };
  private gazeNow = { x: 0, y: 0 };
  mood: Mood = 'idle';
  /** Null when wide awake. Otherwise 0 (fast asleep) to 1 (nearly awake): lids droop and the body sags. */
  drowse: number | null = null;
  /** Something is wrong: a turned-down mouth and no smiles. */
  worried = false;
  /** One eye open this far (0 to 1) whatever the other is doing. */
  peek = 0;
  /** Seconds it has been around; a sleeper's breathing runs on this. */
  age = 0;
  /**
   * How much of it has its colour, from the feet up. 1 is wide awake, as at home;
   * 0 is dormant, as they all are far from it.
   */
  get colour(): number {
    return this.tint.colour;
  }
  set colour(k: number) {
    this.tint.colour = k;
  }
  /** What the eyes follow. Null looks straight ahead. */
  lookTarget: THREE.Vector3 | null = null;
  /** How fast it hops along: 1 is an amble. */
  pace = 1;
  /** If set, the creature picks new spots to hop to inside this radius. */
  wanderRadius = 0;
  groundY: (x: number, z: number) => number = () => 0;

  /** If set, wandering stays around this spot rather than the scene origin. */
  home = new THREE.Vector3();
  /** The way it turns, more or less, when it gets where it is going and nobody says otherwise. */
  facing = 0;
  readonly size: number;
  /** Its body material, for anything extra that should share its colour and its greyness. */
  readonly skin: ToonMaterial;

  constructor(readonly who: Rescue) {
    const rig = buildRig(who, this.root);
    this.body = rig.body;
    this.head = rig.head;
    this.ears = rig.ears;
    this.headMat = rig.headMat;
    this.headY = rig.headY;
    this.earLean = rig.earLean;
    this.mats = [rig.bodyMat, rig.headMat];
    this.skin = rig.bodyMat;
    this.height = new THREE.Box3().setFromObject(this.root).max.y;
    this.size = who.species.size * LITTLE;
    this.root.scale.setScalar(this.size);
    this.yaw = this.root.rotation.y;
  }

  place(x: number, z: number, yaw = 0): this {
    this.root.position.set(x, this.groundY(x, z), z);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
    return this;
  }

  /** Come round to face this way and stay so, or be facing it `atOnce`. */
  turnTo(yaw: number, atOnce = false): void {
    this.restYaw = yaw;
    if (atOnce) this.yaw = yaw;
  }

  hopTo(x: number, z: number): void {
    this.goal = new THREE.Vector3(x, 0, z);
  }

  /** On its way somewhere. */
  get moving(): boolean {
    return this.goal !== null;
  }

  /** Stop where it is. */
  halt(): void {
    this.goal = null;
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

  /**
   * A quick whirlwind: leap down to a spot, spin there like a top, leap back.
   * `kick` is called on landing and again and again through the spin, for
   * whatever the feet throw up. Returns the seconds until it lands, and until
   * it is off the spot again and on its way back.
   */
  whirl(to: THREE.Vector3, kick: () => void): { lands: number; clear: number } {
    if (this.whirling) return { lands: 0, clear: 0 };
    this.goal = null;
    this.spin = 0;
    this.whirling = { t: 0, home: this.root.position.clone(), to: to.clone(), puffAt: WHIRL.down, kick };
    this.happyFor = WHIRL.down + WHIRL.spin + WHIRL.back;
    this.sq.kick(4);
    sfx.whoosh();
    return { lands: WHIRL.down, clear: WHIRL.down + WHIRL.spin + WHIRL.back * 0.6 };
  }

  /** Set how much colour it has at once, with no rise. */
  setColour(k: number): void {
    this.tint.set(k);
  }

  /**
   * Fully awake: the colour sinks back while it braces and shivers for `hold`
   * seconds, then bursts out with a jump and a spin. `woke` is called at the burst.
   */
  wake(hold = WAKE_DIP, woke?: () => void): void {
    this.tint.wake(hold, woke);
  }

  /** A small acknowledging bounce. */
  nod(quiet = false): void {
    this.sq.kick(2.6);
    if (!quiet) sfx.hop();
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

    if (this.whirling && stepWhirl(this.whirling, dt, this.root, this.yaw, this.sq)) this.whirling = null;

    if (this.wanderRadius > 0 && !this.goal && this.mood === 'idle' && this.spin <= 0 && !this.whirling) {
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
        this.restYaw = this.facing + (Math.random() - 0.5) * 1.3;
      } else {
        this.yaw += angleDelta(this.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-8 * this.pace * dt));
        const before = this.hopPhase;
        this.hopPhase += dt * 2.6 * Math.sqrt(this.pace);
        const inAir = this.hopPhase % 1;
        lift = Math.sin(inAir * Math.PI) * 0.17;
        const step = Math.min(dist, 1.5 * this.pace * dt);
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
    } else if (!this.whirling) {
      this.root.rotation.y = this.yaw;
    }

    if (!this.whirling) p.y = this.groundY(p.x, p.z) + lift * this.size;
    this.happyFor = Math.max(0, this.happyFor - dt);

    const sitting = this.mood === 'sit';
    const breathe = 1 + Math.sin(performance.now() * 0.0022 + p.x) * 0.012;
    this.tint.step(dt, this.root, this.height, this.mats, () => {
      this.spin = 0;
      this.react();
    });
    // Bracing to wake: it sinks lower and shivers harder until the burst.
    const brace = this.tint.waking >= 0 ? 1 - this.tint.waking / this.tint.wakeFor : 0;
    const crouch = 1 - 0.24 * brace;
    this.body.position.x = brace * brace * 0.035 * Math.sin(performance.now() * 0.07);
    this.age += dt;
    // Asleep, the whole body rises and falls with each slow breath; deepest when fast asleep.
    const sag = crouch * (this.drowse === null ? 1 : 0.78 + 0.2 * this.drowse + Math.sin(this.age * BREATH) * (0.07 - 0.04 * this.drowse));
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
    const happy = this.happyFor > 0 && !this.worried;
    const awake = this.blink.step(dt);
    const lid = this.drowse === null ? awake : Math.min(awake, 0.06 + 0.7 * this.drowse * this.drowse);
    u.uLook!.value.set(this.gazeNow.x, this.gazeNow.y, happy ? -1 : lid, happy ? 0 : this.peek);
    u.uMouth!.value.z = ease(u.uMouth!.value.z, this.worried ? -0.05 : happy ? 0.07 : 0.035, 10, dt);
    u.uBlush!.value.w = ease(u.uBlush!.value.w, happy ? 0.85 : 0.45, 6, dt);

    pushBlob(p.x, p.z, 0.27 * this.size * (1 - Math.min(0.5, lift)), 1.25);
  }
}
