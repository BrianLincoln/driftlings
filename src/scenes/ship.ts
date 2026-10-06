import * as THREE from 'three';
import { TAG } from '../gfx/glsl';
import { paint } from '../gfx/geo';
import { toonMaterial } from '../gfx/materials';
import { C } from '../gfx/palette';
import { sfx } from '../audio/sound';
import type { Creature } from '../cast/creature';
import { bound, routeAround, type Blocker } from './detour';
import { HALF, beam, deckY, sheer, shipGeo } from './shipGeo';
import type { Raft } from './raft';

// The ship that carries everyone home. It counts as a piece of home: whoever
// is aboard keeps their colour. A plank runs from the shore to its rail, and
// creatures hurry across it to stand along the deck. The plank can be carried
// off; while it is gone, whoever is aboard frets. Whoever is too big for the
// deck rides the raft it tows (raft.ts).

const SCALE = 1.9;
const SINK = 0.26; // sits in the water to a little under the wale
/** Places along the deck, bow to stern, clear of the castles. */
const SEATS = [0.62, 0.29, -0.04, -0.37, -0.7];
/** How far toward the shoreward rail each stands: out of line, so it reads as a crowd, not a queue. */
const ASIDE = [0.34, 0.1, 0.36, 0.12, 0.32];
/** Where the plank meets the rail, along the hull. */
const GANGWAY = -0.2;
const HURRY = 3.4;
/** Up on the forecastle, ahead of the foremast: where whoever leads the way stands. */
export const BOW = 1.22;
/** On the main deck at the foot of the forecastle, to the shoreward side: the way up to the bow, clear of the foremast. */
export const STEP_UP: [number, number] = [0.6, 0.36];
/** Places up on the forecastle, round the front of the foremast, as [along, aside]: for whoever is about to get off. */
const FORE = [[1.3, 0], [1.14, 0.28], [1.14, -0.28], [1.0, 0.44], [1.0, -0.42]];
/** How high a big one's bound from the shore to the raft goes. */
const BOUND = 1.7;
/** How the plank lies when carried: level, its broad face tipped toward the viewer. */
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.95, 0, 0.1));

type Ground = (x: number, z: number) => number;

interface Rider {
  who: Creature;
  /** Where it stands once aboard. */
  spot: () => THREE.Vector3;
  /** Called as it gets there. */
  landed: () => void;
  /** Not in one of the places on the main deck. */
  big: boolean;
  /** While fretting: what it is glancing at, and for how much longer. */
  look: THREE.Vector3;
  lookFor: number;
  /** While on its way aboard: the spots still to reach, each with the ground under that stretch. */
  route: Array<{ to: THREE.Vector3; ground: Ground }>;
}

let geo: ReturnType<typeof shipGeo> | null = null;
const wood = () => toonMaterial({ tag: TAG.prop, flag: -0.45, unlit: 0.3, wood: true });

/** The ship alone, at its built size, floating at its waterline. */
export function shipModel(): THREE.Group {
  geo ??= shipGeo();
  const mesh = new THREE.Group();
  mesh.add(new THREE.Mesh(geo.wood, wood()), new THREE.Mesh(geo.rig, toonMaterial({ tag: TAG.prop, flag: -0.45 })));
  mesh.position.y = -SINK;
  return mesh;
}

export class Ship {
  readonly root = new THREE.Group();
  /** Lies in the world, not on the ship: add it to the scene beside `root`. */
  readonly plank: THREE.Mesh;
  private riders: Rider[] = [];
  private t = 0;
  private dip = 0;
  private base = new THREE.Vector3();
  private spot = new THREE.Vector3();
  private foot = new THREE.Vector3();
  private head = new THREE.Vector3();
  private laid = { at: new THREE.Vector3(), turn: new THREE.Quaternion() };
  private held: THREE.Vector3 | null = null;
  private heldAt = new THREE.Vector3();
  private carried = 0;
  private fretting = false;
  private stern = new THREE.Vector3();
  private ahead = new THREE.Vector3();

  /** `raft`, if it tows one, lies in the world too: add its root and rope to the scene. */
  constructor(readonly raft: Raft | null = null) {
    this.root.add(shipModel());
    this.root.scale.setScalar(SCALE);
    this.plank = new THREE.Mesh(paint(new THREE.BoxGeometry(1, 0.05, 0.5), C.shipTrim), wood());
  }

  /** Moor at a spot off the island and lay the plank square off the rail to the shore. */
  moor(x: number, z: number, yaw: number, ground: Ground): void {
    this.place(x, z, yaw);
    this.root.localToWorld(this.head.set(GANGWAY, sheer(GANGWAY) - SINK, beam(GANGWAY)));
    // Walk inland from the rail until there is sand underfoot, and a little further.
    const step = new THREE.Vector3(0, 0, 0.1).applyQuaternion(this.root.quaternion);
    this.foot.copy(this.head);
    for (let i = 0; i < 80 && ground(this.foot.x, this.foot.z) < -0.2; i++) this.foot.add(step);
    this.foot.addScaledVector(step, 3);
    this.foot.y = ground(this.foot.x, this.foot.z) + 0.04;
    const span = this.head.clone().sub(this.foot);
    this.laid.at.copy(this.foot).addScaledVector(span, 0.5);
    this.laid.turn.setFromUnitVectors(new THREE.Vector3(1, 0, 0), span.clone().normalize());
    this.plank.scale.set(span.length() + 0.3, 1, 1);
    this.layPlank();
  }

  /** Be at a spot on open water, bow turned by `yaw` from +x. `settle` puts the raft straight in its place astern. */
  place(x: number, z: number, yaw: number, settle = true): void {
    this.base.set(x, -0.35, z);
    this.root.position.x = x;
    this.root.position.z = z;
    this.root.rotation.y = yaw;
    if (settle) this.root.position.y = this.base.y;
    this.root.updateMatrixWorld(true);
    if (settle) this.trail(1e3);
  }

  private trail(dt: number): void {
    if (!this.raft) return;
    this.root.localToWorld(this.stern.set(-HALF, sheer(-HALF) - SINK - 0.1, 0));
    this.raft.follow(this.stern, this.ahead.set(1, 0, 0).applyQuaternion(this.root.quaternion), dt);
  }

  /** Someone carries the plank off, holding it at `at` (a spot that may move); null lays it back. */
  hold(at: THREE.Vector3 | null, atOnce = false): void {
    this.held = at;
    if (atOnce) this.carried = at ? 1 : 0;
  }

  /** Whoever is aboard looks worried and keeps glancing about, or stops. */
  fret(on: boolean): void {
    this.fretting = on;
    for (const r of this.riders) r.who.worried = on;
  }

  /** Everyone aboard jumps for joy. */
  cheer(): void {
    for (const r of this.riders) if (r.route.length === 0) r.who.react();
  }

  /** The height of the plank under a spot along it. */
  readonly plankY = (x: number, z: number): number => {
    const { foot, head } = this;
    const k = THREE.MathUtils.clamp(Math.hypot(x - foot.x, z - foot.z) / Math.hypot(head.x - foot.x, head.z - foot.z), 0, 1);
    return THREE.MathUtils.lerp(foot.y, head.y, k) + 0.03;
  };

  /** A spot on the deck, for someone who walks aboard by their own means. */
  deck(seat: number, aside = 0.2): THREE.Vector3 {
    return this.seatAt(seat, aside).clone();
  }

  get rail(): THREE.Vector3 {
    return this.head;
  }

  private layPlank(): void {
    if (this.held) this.heldAt.copy(this.held);
    this.plank.position.lerpVectors(this.laid.at, this.heldAt, this.carried);
    this.plank.quaternion.slerpQuaternions(this.laid.turn, FLAT, this.carried);
  }

  /** Where the plank touches the shore. */
  get shore(): THREE.Vector3 {
    return this.foot;
  }

  /** True when nobody is still on their way aboard. */
  get settled(): boolean {
    return this.riders.every((r) => r.route.length === 0);
  }

  private seatAt(x: number, aside = 0.2): THREE.Vector3 {
    return this.root.localToWorld(this.spot.set(x, deckY(x) - SINK, aside));
  }

  private rider(who: Creature, spot: Rider['spot'], route: Rider['route'], landed: () => void, big = false): void {
    who.worried = this.fretting;
    this.riders.push({ who, spot, route, landed, big, look: new THREE.Vector3(), lookFor: 0 });
  }

  /** The next free place on deck. Past the first row, a second forms behind it. */
  private onDeck(): [Rider['spot'], () => void] {
    const n = this.riders.filter((r) => !r.big).length;
    const row = Math.floor(n / SEATS.length) % 2;
    const seat = SEATS[n % SEATS.length] + row * 0.16;
    const aside = ASIDE[n % SEATS.length] - row * 0.5;
    return [() => this.seatAt(seat, aside), () => void (this.dip = 0.05)];
  }

  private onRaft(): [Rider['spot'], () => void] {
    const raft = this.raft!;
    return [() => raft.seat(), () => {
      raft.thump();
      this.dip = 0.12; // the rope yanks the ship down by the stern
      sfx.thud();
    }];
  }

  /** Already aboard: on the main deck, crowded up at the bow ready to get off, or on the raft for someone big. */
  seat(who: Creature, where: 'deck' | 'bow' | 'raft' = 'deck'): void {
    const [x, aside] = FORE[this.riders.length % FORE.length];
    const [spot, landed] = where === 'raft' ? this.onRaft() : where === 'bow' ? [() => this.seatAt(x, aside), () => {}] : this.onDeck();
    this.rider(who, spot, [], landed, where !== 'deck');
  }

  /** Someone aboard is getting off: from now on the ship leaves it alone. */
  leave(who: Creature): void {
    this.riders = this.riders.filter((r) => r.who !== who);
    this.dip = 0.04;
  }

  /** Someone big bounds from where it stands, clean over the water, and lands on the raft. */
  boardRaft(who: Creature): void {
    const [spot, landed] = this.onRaft();
    const to = spot().clone();
    const arc = bound(who.root.position, to, BOUND);
    who.pace = HURRY;
    who.hopTo(to.x, to.z);
    this.rider(who, spot, [{ to, ground: arc }], landed, true);
    sfx.whoosh();
  }

  /**
   * Hurries from wherever it stands to the plank, across it, and down onto the
   * deck, going round whatever is in the way on land.
   */
  board(who: Creature, land: Ground, blockers: readonly Blocker[] = []): void {
    const { foot, head } = this;
    const [spot, landed] = this.onDeck();
    const onPlank = this.plankY;
    const deck: Ground = () => spot().y;
    const via = routeAround(who.root.position, foot, blockers).map((p) => new THREE.Vector3(p.x, 0, p.z));
    who.pace = HURRY;
    who.hopTo(via[0].x, via[0].z);
    this.rider(who, spot, [
      ...via.map((to) => ({ to, ground: land })),
      { to: head.clone(), ground: onPlank },
      { to: spot().clone(), ground: deck },
    ], landed);
    sfx.hop();
  }

  update(dt: number, camera: THREE.Camera): void {
    this.t += dt;
    this.dip += (0 - this.dip) * Math.min(1, dt * 5);
    this.root.position.y = this.base.y + Math.sin(this.t * 1.1) * 0.03 - this.dip;
    this.root.rotation.z = Math.sin(this.t * 0.8) * 0.015;
    this.root.updateMatrixWorld(true);
    this.trail(dt);
    this.carried += ((this.held ? 1 : 0) - this.carried) * Math.min(1, dt * 7);
    this.layPlank();
    for (const r of this.riders) {
      const p = r.who.root.position;
      const leg = r.route[0];
      if (leg) {
        r.who.groundY = leg.ground;
        r.who.lookTarget = null;
        if (Math.hypot(leg.to.x - p.x, leg.to.z - p.z) < 0.2) {
          r.route.shift();
          const next = r.route[0];
          if (next) r.who.hopTo(next.to.x, next.to.z);
          else {
            r.who.pace = 1;
            r.who.nod();
            r.landed();
          }
        }
      } else {
        const to = r.spot();
        const y = to.y;
        p.x = to.x;
        p.z = to.z;
        r.who.groundY = () => y;
        r.who.lookTarget = camera.position;
        if (this.fretting) {
          // Nervous glances: at whoever has the plank, at each other, and back.
          if ((r.lookFor -= dt) <= 0) {
            r.lookFor = 0.35 + Math.random() * 0.7;
            const other = this.riders[Math.floor(Math.random() * this.riders.length)].who.root.position;
            r.look.copy(Math.random() < 0.4 ? this.heldAt : other).y += 0.2;
          }
          r.who.lookTarget = r.look;
        }
      }
      r.who.update(dt);
    }
  }
}
