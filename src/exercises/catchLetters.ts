import { sfx } from '../audio/sound';
import { nameClip, promptClip, soundClip } from '../content/content';
import type { CatchItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { Touchable } from '../stage/touch';
import type { ExerciseModule } from './contract';

// Letters drift down from the sky. "Catch every letter [name], but watch out
// for the other letters": tap the named one, leave the rest alone. A caught
// letter says its sound and a small one joins a row at the front, so the row is
// the count.
//
// Nothing here can be lost. A wanted letter that reaches the ground waits
// there, lit, until it is tapped; a wrong tap is a soft "not that one" and the
// name again. Slow hands and quick ones finish the same round.

/** Seconds a letter takes to come down. */
const AIR = 5.2;
/** How far up it starts, by layout: as high as the stage box allows. */
const DROP = { tall: 2.7, wide: 1.85 };
const LANES = { tall: 3, wide: 4 };
const SCALE = 0.85;
/** The caught ones at the front: small, so they are not taken for more to catch. */
const KEPT = { scale: 0.5, gap: 0.58 };
const SPAWN_EVERY = 1.5;
/** At most this many of the other letters between two wanted ones. */
const MAX_OTHERS_RUN = 2;
const REMIND_AFTER = 9;
const OTHER_RESTS = 0.7; // an unwanted letter sits a moment on the ground, then goes
const SWAY = 0.07;

interface Faller {
  id: number;
  tile: LetterTile;
  wanted: boolean;
  lane: number;
  age: number;
  /** air: coming down. landed: on the ground. out: leaving. */
  state: 'air' | 'landed' | 'out';
  sway: number;
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
    /** When letters start to fall: once the narrator has said which one to catch. */
    let startAt = Infinity;
    let nextSpawn = 0;
    let othersRun = 0;
    let lastLane = -1;
    let lastHeard = 0;
    let caught = 0;
    let slips = 0;
    let leaveAt = Infinity;

    const item = () => items[index];
    const playing = () => index < items.length && caught < item().count;

    const remind = (lead = 0) => {
      lastHeard = t + lead;
      return kit.line([promptClip('catch-every-letter'), nameClip(item().target)], lead);
    };

    const place = () => {
      const lanes = LANES[kit.mode];
      for (const f of fallers) {
        if (f.state === 'out') continue;
        const ground = kit.spot('tiles', f.lane % lanes, lanes);
        if (f.state === 'air') {
          ground.x += Math.sin(f.age * 1.6 + f.sway) * SWAY;
          ground.y += DROP[kit.mode] * (1 - f.age / AIR);
        }
        f.tile.goal.copy(ground);
      }
      kept.forEach((tile, i) => {
        tile.goal.copy(kit.spot('options', 0, 1));
        tile.goal.x = (i - (item().count - 1) / 2) * KEPT.gap;
      });
    };

    const spawn = () => {
      const lanes = LANES[kit.mode];
      const busy = new Set(fallers.filter((f) => f.state === 'air' || f.state === 'landed').map((f) => f.lane % lanes));
      const free = Array.from({ length: lanes }, (_, i) => i).filter((i) => !busy.has(i));
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
      const f: Faller = { id: serial++, tile: kit.tile(text, SCALE), wanted, lane, age: 0, state: 'air', sway: Math.random() * 6 };
      fallers.push(f);
      place();
      f.tile.snap(f.tile.goal);
    };

    const drop = (f: Faller) => {
      f.state = 'out';
      f.tile.vanish();
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      t = 0;
      serial = 0;
      caught = 0;
      slips = 0;
      othersRun = 0;
      lastLane = -1;
      startAt = leaveAt = Infinity;
      kit.companion.want.pose = 'stand';
      kit.companion.want.face = null;
      kit.companion.want.at.copy(kit.sideSpot());
    };

    const tap = (f: Faller) => {
      if (!playing() || (f.state !== 'air' && f.state !== 'landed') || f.tile.dim) return;
      hooks.attempt({
        exercise: 'catch',
        skills: item().skills,
        supports: item().supports,
        target: item().target,
        answer: f.tile.text,
        correct: f.wanted,
        try: slips + 1,
        // A letter that has landed is lit: by then the game has pointed it out.
        helped: f.state === 'landed',
        ms: Math.round(f.age * 1000),
      });
      f.tile.press();
      if (!f.wanted) {
        slips++;
        f.tile.shake();
        f.tile.dim = true;
        sfx.oops();
        drop(f);
        // Just the name again: what to look for, not what that one was.
        lastHeard = t;
        kit.say(nameClip(item().target), 0.45);
        return;
      }
      slips = 0;
      caught++;
      f.tile.active = false;
      f.tile.hop();
      drop(f);
      const small = kit.tile(f.tile.text, KEPT.scale);
      small.done = true;
      kept.push(small);
      place();
      small.snap(small.goal);
      sfx.pop();
      lastHeard = t;
      kit.say(soundClip(item().target), 0.1);
      if (caught < item().count) return kit.nod();
      // That is all of them: the rest go, and the row at the front takes a bow.
      for (const x of fallers) if (x.state === 'air' || x.state === 'landed') drop(x);
      kit.cheer();
      leaveAt = t + 1.4;
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = fallers
          .filter((f) => f.state === 'air' || f.state === 'landed')
          .map((f) => ({ id: `fall:${f.id}`, object: f.tile.anchor, radius: f.tile.radius, enabled: playing, onTap: () => tap(f) }));
        // Tapping the companion says which letter again.
        out.push({ id: 'again', object: kit.companion.root, radius: 0.38, enabled: playing, onTap: () => { kit.companion.act('greet'); remind(0.1); } });
        return out;
      },
      update(dt) {
        t += dt;
        if (index >= items.length) return;
        if (startAt === Infinity && t > 0.5) {
          const said = index === 0
            ? kit.line([promptClip('catch-every-letter'), nameClip(item().target), promptClip('but-watch-out-for-the-other-letters')])
            : remind();
          lastHeard = t + said.end;
          // The first letter is on its way down as the line ends.
          startAt = nextSpawn = t + Math.max(0.4, said.end - 0.8);
        }
        for (const f of fallers) {
          f.age += dt;
          if (f.state === 'air' && f.age >= AIR) {
            f.state = 'landed';
            f.age = AIR;
            f.tile.press(0.6);
            if (f.wanted) f.tile.active = true;
          } else if (f.state === 'landed' && !f.wanted && f.age > AIR + OTHER_RESTS) drop(f);
        }
        fallers = fallers.filter((f) => f.state !== 'out');
        if (playing() && t >= nextSpawn) {
          spawn();
          nextSpawn = t + SPAWN_EVERY;
        }
        if (playing() && t >= startAt && t - lastHeard > REMIND_AFTER) remind();
        place();
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
      // Scripted play lets a letter come down a little before catching it.
      debug() {
        const f = playing() && fallers.find((x) => x.wanted && ((x.state === 'air' && x.age > 1.4) || x.state === 'landed'));
        return f ? { tap: [`fall:${f.id}`] } : { waiting: true };
      },
      dispose() {},
    };
  },
};
