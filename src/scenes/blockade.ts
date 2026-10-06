import * as THREE from 'three';
import { sfx } from '../audio/sound';
import { BREATH, Creature } from '../cast/creature';
import { ease } from '../cast/spring';
import { capsule, ellipsoid, place } from '../gfx/geo';
import type { Rescue } from '../cast/species';
import type { LayoutMode } from '../stage/framing';
import type { Glyph, GlyphLayer } from '../stage/glyphs';
import type { Blocker } from './detour';
import { Dust } from './dust';

// The big sleeper's part on the map. It snores at the side of the island
// while the little ones are woken and hurry aboard, opening one eye to watch
// each of them go. When the last is aboard and the companion sets off after
// them, it wakes, bounds over to the foot of the plank, reaches out, and
// lifts the plank over its head (mapCut.ts). It is the one nobody woke: grey
// like the little ones were, and put out about it. Nobody leaves until it has
// had its turn and got its colour back.

/** Asleep at the side, awake at the plank's foot, or no longer the map's to move. */
export type SleeperState = 'beside' | 'across' | 'gone';

/** How many times the size of a little one it is. */
export const SIZE = 2.7;
/** How long one eye stays open on whoever is walking by. */
const PEEK = 1.5;
/** Snores are heard for the first few breaths only, so they do not nag. */
const SNORES = 3;
const UP = new THREE.Vector3(0, 1, 0);
/** How far either side of the middle of its grip each hand goes: wide enough to clear its head. */
const HANDS = 1.1;

type Ground = (x: number, z: number) => number;

export class Blockade {
  readonly root = new THREE.Group();
  /** Where its stone goes: just in front of where it stands in the way. */
  readonly stone = new THREE.Vector3();
  /** Above its head, where it holds what it has taken. Follows it. */
  readonly hands = new THREE.Vector3();
  private who: Creature;
  private dust = new Dust(16);
  private beside = new THREE.Vector3();
  private across = new THREE.Vector3();
  private ground: Ground = () => 0;
  private leap = -1;
  private leapFor = 1;
  private peeking = 0;
  private breaths = 0;
  private watching: THREE.Vector3 | null = null;
  private zs: Array<{ glyph: Glyph; anchor: THREE.Object3D }> = [];
  private landed: (() => void) | null = null;
  // Two arms that stretch as far as they need to: from its shoulders to whatever it has hold of.
  private arms: THREE.Mesh[] = [];
  private mitts: THREE.Mesh[] = [];
  private grip: THREE.Object3D | null = null;
  private reach = 0;
  private reachFor = 0;
  private took: (() => void) | null = null;

  /** `left` is true until it has had its turn: no colour yet, and sulking once it is awake. */
  constructor(who: Rescue, private state: SleeperState, private left = true) {
    this.who = new Creature(who);
    this.who.root.scale.multiplyScalar(SIZE);
    this.who.drowse = state === 'beside' ? 0 : null;
    if (left) this.who.setColour(0);
    this.who.worried = left && state === 'across';
    // A unit-long arm from the shoulder up, stretched to length each frame, and a round mitt for its end.
    const arm = place(capsule(0.13, 1, who.coat.coat), [0, 0.5, 0]);
    const mitt = ellipsoid(0.21, 0.19, 0.21, who.coat.coat, 14);
    for (let i = 0; i < 2; i++) {
      this.arms.push(new THREE.Mesh(arm, this.who.skin));
      this.mitts.push(new THREE.Mesh(mitt, this.who.skin));
    }
    for (const part of [...this.arms, ...this.mitts]) {
      part.visible = false;
      this.root.add(part);
    }
    this.root.add(this.who.root, this.dust.root);
    this.root.visible = state !== 'gone';
  }

  get inTheWay(): boolean {
    return this.state === 'across' && this.leap < 0;
  }

  get at(): THREE.Vector3 {
    return this.who.root.position;
  }

  get blocker(): Blocker {
    return { x: this.at.x, z: this.at.z, r: this.state === 'gone' ? 0 : 1.2 };
  }

  /** Work out its two spots from where the plank meets the shore, and stand it on the right one. */
  moor(foot: THREE.Vector3, mode: LayoutMode, ground: Ground): void {
    this.ground = ground;
    // In front of the plank's foot as the child sees it, and never off the side of a narrow screen.
    const reach = mode === 'tall' ? 0.9 : 4;
    this.across.set(THREE.MathUtils.clamp(foot.x - 0.3, -reach, reach), 0, foot.z + 0.7);
    // Asleep at the right-hand side, well clear of the path to the ship.
    if (mode === 'tall') this.beside.set(this.across.x + 2.1, 0, this.across.z + 0.5);
    else this.beside.set(4.6, 0, -1.65);
    this.stone.set(this.across.x, 0, this.across.z + 0.75);
    if (this.state === 'gone') return;
    this.leap = -1;
    this.landed = null;
    this.who.root.rotation.z = 0;
    this.who.groundY = ground;
    const p = this.state === 'across' ? this.across : this.beside;
    this.who.place(p.x, p.z);
    this.raise();
  }

  /** Its snoring is drawn as letters, so it needs the glyph layer. */
  enter(glyphs: GlyphLayer): void {
    this.zs = [0, 1, 2].map(() => {
      const anchor = new THREE.Object3D();
      this.root.add(anchor);
      const glyph = glyphs.add('z', anchor, 0.5);
      glyph.el.classList.add('snore');
      glyph.opacity = 0;
      return { glyph, anchor };
    });
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

  private stretch(dt: number): void {
    const before = this.reach;
    this.reach = THREE.MathUtils.clamp(this.reach + (this.reachFor > 0 ? dt / 0.28 : -dt / 0.2), 0, 1);
    if (this.reach >= 1 && before < 1) {
      this.took?.();
      this.took = null;
    }
    const grip = this.grip;
    for (const part of [...this.arms, ...this.mitts]) part.visible = this.reach > 0.02 && !!grip;
    if (!grip || this.reach <= 0.02) return;
    const top = this.who.height * this.who.root.scale.y;
    // It takes hold of the thing where the thing is nearest to it, a hand either side of that
    // spot, the right hand always on the right however the thing is turned.
    const along = new THREE.Vector3(1, 0, 0).applyQuaternion(grip.quaternion);
    if (along.x < 0) along.negate();
    const half = Math.max(0, grip.scale.x * 0.45 - HANDS);
    const nearest = THREE.MathUtils.clamp(this.at.clone().sub(grip.position).dot(along), -half, half);
    this.arms.forEach((arm, i) => {
      const side = i === 0 ? -1 : 1;
      // The arm starts inside the body, so it always grows out of it and never floats beside it.
      const from = arm.position.set(this.at.x + side * 0.62, this.at.y + top * 0.42, this.at.z + 0.1);
      const to = grip.position.clone().addScaledVector(along, nearest + side * HANDS).sub(from).multiplyScalar(this.reach);
      this.mitts[i].position.copy(from).add(to);
      arm.scale.set(1, Math.max(0.05, to.length()), 1);
      arm.quaternion.setFromUnitVectors(UP, to.normalize());
    });
  }

  /** Open one eye on someone going by, then shut it again. */
  peek(at: THREE.Vector3): void {
    if (this.who.drowse === null || this.leap >= 0) return;
    this.peeking = PEEK;
    this.watching = at;
  }

  /** Wide awake all at once, and looking straight at `at`. */
  wake(at: THREE.Vector3): void {
    if (this.who.drowse === null) return;
    this.who.drowse = null;
    this.peeking = 0;
    this.watching = at;
    this.who.worried = this.left;
    this.who.nod();
  }

  /** Already awake and in the way, with no leap. */
  skip(): void {
    this.state = 'across';
    this.who.drowse = null;
    this.who.worried = this.left;
  }

  /** Bound over to the foot of the plank. `landed` is called as it hits the sand. */
  block(landed: () => void): void {
    if (this.state !== 'beside' || this.leap >= 0) return;
    this.wake(this.across);
    this.state = 'across';
    this.leap = 0;
    // A longer way to go is a longer, higher bound.
    this.leapFor = 0.45 + 0.07 * this.beside.distanceTo(this.across);
    this.landed = landed;
    sfx.whoosh();
  }

  /** Hand it over to someone else to move: it is no longer in the way, and the map stops driving it. */
  release(): Creature {
    this.state = 'gone';
    this.letGo();
    return this.who;
  }

  private raise(): void {
    this.hands.copy(this.at).y += this.who.height * this.who.root.scale.y + 0.12;
  }

  update(dt: number, camera: THREE.Camera): void {
    const who = this.who;
    this.dust.update(dt);
    if (this.state === 'gone') {
      this.stretch(dt);
      return this.snore(0);
    }
    if (this.leap >= 0) {
      this.leap += dt;
      const k = Math.min(1, this.leap / this.leapFor);
      const arc = Math.sin(k * Math.PI);
      const p = who.root.position;
      p.x = THREE.MathUtils.lerp(this.beside.x, this.across.x, k);
      p.z = THREE.MathUtils.lerp(this.beside.z, this.across.z, k);
      who.groundY = (x, z) => this.ground(x, z) + arc * (this.leapFor - 0.1) * 1.9;
      who.root.rotation.z = arc * 0.35; // leaning into it, and upright again as it lands
      if (k >= 1) {
        this.leap = -1;
        who.groundY = this.ground;
        who.root.rotation.z = 0;
        who.nod();
        sfx.thud();
        this.dust.burst(p, 14, 0.9, 1.1);
        this.landed?.();
        this.landed = null;
      }
    }
    const asleep = who.drowse !== null;
    this.peeking = Math.max(0, this.peeking - dt);
    who.lookTarget = asleep ? (this.peeking > 0 ? this.watching : null) : this.watching ?? camera.position;
    who.peek = ease(who.peek, asleep && this.peeking > 0.25 ? 0.8 : 0, 14, dt);
    who.update(dt);
    this.raise();
    this.stretch(dt);
    this.snore(asleep ? 1 - who.peek / 0.8 : 0);
  }

  /** A trail of z's drifting up from its head, one breath after another. `depth` is 0 when it is not asleep. */
  private snore(depth: number): void {
    const who = this.who;
    const breath = (who.age * BREATH) / (Math.PI * 2);
    if (depth > 0.9 && Math.floor(breath) > this.breaths && this.breaths++ < SNORES) sfx.snore();
    const top = who.height * who.root.scale.y;
    this.zs.forEach(({ glyph, anchor }, i) => {
      // Each one starts small at the head, a little after the last, and grows as it floats off.
      const k = (((breath - i * 0.17) % 1) + 1) % 1 / 0.8;
      // They drift toward the middle of the island, so they never leave the screen.
      const drift = this.at.x > 0 ? -1 : 1;
      anchor.position.set(this.at.x + drift * (0.45 + k * 0.5 + Math.sin(k * 5 + i) * 0.05), this.at.y + top * 0.8 + k * 0.8, this.at.z);
      glyph.scaleX = glyph.scaleY = 0.5 + 0.7 * k;
      glyph.tilt = drift * 0.12;
      glyph.opacity = k < 1 ? Math.min(1, Math.sin(k * Math.PI) * 1.6) * depth : 0;
    });
  }
}
