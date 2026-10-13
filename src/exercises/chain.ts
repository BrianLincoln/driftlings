import type * as THREE from 'three';
import { sfx } from '../audio/sound';
import { promptClip, soundClip, wordClip } from '../content/content';
import { CHAIN_PROMPTS } from '../learn/chains';
import type { ChainItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { Thing } from '../scenes/things';
import type { Touchable } from '../stage/touch';
import type { Crossing, ExerciseModule } from './contract';
import { JOINED, wordScale } from './wordRow';

// Stepping stones: a word chain. A word stands on its tiles by a stream, and each step changes one letter of it.
//   spell  The new word is said and one tile goes blank. The child taps the letter, of three, that makes the word.
//          A wrong one goes onto the blank tile, what that spells is said if it is a word, and it comes back out.
//   read   One tile changes by itself and nobody says the word. By it stand three drawings, and the child taps
//          the one the word now names. A wrong one says what it is and goes; the question is asked again.
// Each right step brings a stone up out of the stream. When the last is up the companion walks over.
// Nothing is lost by a wrong answer; after two, or a long wait, the companion shows which.

const MOST = 0.85;
/**
 * Where things stand, per layout. On a tall screen the word is at the back, what is offered in front of it and smaller,
 * so the word can be read over the top; on a wide one they are side by side. The stream is in front of both.
 */
const ROWS = {
  tall: { word: [0, 0.45], offered: [0, 2.45], gap: 0.92, size: 0.7, apart: [0, 0] },
  // `apart`: how far a word of five tiles, and what is offered, step aside on a wide screen to stay clear of each other.
  wide: { word: [-1.3, 1.0], offered: [2.05, 1.5], gap: 0.98, size: 0.8, apart: [0.4, 0.1] },
} as const;
const REPLAY_AFTER = 6;
const HELP_AFTER = { spell: 14, read: 22 };
const BEFORE_REASK = 1.6;
/** How fast the companion goes over the stones. */
const STROLL = 1.5;

interface Option {
  /** A letter to put in the word, or a drawing to pick: one or the other. */
  tile?: LetterTile;
  thing?: Thing;
  /** Where it stands. */
  at: THREE.Vector3;
  /** The letter on the tile, or the word for the drawing. */
  value: string;
  makes?: string;
  out: boolean;
  /** A letter that has gone into the gap in the word. */
  inWord: boolean;
}

export const chainExercise: ExerciseModule<ChainItem> = {
  kind: 'chain',
  clips: (items) => [
    ...Object.values(CHAIN_PROMPTS).map(promptClip),
    ...items.flatMap((i) => [wordClip(i.start), ...i.graphemes.map(soundClip), ...i.steps.flatMap((s) => [
      wordClip(s.word), ...s.words.map(wordClip), ...s.letters.flatMap((l) => [soundClip(l.grapheme), ...(l.makes ? [wordClip(l.makes)] : [])]),
    ])]),
  ],

  start(items, kit, hooks) {
    const walk = kit.companion.speed;
    let index = -1;
    let si = -1;
    let phase: 'show' | 'ask' | 'right' | 'cross' = 'show';
    let t = 0;
    let crossing: Crossing | null = null;
    /** The word's tiles. In a spelling step the one to be changed is blank until the right letter takes its place. */
    let row: LetterTile[] = [];
    let scale = 1;
    let options: Option[] = [];
    let askedAt = Infinity;
    let busyUntil = 0;
    let lastHeard = 0;
    let tries = 0;
    let helped = false;
    let spelt = 0;
    let timers: Array<{ at: number; fn: () => void }> = [];

    const item = () => items[index];
    const step = () => item().steps[si];
    const spelling = () => step().mode === 'spell';
    const answer = () => (spelling() ? step().graphemes[step().at] : step().word);
    const right = () => options.find((o) => o.value === answer())!;
    const later = (seconds: number, fn: () => void) => timers.push({ at: t + seconds, fn });
    // An odd chain goes back the way the last one came.
    const back = () => index % 2 === 1;
    const bank = (far: boolean) => crossing!.place(far !== back() ? item().steps.length + 1 : 0);

    const rows = () => ROWS[kit.mode];
    const apart = (i: 0 | 1) => (row.length > 4 ? rows().apart[i] : 0);
    const slot = (i: number): THREE.Vector3 => kit.at(rows().word[0] - apart(0) + (i - (row.length - 1) / 2) * JOINED * scale, rows().word[1]);
    const offered = (i: number): THREE.Vector3 => kit.at(rows().offered[0] + apart(1) + (i - (options.length - 1) / 2) * rows().gap, rows().offered[1]);
    const place = () => {
      row.forEach((tile, i) => tile.goal.copy(slot(i)));
      options.forEach((o, i) => {
        o.at.copy(o.inWord ? slot(step().at) : offered(i));
        if (o.inWord) o.at.z += 0.15; // in front of the empty tile
        o.tile?.goal.copy(o.at);
        o.thing?.root.position.copy(o.at);
      });
    };
    const point = (o: Option | null) => {
      const want = kit.companion.want;
      want.pose = o ? 'point' : 'stand';
      want.face = o ? o.at.clone().setY(o.at.y + (o.tile ? 0.5 : 0.3)) : null;
      if (o) want.at.set(o.at.x - 0.6 * (o.tile?.scale ?? 1), 0, o.at.z + 0.4);
      else if (crossing) want.at.copy(bank(false));
      if (o) kit.companion.nudge();
    };
    const hopRow = (lead: number) => row.forEach((tile, i) => later(lead + i * 0.07, () => tile.hop()));

    const giveHelp = () => {
      if (helped || phase !== 'ask') return;
      helped = true;
      const tile = right().tile;
      if (tile) tile.active = true;
      point(right());
    };

    /** The question, or the word again. Returns when it is over. */
    const ask = (lead: number, first = false): number => {
      const s = step();
      const clips = spelling()
        ? [...(first && spelt++ === 0 ? [promptClip(CHAIN_PROMPTS.spell)] : []), wordClip(s.word)]
        : [promptClip(CHAIN_PROMPTS.read)];
      const said = kit.line(clips, lead);
      lastHeard = t + said.lastAt;
      return said.end;
    };

    const nextStep = () => {
      si++;
      const s = step();
      phase = 'ask';
      tries = 0;
      helped = false;
      point(null);
      if (spelling()) {
        // The letter is wiped off its tile, and the empty tile shows where the new one goes.
        row[s.at].blank = true;
        options = s.letters.map((l) => ({ tile: kit.tile(l.grapheme, rows().size), at: kit.at(0, 0), value: l.grapheme, makes: l.makes, out: false, inWord: false }));
      } else {
        // The new letter drops into place by itself.
        sfx.whoosh();
        row[s.at].vanish();
        const fresh = (row[s.at] = kit.tile(s.graphemes[s.at], scale));
        fresh.snap(slot(s.at));
        later(0.25, () => fresh.hop());
        options = s.words.map((w) => ({ thing: kit.thing(w), at: kit.at(0, 0), value: w, out: false, inWord: false }));
      }
      options.forEach((o, i) => o.tile?.snap(offered(i)));
      place();
      askedAt = t + Math.max(0.6, ask(0.45, true));
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      si = -1;
      phase = 'show';
      timers = [];
      crossing = kit.crossing(item().steps.length);
      const g = item().graphemes;
      scale = wordScale(kit, [[{ text: item().start, graphemes: g, sounds: g, byHeart: g.map(() => false) }]], 0, MOST);
      row = g.map((x) => kit.tile(x, scale));
      row.forEach((tile, i) => tile.snap(slot(i)));
      point(null);
      // The word it sets out from is said, and then the first change is asked for.
      hopRow(0.6);
      later(0.6 + kit.say(wordClip(item().start), 0.6) + 0.5, nextStep);
    };

    const over = () => {
      phase = 'cross';
      row.forEach((tile) => { tile.done = true; });
      point(null);
      const c = kit.companion;
      const far = bank(true);
      const time = Math.hypot(far.x - c.root.position.x, far.z - c.root.position.z) / STROLL;
      c.speed = STROLL;
      c.want.at.copy(far);
      later(time + 0.15, () => { c.speed = walk; kit.cheer(); });
      later(time + 1.7, () => {
        row.forEach((tile) => tile.vanish());
        row = [];
        crossing!.vanish();
        hooks.itemDone();
        next();
      });
    };

    const choose = (o: Option) => {
      const s = step();
      const correct = o === right();
      tries++;
      const ms = Math.max(0, Math.round((t - askedAt) * 1000));
      hooks.attempt({ exercise: 'chain', skills: s.skills, supports: s.supports, target: answer(), answer: o.value, correct, try: tries, helped, ms });
      kit.hush();
      timers = [];
      o.inWord = spelling();
      o.tile?.press();
      if (correct) {
        phase = 'right';
        if (o.tile) o.tile.active = false;
        place();
        options.filter((x) => x !== o).forEach((x) => (x.tile ?? x.thing)!.vanish());
        // The drawing that was right stays while its word is said.
        o.thing?.hop();
        later(1.2, () => o.thing?.vanish());
        // The letter goes to the gap, and the word's own tile takes it on: one tile fades over one that stays, nothing is swapped.
        if (o.inWord) later(0.3, () => { row[s.at].retext(o.value); row[s.at].press(); o.tile!.vanish(); });
        options = [];
        point(null);
        // The word is said, the stone comes up, and on to the next change or over the stream.
        const said = 0.45 + kit.say(wordClip(s.word), 0.45);
        later(0.5, () => hopRow(0));
        later(0.5, () => { crossing!.raise(back() ? item().steps.length - 1 - si : si); sfx.pop(); kit.nod(); });
        later(Math.max(said, 1) + 0.55, si + 1 < item().steps.length ? nextStep : over);
        return;
      }
      sfx.oops();
      o.out = true;
      // A wrong letter stands in the word long enough to be seen there, and says what that spells: a word if it is one,
      // its own sound if not. A wrong drawing says what it is, and goes.
      const heard = kit.say(o.thing || o.makes ? wordClip(o.makes ?? o.value) : soundClip(o.value), 0.45);
      const wait = 0.45 + Math.max(0.7, heard) + 0.2;
      busyUntil = t + wait;
      o.thing?.vanish();
      later(wait, () => { o.inWord = false; place(); });
      later(wait, () => { if (o.tile) o.tile.dim = true; });
      place();
      later(wait + BEFORE_REASK, () => ask(0));
      lastHeard = t + wait + BEFORE_REASK;
      if (tries >= 2 || options.filter((x) => !x.out).length === 1) later(wait, giveHelp);
    };

    const tap = (o: Option) => {
      if (phase === 'ask' && t >= askedAt && t >= busyUntil && !o.out) choose(o);
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = [];
        if (phase !== 'ask' || t < askedAt) return out;
        // A letter of the word says its sound: that is how a word is read, and it costs nothing.
        row.forEach((tile, i) => !tile.blank && out.push({
          id: `letter:${i}`, object: tile.anchor, radius: tile.radius,
          onTap: () => { tile.press(); kit.say(soundClip(tile.text), 0.03); },
        }));
        options.forEach((o, i) => out.push({ id: `option:${i}`, object: o.tile?.anchor ?? o.thing!.root, radius: o.tile?.radius ?? 0.46, enabled: () => !o.out, onTap: () => tap(o) }));
        // The companion says the word. In a spelling step it has been said already; in a reading step that is help.
        out.push({ id: 'again', object: kit.companion.root, radius: 0.38, onTap: () => {
          kit.companion.act('greet');
          if (!spelling()) helped = true;
          lastHeard = t + kit.say(wordClip(step().word), 0.1);
        } });
        return out;
      },

      update(dt) {
        t += dt;
        if (index >= items.length) return;
        const due = timers.filter((x) => t >= x.at);
        timers = timers.filter((x) => t < x.at);
        for (const x of due) x.fn();
        if (phase !== 'ask' || t < askedAt || t < busyUntil) return;
        if (spelling() && t - lastHeard > REPLAY_AFTER) ask(0);
        if (t - askedAt > HELP_AFTER[step().mode]) giveHelp();
      },

      layout() {
        if (index >= items.length) return;
        place();
        if (phase !== 'cross' && !helped) point(null);
      },

      debug() {
        if (phase !== 'ask' || t <= askedAt || t < busyUntil) return { waiting: true };
        return { tap: [`option:${options.indexOf(right())}`] };
      },

      dispose() {
        kit.companion.speed = walk;
        crossing?.vanish();
      },
    };
  },
};
