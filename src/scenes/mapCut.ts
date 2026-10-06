import * as THREE from 'three';
import { sfx } from '../audio/sound';
import type { Companion } from '../cast/companion';
import { Spring } from '../cast/spring';
import type { Framing } from '../stage/framing';
import type { Blockade } from './blockade';
import { routeAround, type Blocker, type Spot } from './detour';
import { BOW, STEP_UP, type Ship } from './ship';

// The two little scenes on the map at the end of an area.
//
// THE PLANK: the last creature has gone aboard. The camera closes in on the
// companion; it gives the sleeper a sideways look and sets off for the plank,
// round the stones like everyone else. The sleeper wakes, bounds over, lands
// at the foot of the plank, reaches out and lifts it away. Everyone aboard is
// horrified.
//
// FRIENDS: the sleeper has been won over. It lays the plank back, everyone
// cheers, it bounds onto the raft astern, the companion goes up the plank,
// and they are ready to sail.

type Beat = 'none' | 'wait' | 'eye' | 'go' | 'wake' | 'drop' | 'land' | 'crew' | 'bud' | 'back' | 'board' | 'follow' | 'sail';

/** Seconds each held beat lasts. */
const FOR = { eye: 1.6, wake: 0.7, land: 2.4, crew: 2.0, bud: 1.0, back: 1.1, sail: 1.7 };
/** How near the plank the companion gets before the sleeper wakes. It stops well short of where the sleeper lands. */
const TOO_NEAR = 3.6;
/**
 * The shots, each a stage box (width, height) and how far the camera drops toward the
 * ground (0 to 1). The walk is followed from higher up so the letter tiles do not hide it,
 * and the crew is seen from higher up so the sleeper in front of the ship does not hide them.
 */
const SHOT = { eye: [2.6, 2.0, 1], walk: [4.6, 3.4, 0], sleeper: [4.2, 3.2, 0.7], land: [6.0, 4.2, 0.8], crew: [4.8, 2.8, 0], shore: [10.5, 6.2, 0.3], tow: [12.6, 6.6, 0.3] };

export interface MapCutCast {
  companion: Companion;
  sleeper: Blockade;
  ship: Ship;
  ground(x: number, z: number): number;
  /** Where the companion waits while the last creature goes aboard. */
  waitAt(): THREE.Vector3;
  /** Where the companion stands by the sleeper's stone. */
  stoneSide(): THREE.Vector3;
  /** Everything on the island to walk round. */
  blockers(): Blocker[];
  /** The plank scene is over: the map carries on with the sleeper in the way. */
  over(): void;
  /** The friends scene is over: time to go home. */
  sailed(): void;
}

export class MapCut {
  private beat: Beat;
  private clock = 0;
  private route: Spot[] = [];
  private close = new Spring(0);
  private goal = 0;
  private focus = new THREE.Vector3();
  private aim = new THREE.Vector3();
  private shot = [...SHOT.eye];

  constructor(private cast: MapCutCast, scene: 'plank' | 'friends' | null) {
    this.beat = scene === 'plank' ? 'wait' : scene === 'friends' ? 'bud' : 'none';
  }

  /** True while a scene has the companion: the map leaves it alone. */
  get playing(): boolean {
    return this.beat !== 'none';
  }

  get reframing(): boolean {
    return this.goal > 0 || Math.abs(this.close.x) > 1e-3 || Math.abs(this.close.v) > 1e-3;
  }

  /** The sleeper stands in the way with the plank held over its head, and the crew frets. */
  private taken(atOnce: boolean): void {
    const { ship, sleeper } = this.cast;
    if (atOnce) sleeper.grab(ship.plank, undefined, true);
    ship.hold(sleeper.hands, atOnce);
    ship.fret(true);
  }

  /** Put everyone where this moment has them. Call on layout. */
  pose(): void {
    const { companion, sleeper } = this.cast;
    const want = companion.want;
    if (this.beat === 'none') {
      if (sleeper.inTheWay) this.taken(true);
    } else if (this.beat === 'wait' || this.beat === 'bud') {
      if (this.beat === 'bud') this.taken(true);
      want.at.copy(this.beat === 'wait' ? this.cast.waitAt() : this.cast.stoneSide());
      want.face = null;
      want.pose = 'stand';
    } else if (this.beat !== 'back' && this.beat !== 'board' && this.beat !== 'follow' && this.beat !== 'sail') {
      // The screen turned in the middle of the plank scene: skip to the end of it.
      sleeper.skip();
      this.taken(true);
      this.beat = 'none';
      this.goal = this.close.x = this.close.v = 0;
      want.glance = null;
    }
  }

  /** Close the map's stage box in on the action. */
  frame(f: Framing): Framing {
    const k = this.close.x;
    if (k === 0) return f;
    f.center.lerp(this.focus, k);
    // Every shot closes in, but for the one that has to take in ship and raft together.
    f.width = THREE.MathUtils.lerp(f.width, this.last === SHOT.tow ? this.shot[0] : Math.min(f.width, this.shot[0]), k);
    f.height = THREE.MathUtils.lerp(f.height, Math.min(f.height, this.shot[1]), k);
    f.elevation = THREE.MathUtils.lerp(f.elevation, 12, k * this.shot[2]);
    return f;
  }

  /** Walk the companion along its route. True once it is at the end. */
  private walk(): boolean {
    const me = this.cast.companion.root.position;
    const near = () => Math.hypot(this.route[0].x - me.x, this.route[0].z - me.z) < 0.2;
    if (this.route.length > 1 && near()) this.route.shift();
    this.cast.companion.want.at.set(this.route[0].x, 0, this.route[0].z);
    return this.route.length === 1 && near();
  }

  update(dt: number, aboard: boolean): void {
    const { companion, sleeper, ship } = this.cast;
    const me = companion.root.position;
    const want = companion.want;
    this.clock += dt;
    const to = (beat: Beat) => {
      this.beat = beat;
      this.clock = 0;
    };
    const held = (beat: keyof typeof FOR) => this.beat === beat && this.clock > FOR[beat];
    let shot = SHOT.eye;
    this.aim.set(me.x, me.y + 0.3, me.z);

    if (this.beat === 'wait' && aboard) {
      to('eye');
      this.goal = 1;
      this.focus.copy(this.aim);
      want.glance = sleeper.at;
    } else if (held('eye')) {
      to('go');
      want.glance = null;
      this.route = routeAround(me, ship.shore, this.cast.blockers());
    } else if (this.beat === 'go') {
      shot = SHOT.walk;
      if (this.walk() || Math.hypot(me.x - sleeper.stone.x, me.z - sleeper.stone.z) < TOO_NEAR) {
        to('wake');
        sleeper.wake(me);
      }
    } else if (this.beat === 'wake') {
      // Cut to the sleeper: both eyes open.
      shot = SHOT.sleeper;
      this.aim.copy(sleeper.at).y += 1;
      this.walk();
      if (held('wake')) {
        to('drop');
        want.at.copy(me).setY(0); // stopped in its tracks, watching it come
        want.glance = sleeper.at;
        sleeper.block(() => {
          to('land');
          this.close.kick(-3); // the camera jolts with the thud
          companion.act('startle');
        });
      }
    } else if (this.beat === 'drop' || this.beat === 'land') {
      shot = SHOT.land;
      this.aim.set((me.x + sleeper.stone.x) / 2, me.y + 1.2, (me.z + sleeper.stone.z) / 2);
      // A moment to take it in; then out go the arms, and up comes the plank.
      if (this.beat === 'land' && this.clock > 0.55 && !this.reached) {
        this.reached = true;
        sleeper.grab(ship.plank, () => this.taken(false));
      }
      if (held('land')) to('crew');
    } else if (this.beat === 'crew') {
      // Cut to the ship: oh no.
      shot = SHOT.crew;
      this.aim.copy(ship.deck(0)).y += 0.5;
      if (held('crew')) {
        to('none');
        this.goal = 0;
        want.glance = null;
        this.cast.over();
      }
    } else if (held('bud')) {
      to('back');
      this.goal = 0.85;
      ship.hold(null);
      ship.fret(false);
      ship.cheer();
      sfx.sparkle();
    } else if (held('back')) {
      to('board');
      ship.boardRaft(sleeper.release());
    } else if (this.beat === 'board' && ship.settled) {
      to('follow');
      this.route = [ship.shore, ship.rail, ship.deck(...STEP_UP), ship.deck(BOW)];
    } else if (this.beat === 'follow') {
      // Up the plank and onto the deck, the same way everyone else went.
      // Across the sand, up the plank, along the main deck, and a hop up onto the forecastle.
      const deck = this.route[0] as THREE.Vector3;
      companion.groundY = this.route.length === 4 ? this.cast.ground : this.route.length === 3 ? ship.plankY : () => deck.y;
      if (this.walk()) {
        to('sail');
        companion.act('celebrate');
        ship.cheer();
      }
    } else if (held('sail')) {
      to('none');
      this.cast.sailed();
    }
    if (this.beat === 'bud' || this.beat === 'back' || this.beat === 'board' || this.beat === 'follow' || this.beat === 'sail') {
      shot = SHOT.shore;
      this.aim.copy(ship.shore).lerp(ship.rail, 0.6).y += 1.7;
      if (this.beat !== 'bud' && this.beat !== 'back' && ship.raft) {
        shot = SHOT.tow;
        this.aim.copy(ship.raft.seat()).lerp(ship.deck(BOW), 0.5).y += 1.5;
      }
      if (this.beat === 'bud') this.focus.copy(this.aim);
    }

    // A change of subject is a cut; within a shot the camera eases after what it follows.
    const cut = shot !== this.last && (shot === SHOT.sleeper || shot === SHOT.crew || this.last === SHOT.sleeper);
    this.last = shot;
    const k = cut ? 1 : 1 - Math.exp(-6 * dt);
    this.focus.lerp(this.aim, k);
    for (let i = 0; i < 3; i++) this.shot[i] += (shot[i] - this.shot[i]) * k;
    this.close.step(this.goal, 30, 11, dt);
  }

  private last: number[] = SHOT.eye;
  private reached = false;
}
