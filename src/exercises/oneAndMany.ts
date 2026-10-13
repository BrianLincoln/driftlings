import { sfx } from '../audio/sound';
import { promptClip, soundClip, wordClip } from '../content/content';
import type { ManyItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { Thing } from '../scenes/things';
import type { Touchable } from '../stage/touch';
import type { ExerciseModule } from './contract';

// One of a thing, then several, and an s on the end of its word.
//   show  The word stands over one of the thing: "One cup." Two more pop in and an s lights up
//         beside the word; the child taps it, it says its sound and slides on: "Lots of cups."
//   ask   The word for one and the word for several stand together, one of them is
//         said, and the child taps it. A wrong pick says what it is, then the question again.

type Phase = 'one' | 'add' | 'join' | 'ask' | 'leave';

const TILE_SCALE = 0.85;
/** Tiles of a word touch, as they do once a word has been built. */
const GAP = 0.94 * TILE_SCALE;
/** The two words of a question are a little smaller: on a wide screen they stand side by side, this far apart. */
const ASK_SCALE = 0.8;
const BETWEEN = 0.7;
/** On a tall screen one stands behind the other, far enough back that the nearer does not cover it. */
const FAR_Z = 0.35;
/** How far off the end of the word the s waits to be tapped on. */
const APART = 0.25;
const BEFORE_WORD = 0.45;
const NUDGE_AFTER = 7;
const REPLAY_AFTER = 6;
const HELP_AFTER = 14;
const BEFORE_REASK = 2;

const plural = (i: ManyItem) => `${i.base}s`;
/** What is said once, before the first thing is shown: the rule, or that s has another sound. */
const intro = (i: ManyItem) => (i.sound === 's' ? [promptClip('add-s-means-more-than-one')] : [promptClip('sometimes-s-makes-the-sound'), soundClip(i.sound)]);

export const oneAndMany: ExerciseModule<ManyItem> = {
  kind: 'many',
  clips: (items) => [
    promptClip('one'), promptClip('lots-of'), promptClip('which-word-is'),
    ...items.flatMap((i) => [...intro(i), soundClip(i.sound), wordClip(i.base), wordClip(plural(i))]),
  ],

  start(items, kit, hooks) {
    let index = -1;
    let phase: Phase = 'one';
    let t = 0;
    /** show: the word's tiles, then its s. ask: both words' tiles. */
    let tiles: LetterTile[] = [];
    let things: Thing[] = [];
    let ending: LetterTile | null = null;
    /** ask: the two words, in the order they stand: left then right, or far then near. */
    let words: Array<{ word: string; tiles: LetterTile[] }> = [];
    let introduced = false;
    let asked = false;
    /** When the next thing happens by itself; Infinity while waiting on the child. */
    let nextAt = Infinity;
    let openAt = 0;
    let lastHeard = 0;
    let askedAt = -1;
    let tries = 0;
    let helped = false;

    const item = () => items[index];
    const at = (row: 'tiles' | 'options', x: number) => {
      const p = kit.spot(row, 0, 1);
      p.x = x;
      return p;
    };
    const wordX = (i: number, count: number) => (i - (count - 1) / 2) * GAP;

    const place = () => {
      if (item().stage === 'ask') {
        const gap = GAP * (ASK_SCALE / TILE_SCALE);
        const [a, b] = words.map((w) => w.tiles.length);
        const left = -((a + b) * gap + BETWEEN) / 2 + gap / 2;
        words.forEach((w, n) => w.tiles.forEach((tile, i) => {
          if (kit.mode === 'wide') return void tile.goal.copy(at('tiles', left + i * gap + n * (a * gap + BETWEEN)));
          tile.goal.copy(at(n === 0 ? 'tiles' : 'options', (i - (w.tiles.length - 1) / 2) * gap));
          if (n === 0) tile.goal.z = FAR_Z;
        }));
        return;
      }
      // The word leaves room for its s from the start, so nothing shifts when it arrives.
      const n = item().graphemes.length + 1;
      tiles.forEach((tile, i) => tile.goal.copy(at('tiles', wordX(i, n))));
      if (ending) ending.goal.copy(at('tiles', wordX(n - 1, n) + (phase === 'add' ? APART : 0)));
      things.forEach((thing, i) => thing.root.position.copy(kit.spot('options', [1, 0, 2][i], 3)));
    };

    const point = (tile: LetterTile | undefined) => {
      const c = kit.companion;
      c.want.pose = tile ? 'point' : 'stand';
      c.want.face = tile ? tile.goal.clone().setY(tile.goal.y + 0.5) : null;
      c.want.at.copy(tile ? kit.besideSpot(tile) : kit.sideSpot());
      if (tile) c.nudge();
    };

    const sayTarget = (lead = 0) => {
      lastHeard = t + lead;
      return lead + kit.say(wordClip(item().target), lead);
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tiles = [];
      things = [];
      words = [];
      ending = null;
      tries = 0;
      helped = false;
      askedAt = -1;
      point(undefined);
      if (item().stage === 'ask') {
        phase = 'ask';
        // Which of the two comes first is chance, so the place says nothing about the answer.
        const pair = [item().base, plural(item())];
        if (Math.random() < 0.5) pair.reverse();
        words = pair.map((word) => ({ word, tiles: [...word].map((g) => kit.tile(g, ASK_SCALE)) }));
        tiles = words.flatMap((w) => w.tiles);
        nextAt = t + 0.5;
      } else {
        phase = 'one';
        tiles = item().graphemes.map((g) => kit.tile(g, TILE_SCALE));
        things = [kit.thing(item().base)];
        // The rule first, the first time; then "One ... cup."
        const lead = introduced ? 0.5 : 0.5 + kit.line(intro(item()), 0.5).end + 0.5;
        introduced = true;
        nextAt = t + lead + kit.line([promptClip('one'), wordClip(item().base)], lead).end + 0.5;
      }
      place();
      tiles.forEach((tile) => tile.snap(tile.goal));
    };

    /** Two more of the thing, and the s that goes with them. */
    const more = () => {
      phase = 'add';
      things.push(kit.thing(item().base), kit.thing(item().base));
      ending = kit.tile('s', TILE_SCALE);
      place();
      ending.snap(ending.goal);
      sfx.whoosh();
      openAt = t + 0.5;
      nextAt = openAt + NUDGE_AFTER;
      point(ending);
    };

    const addEnding = () => {
      if (!ending || phase !== 'add' || t < openAt) return;
      phase = 'join';
      ending.press();
      ending.active = false;
      kit.nod();
      point(undefined);
      nextAt = t + 0.03 + kit.say(soundClip(item().sound), 0.03) + BEFORE_WORD;
    };

    /** The s has had its say: it closes up, and the whole thing is said. */
    const join = () => {
      phase = 'leave';
      sfx.whoosh();
      place();
      const said = kit.line([promptClip('lots-of'), wordClip(plural(item()))], 0.35);
      [...tiles, ending!].forEach((tile, i) => { tile.done = true; setTimeout(() => tile.hop(), i * 70); });
      things.forEach((thing) => thing.hop());
      kit.cheer();
      nextAt = t + said.end + 0.9;
    };

    const giveHelp = () => {
      if (helped || phase !== 'ask') return;
      helped = true;
      const right = words.find((w) => w.word === item().target)!;
      right.tiles.forEach((tile) => (tile.active = true));
      point(right.tiles[0]);
    };

    const choose = (w: { word: string; tiles: LetterTile[] }) => {
      if (phase !== 'ask' || askedAt < 0 || w.tiles[0].dim) return;
      tries++;
      const correct = w.word === item().target;
      hooks.attempt({
        exercise: 'many',
        skills: item().skills,
        supports: item().supports,
        target: item().target,
        answer: w.word,
        correct,
        try: tries,
        helped,
        ms: Math.max(0, Math.round((t - askedAt) * 1000)),
      });
      kit.hush();
      if (correct) {
        phase = 'leave';
        w.tiles.forEach((tile, i) => { tile.done = true; tile.active = false; setTimeout(() => tile.hop(), i * 70); });
        words.filter((x) => x !== w).forEach((x) => x.tiles.forEach((tile) => (tile.dim = true)));
        kit.cheer();
        point(undefined);
        nextAt = t + 1.3;
        return;
      }
      w.tiles.forEach((tile) => { tile.shake(); tile.dim = true; });
      sfx.oops();
      // The word says what it is, so the tap is never paired with the other word; then the question again.
      sayTarget(0.3 + kit.say(wordClip(w.word), 0.3) + BEFORE_REASK);
      giveHelp();
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = [];
        if (phase === 'add' && ending && t >= openAt) out.push({ id: 'add', object: ending.anchor, radius: ending.radius, onTap: addEnding });
        if (phase === 'ask' && askedAt >= 0) {
          for (const w of words) w.tiles.forEach((tile, i) => out.push({
            id: `word:${w.word}:${i}`, object: tile.anchor, radius: tile.radius, enabled: () => !tile.dim, onTap: () => choose(w),
          }));
          // Tapping the companion says the word again.
          out.push({ id: 'again', object: kit.companion.root, radius: 0.38, onTap: () => { kit.companion.act('greet'); sayTarget(0.1); } });
        }
        return out;
      },

      update(dt) {
        t += dt;
        if (index >= items.length) return;
        if (ending) ending.active = phase === 'add' && t >= openAt;
        if (phase === 'ask' && askedAt >= 0) {
          if (t - lastHeard > REPLAY_AFTER) sayTarget();
          if (t - askedAt > HELP_AFTER) giveHelp();
        }
        if (t < nextAt) return;
        nextAt = Infinity;
        if (phase === 'one') more();
        else if (phase === 'add') {
          // Still waiting for the s: the companion points again.
          point(ending!);
          nextAt = t + NUDGE_AFTER;
        } else if (phase === 'join') join();
        else if (phase === 'ask') {
          // "Which word is ... cups?" the first time; after that the word alone.
          const said = asked ? { lastAt: 0, end: kit.say(wordClip(item().target)) } : kit.line([promptClip('which-word-is'), wordClip(item().target)]);
          asked = true;
          lastHeard = t + said.lastAt;
          askedAt = t + said.end;
        } else {
          [...tiles, ...(ending ? [ending] : [])].forEach((tile) => tile.vanish());
          things.forEach((thing) => thing.vanish());
          hooks.itemDone();
          next();
        }
      },

      layout() {
        if (index < items.length) place();
      },

      debug() {
        if (phase === 'add' && t >= openAt) return { tap: ['add'] };
        if (phase === 'ask' && askedAt >= 0 && t > askedAt) return { tap: [`word:${item().target}:0`] };
        return { waiting: true };
      },
      dispose() {},
    };
  },
};
