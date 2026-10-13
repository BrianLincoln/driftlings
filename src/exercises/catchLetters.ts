import { sfx } from '../audio/sound';
import { BASKET } from '../cast/companion';
import { nameClip, promptClip, soundClip } from '../content/content';
import type { CatchItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { ExerciseModule } from './contract';

// Letter cards drift down from the sky and the companion runs under them with
// a basket. "Catch every letter [name], but watch out for the other letters":
// the child steers it left and right (a finger, the mouse, or the arrow keys)
// to be under the named letter and out from under the rest. A caught letter
// says its sound and a small one joins a row at the front, so the row is the
// count.
//
// Nothing here can be lost. A wanted card that reaches the ground waits there,
// lit, until the companion comes for it; catching a wrong one is a soft "not
// that one" and the name again. Slow hands and quick ones finish the same round.

/** How fast a card comes down, in world units a second. It starts just out of sight above the view. */
const FALL = 0.72;
const LANES = { tall: 3, wide: 4 };
const SCALE = 0.7;
/** The caught ones at the front: small, so they are not taken for more to catch. */
const KEPT = { scale: 0.42, gap: 0.5 };
const SPAWN_EVERY = 1.6;
/** At most this many of the other letters between two wanted ones. */
const MAX_OTHERS_RUN = 2;
const REMIND_AFTER = 9;
const OTHER_RESTS = 0.7; // an unwanted card lies a moment on the ground, then goes
const SWAY = 0.07;
const ROCK = 0.13;
/** How far below the basket's rim a wanted card can still be scooped out of the air. */
const SCOOP = 0.3;
/** A wanted card is caught from a little further out than the basket is wide; a wrong one only if it is well in. */
const REACH = { wanted: BASKET.reach + 0.12, other: BASKET.reach - 0.12 };
/** World units a second under the arrow keys. */
const KEY_SPEED = 3.4;
const KEYS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, a: -1, d: 1 };

interface Faller {
  tile: LetterTile;
  wanted: boolean;
  lane: number;
  age: number;
  /** How high above the ground it started. */
  top: number;
  /** Seconds it has been on the ground. */
  rested: number;
  /** air: coming down. landed: on the ground. out: leaving. */
  state: 'air' | 'landed' | 'out';
  sway: number;
  /** Its foot was above the basket's rim last frame. */
  above: boolean;
}

export const catchLetters: ExerciseModule<CatchItem> = {
  kind: 'catch',
  clips: (items) => [
    promptClip('catch-every-letter'), promptClip('but-watch-out-for-the-other-letters'),
    ...items.flatMap((i) => [nameClip(i.target), soundClip(i.target)]),
  ],

  start(items, kit, hooks) {
    let index = -1;
    let fallers: Faller[] = [];
    let kept: LetterTile[] = [];
    let serial = 0;
    let t = 0;
    /** When cards start to fall: once the narrator has said which one to catch. */
    let startAt = Infinity;
    let nextSpawn = 0;
    let othersRun = 0;
    let lastLane = -1;
    let lastHeard = 0;
    let caught = 0;
    let slips = 0;
    let leaveAt = Infinity;
    /** Where the child has sent the companion, across the clearing. */
    let steer = 0;
    const held = new Set<string>();

    const item = () => items[index];
    const playing = () => index < items.length && caught < item().count;
    const lanes = () => LANES[kit.mode];
    const ground = (f: Faller) => kit.spot('tiles', f.lane, lanes());
    const rowZ = () => kit.spot('tiles', 0, 1).z;
    const edge = () => kit.spot('tiles', lanes() - 1, lanes()).x + 0.35;
    const height = (f: Faller) => (f.state === 'air' ? Math.max(0, f.top - FALL * f.age) : 0);
    const me = () => kit.companion.root.position.x;

    const onKey = (e: KeyboardEvent) => {
      if (!(e.key in KEYS)) return;
      if (e.type === 'keydown') held.add(e.key);
      else held.delete(e.key);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    const remind = (lead = 0) => {
      lastHeard = t + lead;
      return kit.line([promptClip('catch-every-letter'), nameClip(item().target)], lead);
    };

    const place = () => {
      steer = Math.max(-edge(), Math.min(edge(), steer));
      for (const f of fallers) {
        if (f.state === 'out') continue;
        const at = ground(f);
        f.tile.tip = 0;
        if (f.state === 'air') {
          at.x += Math.sin(f.age * 1.6 + f.sway) * SWAY;
          at.y += height(f);
          f.tile.tip = Math.sin(f.age * 1.6 + f.sway + 1) * ROCK;
        }
        f.tile.goal.copy(at);
      }
      kept.forEach((tile, i) => {
        tile.goal.copy(kit.spot('options', 0, 1));
        tile.goal.x = (i - (item().count - 1) / 2) * KEPT.gap;
      });
    };

    const spawn = () => {
      const busy = new Set(fallers.filter((f) => f.state !== 'out').map((f) => f.lane));
      const free = Array.from({ length: lanes() }, (_, i) => i).filter((i) => !busy.has(i));
      if (free.length === 0) return;
      const fresh = free.filter((i) => i !== lastLane);
      const pool = fresh.length ? fresh : free;
      const lane = pool[Math.floor(Math.random() * pool.length)];
      // The first one down is always the wanted letter, and it is never long before the next.
      const wanted = serial === 0 || othersRun >= MAX_OTHERS_RUN || Math.random() < 0.5;
      othersRun = wanted ? 0 : othersRun + 1;
      lastLane = lane;
      const others = item().others;
      const text = wanted ? item().target : others[Math.floor(Math.random() * others.length)];
      // The colour goes round the cards in turn: it says nothing about which letter is on one.
      const f: Faller = { tile: kit.card(text, serial++, SCALE), wanted, lane, age: 0, top: 0, rested: 0, state: 'air', sway: Math.random() * 6, above: true };
      f.top = kit.ceiling(rowZ()) - ground(f).y + 0.15;
      fallers.push(f);
      place();
      f.tile.snap(f.tile.goal);
    };

    const drop = (f: Faller) => {
      f.state = 'out';
      f.tile.tip = 0;
      f.tile.vanish();
    };

    const next = () => {
      index++;
      if (index >= items.length) {
        // The basket goes away again.
        kit.companion.want.pose = 'stand';
        kit.companion.want.at.copy(kit.sideSpot());
        return hooks.finished();
      }
      t = 0;
      serial = 0;
      caught = 0;
      slips = 0;
      othersRun = 0;
      lastLane = -1;
      steer = 0;
      startAt = leaveAt = Infinity;
      kit.companion.want.pose = 'carry';
      kit.companion.want.face = null;
    };

    /** The card is in the basket, or (for one waiting on the ground) scooped up. */
    const take = (f: Faller) => {
      hooks.attempt({
        exercise: 'catch',
        skills: item().skills,
        supports: item().supports,
        target: item().target,
        answer: f.tile.text,
        correct: f.wanted,
        try: slips + 1,
        // A card that has landed is lit: by then the game has pointed it out.
        helped: f.state === 'landed',
        ms: Math.round(f.age * 1000),
      });
      lastHeard = t;
      if (!f.wanted) {
        slips++;
        f.tile.shake();
        f.tile.dim = true;
        drop(f);
        kit.companion.act('startle');
        // Just the name again: what to look for, not what that one was.
        kit.say(nameClip(item().target), 0.45);
        return;
      }
      slips = 0;
      caught++;
      f.tile.active = false;
      // Down into the basket it goes.
      f.tile.goal.set(me(), ground(f).y + BASKET.rim - 0.2, rowZ());
      drop(f);
      kit.companion.thump();
      const small = kit.card(f.tile.text, caught, KEPT.scale);
      small.done = true;
      kept.push(small);
      place();
      small.snap(small.goal);
      sfx.pop();
      kit.say(soundClip(item().target), 0.1);
      if (caught < item().count) return kit.nod();
      // That is all of them: the rest go, and the row at the front takes a bow.
      for (const x of fallers) if (x.state !== 'out') drop(x);
      kit.cheer();
      leaveAt = t + 1.4;
    };

    next();

    return {
      touchables: () => [],
      pointer(_phase, x) {
        steer = kit.aim(x, rowZ());
      },
      update(dt) {
        t += dt;
        if (index >= items.length) return;
        if (startAt === Infinity && t > 0.5) {
          const said = index === 0
            ? kit.line([promptClip('catch-every-letter'), nameClip(item().target), promptClip('but-watch-out-for-the-other-letters')])
            : remind();
          lastHeard = t + said.end;
          // The first card is on its way down as the line ends.
          startAt = nextSpawn = t + Math.max(0.4, said.end - 0.8);
        }
        for (const k of held) steer += KEYS[k] * KEY_SPEED * dt;
        place();
        kit.companion.want.at.set(steer, 0, rowZ());

        for (const f of fallers) {
          if (f.state === 'out' || !playing()) continue;
          f.age += dt;
          const off = Math.abs(ground(f).x - me());
          if (f.state === 'air') {
            const h = height(f);
            const crossing = f.above && h <= BASKET.rim;
            f.above = h > BASKET.rim;
            // A wanted card can be scooped up for a moment after it passes the rim; a wrong one has to drop right in.
            if (f.wanted ? !f.above && h > BASKET.rim - SCOOP && off < REACH.wanted : crossing && off < REACH.other) take(f);
            else if (h <= 0) {
              f.state = 'landed';
              f.tile.press(0.6);
              if (f.wanted) f.tile.active = true;
            }
          } else if (f.wanted) {
            if (off < REACH.wanted) take(f);
          } else if ((f.rested += dt) > OTHER_RESTS) drop(f);
        }
        fallers = fallers.filter((f) => f.state !== 'out');
        if (playing() && t >= nextSpawn) {
          spawn();
          nextSpawn = t + SPAWN_EVERY;
        }
        if (playing() && t >= startAt && t - lastHeard > REMIND_AFTER) remind();
        if (t >= leaveAt) {
          for (const tile of kept) tile.vanish();
          kept = [];
          hooks.itemDone();
          next();
        } else if (leaveAt < Infinity && t >= leaveAt - 0.9 && t - dt < leaveAt - 0.9) {
          for (const tile of kept) tile.hop();
        }
      },
      layout: place,
      // Scripted play goes for the lowest wanted card, but never runs under a wrong one that is about to drop in.
      debug() {
        if (!playing()) return { waiting: true };
        const z = rowZ();
        const near = (f: Faller) => !f.wanted && f.state === 'air' && height(f) < BASKET.rim + 0.5;
        const want = fallers.filter((f) => f.wanted && (f.state === 'landed' || height(f) < f.top - 1.2)).sort((a, b) => b.age - a.age)[0];
        const to = want ? ground(want).x : me();
        const [lo, hi] = [Math.min(me(), to) - BASKET.reach, Math.max(me(), to) + BASKET.reach];
        const over = fallers.find((f) => near(f) && ground(f).x > lo && ground(f).x < hi);
        if (!over) return { steer: [to, z] };
        // Step out from under it, away from the lane it is in and no further than the gap between two lanes.
        const x = ground(over).x;
        return Math.abs(x - me()) < BASKET.reach ? { steer: [x + (x > 0 ? -0.57 : 0.57), z] } : { steer: [me(), z] };
      },
      dispose() {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        kit.companion.want.pose = 'stand';
      },
    };
  },
};
