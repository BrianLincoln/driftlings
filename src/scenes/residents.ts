import * as THREE from 'three';
import type { Creature } from '../cast/creature';
import { ashore } from './homeRing';
import { yawTo, type Ground, type Guest, type Pastime } from './pastime';

// How everyone at home spends the day. Each of them is always either on its way
// somewhere, taking part in a pastime (pastime.ts), or idling a moment before
// the next thing: it picks somewhere with room, anywhere on the island but
// likelier near and likelier where there is company, hops over, stays a while
// and moves on. They look at what they are
// doing and at one another, and at the companion when it comes by: bump into
// one and it jumps for joy. They look at you when you tap them.

interface Day extends Guest {
  /** 'held' is kept where it was put until it is let go. */
  state: 'held' | 'going' | 'doing' | 'idle';
  /** Which pastime it is at or making for, and its place in it. -1 is none: it is only strolling. */
  place: number;
  slot: number;
  /** The last one it was at: it goes somewhere else next. */
  last: number;
  goal: THREE.Vector3;
  /** Seconds left of what it is doing. */
  left: number;
  /** Seconds left of looking at whoever tapped it. */
  noticed: number;
  /** Seconds until the companion bumping into it is news again. */
  bumped: number;
  /** What it looks at while it idles. */
  watch: THREE.Vector3 | null;
  /** What it is standing on, or was until it set off (see `Pastime.rise`). */
  rise: Ground | null;
  wasRise: Ground | null;
  pace: number;
  /** A big one keeps to its own spot, and to itself. */
  den: THREE.Vector3 | null;
}

/** How far a stroll goes, and how near the water. */
const STROLL = 9;
const BEACH = 3;
/** How far off a pastime is before it is half as likely to be the next thing: nowhere on the island is too far. */
const FAR = 12;
/** How near the companion has to come to be looked at, and to bump into someone of size 1. */
const SEEN = 4.5;
const BUMP = 0.75;
const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

export class Residents {
  private days: Day[] = [];
  private taken: Array<Array<Day | null>>;
  private here: Array<Array<Guest | null>>;

  /** `viewer` is where whoever is watching is, and `guide` where the companion is: the scene keeps both up to date. */
  constructor(private places: Pastime[], private y: Ground, private viewer: THREE.Vector3, private guide: THREE.Vector3) {
    this.taken = places.map((p) => Array.from({ length: p.room }, () => null));
    this.here = places.map((p) => Array.from({ length: p.room }, () => null));
  }

  /** Someone new, stood at a spot and kept there until `free`. A big one is given the `den` it will live at. */
  hold(c: Creature, x: number, z: number, den: [number, number] | null = null): void {
    const d: Day = {
      c, eye: new THREE.Vector3(), state: 'held', place: -1, slot: 0, last: -1, goal: new THREE.Vector3(), left: 0, noticed: 0, bumped: 2,
      watch: this.viewer, rise: null, wasRise: null, pace: den ? 0.6 : 1.1 + Math.random() * 0.5, den: den && new THREE.Vector3(den[0], 0, den[1]),
    };
    c.wanderRadius = 0;
    c.groundY = (gx, gz) => this.y(gx, gz) + (d.rise?.(gx, gz) ?? 0) + (d.wasRise?.(gx, gz) ?? 0);
    c.place(x, z, 0);
    this.days.push(d);
  }

  /** Let go of someone held: it hops to a spot, and from there the day is its own. */
  free(c: Creature, x: number, z: number): void {
    const d = this.days.find((day) => day.c === c);
    if (d) this.send(d, x, z);
  }

  /** Someone who lives here already, found in the middle of something: the `n`-th of them. */
  settle(c: Creature, n: number): void {
    this.hold(c, 0, 0);
    const d = this.days[this.days.length - 1];
    const k = n % this.places.length;
    const slot = this.taken[k].indexOf(null);
    if (slot < 0) {
      const [x, z] = this.strollSpot(this.places[k].at);
      c.place(x, z, Math.random() * 6);
      d.state = 'idle';
      d.watch = null;
      d.left = 1 + Math.random() * 4;
      return;
    }
    this.take(d, k, slot);
    const at = this.places[k].spot(slot);
    c.place(at.x, at.z, 0);
    this.arrive(d);
    d.left *= 0.25 + 0.75 * Math.random();
  }

  tapped(c: Creature): void {
    c.react();
    const d = this.days.find((day) => day.c === c);
    if (d) d.noticed = 3;
  }

  /** The eyes of whoever is nearest a spot, other than `but`. */
  private nearest(p: THREE.Vector3, but: Day): THREE.Vector3 | null {
    let best: Day | null = null;
    let bestD = 7;
    for (const d of this.days) {
      const far = d === but ? Infinity : Math.hypot(d.c.root.position.x - p.x, d.c.root.position.z - p.z);
      if (far < bestD) [best, bestD] = [d, far];
    }
    return best && best.eye;
  }

  /** Somewhere to stand about not far from `p`, clear of anything going on. */
  private strollSpot(p: THREE.Vector3): [number, number] {
    let at: [number, number] = [0, 0];
    for (let tries = 0; tries < 5; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * (STROLL - 1.5);
      at = ashore(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r, BEACH);
      if (this.places.every((p) => Math.hypot(p.at.x - at[0], p.at.z - at[1]) > p.reach + 0.4)) break;
    }
    return at;
  }

  private take(d: Day, k: number, slot: number): void {
    d.place = k;
    d.slot = slot;
    this.taken[k][slot] = d;
    d.wasRise = d.rise;
    d.rise = this.places[k].rise?.(slot) ?? null;
  }

  private send(d: Day, x: number, z: number): void {
    d.goal.set(x, 0, z);
    d.state = 'going';
    d.c.pace = d.pace;
    d.c.hopTo(x, z);
  }

  private arrive(d: Day): void {
    const c = d.c;
    d.wasRise = null;
    if (d.place >= 0) {
      d.state = 'doing';
      d.left = between(this.places[d.place].stay);
      this.here[d.place][d.slot] = d;
      this.places[d.place].begin(d, d.slot);
      return;
    }
    d.state = 'idle';
    d.left = d.den ? 3 + Math.random() * 7 : 1.5 + Math.random() * 4;
    // Mostly it watches whoever is nearest; now and then, you; or it just stands and looks where it is facing.
    const whim = Math.random();
    d.watch = whim < 0.6 ? this.nearest(c.root.position, d) : whim < 0.75 ? this.viewer : null;
    if (!d.den) c.turnTo(d.watch ? yawTo(c.root.position, d.watch) : Math.random() * 6);
  }

  /** Done here: leave, and pick the next thing. */
  private next(d: Day): void {
    const p = d.c.root.position;
    if (d.place >= 0) {
      this.places[d.place].end(d, d.slot);
      this.here[d.place][d.slot] = this.taken[d.place][d.slot] = null;
      d.last = d.place;
      d.place = -1;
      d.wasRise = d.rise;
      d.rise = null;
    }
    if (d.den) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 1.4;
      return this.send(d, d.den.x + Math.sin(a) * r, d.den.z + Math.cos(a) * r);
    }
    // One free place at each pastime: likelier the nearer it is, and three times as likely where someone is already.
    const options: Array<[number, number, number]> = [];
    let total = 0;
    this.places.forEach((place, k) => {
      const slot = this.taken[k].indexOf(null);
      if (k === d.last || slot < 0) return;
      const weight = (this.taken[k].some(Boolean) ? 3 : 1) / (1 + Math.hypot(place.at.x - p.x, place.at.z - p.z) / FAR);
      options.push([k, slot, weight]);
      total += weight;
    });
    if (!options.length || Math.random() < 0.25) return this.send(d, ...this.strollSpot(p));
    let pick = Math.random() * total;
    const [k, slot] = options.find(([, , weight]) => (pick -= weight) <= 0) ?? options[0];
    this.take(d, k, slot);
    const spot = this.places[k].spot(slot);
    this.send(d, spot.x, spot.z);
  }

  update(dt: number): void {
    for (const d of this.days) {
      const c = d.c;
      const p = c.root.position;
      d.eye.set(p.x, p.y + c.height * c.root.scale.y * 0.75, p.z);
      d.noticed = Math.max(0, d.noticed - dt);
      if (d.state === 'going') {
        c.lookTarget = null;
        if (!c.moving) this.arrive(d);
      } else if (d.state === 'held') c.lookTarget = this.viewer;
      else if ((d.left -= dt) <= 0) this.next(d);
      else if (d.state === 'idle') c.lookTarget = d.watch;
    }
    this.places.forEach((place, k) => place.update(dt, this.here[k]));
    for (const d of this.days) {
      const c = d.c;
      const far = Math.hypot(this.guide.x - c.root.position.x, this.guide.z - c.root.position.z);
      // The companion is always worth a look, unless there is something better to do; and a bump from it is a treat.
      if (far < SEEN && (d.state === 'idle' || d.state === 'going')) c.lookTarget = this.guide;
      d.bumped = Math.max(0, d.bumped - dt);
      if (far < BUMP * Math.max(1, c.root.scale.y) && d.bumped <= 0 && d.state !== 'held') {
        d.bumped = 5;
        c.react();
      }
      if (d.noticed > 0) c.lookTarget = this.viewer;
      c.update(dt);
    }
  }
}
