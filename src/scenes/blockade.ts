import * as THREE from 'three';
import { sfx } from '../audio/sound';
import { BREATH, Creature } from '../cast/creature';
import { ease } from '../cast/spring';
import type { BigOne, Manner } from '../game/areas';
import type { LayoutMode } from '../stage/framing';
import type { Glyph, GlyphLayer } from '../stage/glyphs';
import type { Blocker } from './detour';
import { Dust } from './dust';
import { Reach } from './reach';

// The big one's part on the map. Until the end it keeps to the side of the
// island while the little ones are woken and hurry aboard, each in its own
// manner (game/areas.ts): a sleepy one snores, and opens one eye to watch each
// of them go; a watchful one sits there wide awake and glum, and turns to see
// each of them off; a restless one paces its bit of shore and stops short to
// stare; a huffy one has its back to the lot of them, and only looks round
// when it thinks nobody will see; a stirring one starts asleep and works its
// way through the rest as the ship fills. When the last is aboard and the
// companion sets off after them, it starts up, bounds over to the foot of the
// plank, reaches out, and lifts the plank over its head (mapCut.ts). It is the
// one nobody came for: grey like the little ones were, and put out about it.
// Nobody leaves until it has had its turn and got its colour back.

/** Asleep at the side, awake at the plank's foot, or no longer the map's to move. */
export type SleeperState = 'beside' | 'across' | 'gone';

/** How many times the size of a little one it is. */
export const SIZE = 2.7;
/** How long one eye stays open on whoever is walking by. */
const PEEK = 1.5;
/** Snores are heard for the first few breaths only, so they do not nag. */
const SNORES = 3;
/** What it is doing at the side for now. A stirring one goes through the first three as the little ones go. */
type Mood = Exclude<Manner, 'stirring'>;
const STIRS: Mood[] = ['sleepy', 'sleepy', 'watchful', 'restless'];
/** A restless one's beat: how far each way along its shore it goes (toward the middle of a wide screen, toward us on a tall one), and how often it turns. */
const BEAT = { wide: [-0.2, 1.3], tall: [-0.2, 1.3], every: 2.5 };
/** How far round a huffy one is turned from facing us. */
const BACK = Math.PI - 0.55;

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
  private reach: Reach;
  private mood: Mood;
  /** Which way its beat runs, and which end of it comes next and when. */
  private beat = { x: 1, z: 0, ends: BEAT.wide, next: 1, turn: 1 };
  /** True once it has noticed it is being left behind: from then on it has eyes only for whoever it noticed. */
  private roused: boolean;
  private sleepy: boolean;

  /**
   * `left` is true until it has had its turn: no colour yet, and sulking whenever it is awake.
   * `gone` is how many of the little ones have been woken, as a share of them all.
   */
  constructor(big: BigOne, private state: SleeperState, private left = true, gone = 0) {
    this.mood = big.manner === 'stirring' ? STIRS[Math.min(STIRS.length - 1, Math.floor(gone * STIRS.length))] : big.manner;
    this.sleepy = this.mood === 'sleepy';
    this.roused = state !== 'beside';
    this.who = new Creature(big.who);
    this.who.root.scale.multiplyScalar(SIZE);
    this.who.drowse = state === 'beside' && this.sleepy ? 0 : null;
    if (left) this.who.setColour(0);
    this.who.worried = left && this.who.drowse === null;
    this.reach = new Reach(this.who);
    this.root.add(...this.reach.parts, this.who.root, this.dust.root);
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
  moor(foot: THREE.Vector3, mode: LayoutMode, ground: Ground, side: 1 | -1 = 1): void {
    this.ground = ground;
    // In front of the plank's foot as the child sees it, and never off the side of a narrow screen.
    const reach = mode === 'tall' ? 0.9 : 4;
    this.across.set(THREE.MathUtils.clamp(foot.x - 0.3, -reach, reach), 0, foot.z + 0.7);
    // Until then it keeps to one side, well clear of the path to the ship. A narrow screen only has room on the right.
    if (mode === 'tall') this.beside.set(this.across.x + 2.1, 0, this.across.z + 0.5);
    else this.beside.set(side * 4.6, 0, -1.65);
    this.stone.set(this.across.x, 0, this.across.z + 0.75);
    if (this.state === 'gone') return;
    this.leap = -1;
    this.landed = null;
    this.who.root.rotation.z = 0;
    this.who.groundY = ground;
    const p = this.state === 'across' ? this.across : this.beside;
    // With its back to everyone, but turned a little toward the middle, so its face is not quite hidden.
    this.who.place(p.x, p.z, this.aloof ? (p.x > 0 ? -BACK : BACK) : 0);
    const tall = mode === 'tall';
    Object.assign(this.beat, { x: tall ? 0 : -Math.sign(this.beside.x), z: tall ? 1 : 0, ends: tall ? BEAT.tall : BEAT.wide });
    this.raise();
  }

  /** Its snoring is drawn as letters, so it needs the glyph layer. */
  enter(glyphs: GlyphLayer): void {
    if (!this.sleepy) return;
    this.zs = [0, 1, 2].map(() => {
      const anchor = new THREE.Object3D();
      this.root.add(anchor);
      const glyph = glyphs.add('z', anchor, 0.5);
      glyph.el.classList.add('snore');
      glyph.opacity = 0;
      return { glyph, anchor };
    });
  }

  /** Reach out with both arms and take hold of `thing`: see reach.ts. */
  grab(thing: THREE.Object3D, took?: () => void, atOnce = false): void {
    this.reach.grab(thing, took, atOnce);
  }

  /** A huffy one that has not been roused yet: back turned, looking at nobody. */
  private get aloof(): boolean {
    return this.mood === 'huffy' && this.state === 'beside' && !this.roused;
  }

  private face(at: THREE.Vector3 | null): void {
    this.who.turnTo(at ? Math.atan2(at.x - this.at.x, at.z - this.at.z) * 0.7 : 0);
  }

  /** Open one eye on someone going by, then shut it again. One that is awake turns to see them off. */
  peek(at: THREE.Vector3): void {
    if (this.roused || this.leap >= 0) return;
    this.peeking = this.sleepy ? PEEK : PEEK * 2;
    this.watching = at;
    if (this.sleepy) return;
    // Stopped short in the middle of its beat; or a look over its shoulder, which is all a huffy one will give.
    this.who.halt();
    if (this.mood !== 'watchful') this.face(at);
    if (this.mood !== 'huffy') this.who.nod();
  }

  /** Wide awake all at once, and looking straight at `at`. */
  wake(at: THREE.Vector3): void {
    if (this.roused) return;
    this.roused = true;
    this.who.drowse = null;
    this.peeking = 0;
    this.watching = at;
    this.who.worried = this.left;
    this.who.halt();
    this.face(null);
    this.who.nod();
  }

  /** Already awake and in the way, with no leap. */
  skip(): void {
    this.state = 'across';
    this.roused = true;
    this.who.drowse = null;
    this.who.worried = this.left;
  }

  /** Bound over to the foot of the plank. `landed` is called as it hits the sand. */
  block(landed: () => void): void {
    if (this.state !== 'beside' || this.leap >= 0) return;
    this.wake(this.across);
    this.state = 'across';
    this.leap = 0;
    // From wherever on its beat it has got to. A longer way to go is a longer, higher bound.
    this.beside.copy(this.at).setY(0);
    this.leapFor = 0.45 + 0.07 * this.beside.distanceTo(this.across);
    this.landed = landed;
    sfx.whoosh();
  }

  /** Hand it over to someone else to move: it is no longer in the way, and the map stops driving it. */
  release(): Creature {
    this.state = 'gone';
    this.reach.letGo();
    return this.who;
  }

  private raise(): void {
    this.hands.copy(this.at).y += this.who.height * this.who.root.scale.y + 0.12;
  }

  update(dt: number, camera: THREE.Camera): void {
    const who = this.who;
    this.dust.update(dt);
    if (this.state === 'gone') {
      this.reach.update(dt);
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
    const idle = !this.roused && this.peeking <= 0;
    if (idle && this.state === 'beside') this.fidget(dt);
    who.lookTarget = asleep ? (idle ? null : this.watching) : idle ? (this.aloof ? null : camera.position) : this.watching ?? camera.position;
    who.peek = ease(who.peek, asleep && this.peeking > 0.25 ? 0.8 : 0, 14, dt);
    who.update(dt);
    this.raise();
    this.reach.update(dt);
    this.snore(asleep ? 1 - who.peek / 0.8 : 0);
  }

  /** What it does with itself while nobody is going by: a restless one walks its beat, a huffy one turns its back again. */
  private fidget(dt: number): void {
    const b = this.beat;
    if (this.mood === 'huffy') this.who.turnTo(this.at.x > 0 ? -BACK : BACK);
    if (this.mood !== 'restless' || (b.next -= dt) > 0) return;
    b.next = BEAT.every;
    b.turn = -b.turn;
    const far = b.ends[b.turn > 0 ? 1 : 0];
    this.who.hopTo(this.beside.x + b.x * far, this.beside.z + b.z * far);
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
