import { sfx } from '../audio/sound';
import { promptClip, soundClip, wordClip } from '../content/content';
import type { HeartItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { Touchable } from '../stage/touch';
import type { ExerciseModule } from './contract';
import { JOINED, placeLine, standWords, wordScale, type StoodWord } from './wordRow';

// An irregular word. Its tiles are one to a sound, and the ones that do not say what the child
// has been taught carry a heart: that part is learned by heart.
//   meet  "This word is ... the." The child taps each tile to hear what it says here (a heart beats
//         when its tile is tapped), the tiles close up and the word is said. Nothing is asked.
//         The first one ever goes slowly: the companion taps each tile itself, the word is said, the hearts
//         beat while it is said what a heart means, and then the tiles open again for the child to do the same.
//   find  Three words stand together, one is said, and the child taps it. A wrong pick says what
//         it is, then the question again.

type Phase = 'say' | 'show' | 'sound' | 'join' | 'told' | 'ask' | 'leave';

const MEET_SCALE = 1.1;
const ASK_SCALE = 0.8;
/** Between the words of a question, at full size. */
const BETWEEN = 0.8;
const BEFORE_WORD = 0.45;
const NUDGE_AFTER = 7;
const REPLAY_AFTER = 6;
const HELP_AFTER = 14;
const BEFORE_REASK = 2;
/** The first meet: the pause between the companion's taps, and how many times the hearts beat. */
const SHOW_GAP = 1.1;
const BEATS = 3;

export const heartExercise: ExerciseModule<HeartItem> = {
  kind: 'heart',
  clips: (items) => [
    promptClip('this-word-is'), promptClip('learn-this-part-by-heart'), promptClip('which-word-is'),
    ...items.flatMap((i) => [wordClip(i.word), ...i.sounds.map(soundClip), ...i.choices.map((c) => wordClip(c.text))]),
  ],

  start(items, kit, hooks) {
    let index = -1;
    let phase: Phase = 'say';
    let t = 0;
    /** meet: the word. find: the words to choose between, as they stand. */
    let words: StoodWord[] = [];
    let scale = 1;
    let nextSound = 0;
    /** When the next thing happens by itself; Infinity while waiting on the child. */
    let nextAt = Infinity;
    let beatAt = Infinity;
    let beats = 0;
    /** The first meet: the tile the companion taps next, and whether it has shown them all and it is the child's turn. */
    let shown = 0;
    let childTurn = false;
    let asked = false;
    let askedAt = -1;
    let lastHeard = 0;
    let tries = 0;
    let helped = false;

    const item = () => items[index];
    const tiles = () => words.flatMap((w) => w.tiles);

    const place = () => {
      // One line in either layout. (Tried one word behind another on a tall screen: the nearer hid the further.)
      if (item().stage === 'find') return placeLine(kit, words, scale, BETWEEN);
      // To be sounded out the tiles stand apart; then they close up and read as one word.
      const gap = (phase === 'say' || phase === 'show' || phase === 'sound' ? 1.14 : JOINED) * scale;
      words[0].tiles.forEach((tile, i, all) => {
        tile.goal.copy(kit.spot('tiles', 0, 1));
        tile.goal.x = (i - (all.length - 1) / 2) * gap;
      });
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
      return lead + kit.say(wordClip(item().word), lead);
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tries = 0;
      helped = false;
      askedAt = -1;
      nextSound = 0;
      beatAt = Infinity;
      shown = 0;
      childTurn = false;
      point(undefined);
      if (item().stage === 'find') {
        phase = 'ask';
        scale = wordScale(kit, [item().choices], BETWEEN, ASK_SCALE);
        words = standWords(kit, item().choices, scale);
        nextAt = t + 0.5;
      } else {
        phase = 'say';
        scale = Math.min(MEET_SCALE, kit.fit(item().graphemes.length) * MEET_SCALE);
        words = standWords(kit, [{ text: item().word, graphemes: item().graphemes, sounds: item().sounds, byHeart: item().byHeart }], scale);
        // "This word is ... the." Then the tiles open to be tapped.
        nextAt = t + kit.line([promptClip('this-word-is'), wordClip(item().word)], 0.6).end + 0.3;
      }
      place();
      tiles().forEach((tile) => tile.snap(tile.goal));
    };

    const tapSound = (i: number) => {
      if (phase !== 'sound') return;
      const tile = words[0].tiles[i];
      tile.press();
      tile.beat();
      const length = kit.say(soundClip(item().sounds[i]), 0.03);
      if (i !== nextSound) return;
      nextSound++;
      kit.nod();
      if (nextSound < words[0].tiles.length) {
        point(words[0].tiles[nextSound]);
        nextAt = t + NUDGE_AFTER;
        return;
      }
      phase = 'join';
      point(undefined);
      nextAt = t + 0.03 + length + BEFORE_WORD;
    };

    const giveHelp = () => {
      if (helped || phase !== 'ask') return;
      helped = true;
      const right = words.find((w) => w.word.text === item().word)!;
      right.tiles.forEach((tile) => (tile.active = true));
      point(right.tiles[0]);
    };

    const choose = (w: StoodWord) => {
      if (phase !== 'ask' || askedAt < 0 || w.tiles[0].dim) return;
      tries++;
      const correct = w.word.text === item().word;
      hooks.attempt({
        exercise: 'heart',
        skills: item().skills,
        supports: item().supports,
        target: item().word,
        answer: w.word.text,
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
      sayTarget(0.3 + kit.say(wordClip(w.word.text), 0.3) + BEFORE_REASK);
      giveHelp();
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = [];
        if (phase === 'sound') {
          words[0].tiles.forEach((tile, i) => out.push({ id: `sound:${i}`, object: tile.anchor, radius: tile.radius, onTap: () => tapSound(i) }));
        }
        if (phase === 'ask' && askedAt >= 0) {
          for (const w of words) w.tiles.forEach((tile, i) => out.push({
            id: `word:${w.word.text}:${i}`, object: tile.anchor, radius: tile.radius, enabled: () => !tile.dim, onTap: () => choose(w),
          }));
          // Tapping the companion says the word again.
          out.push({ id: 'again', object: kit.companion.root, radius: 0.38, onTap: () => { kit.companion.act('greet'); sayTarget(0.1); } });
        }
        return out;
      },

      update(dt) {
        t += dt;
        if (index >= items.length) return;
        if (item().stage === 'meet') words[0].tiles.forEach((tile, i) => (tile.active = phase === 'sound' && i === nextSound));
        if (t >= beatAt) {
          beatAt = --beats > 0 ? t + 0.7 : Infinity;
          tiles().filter((tile) => tile.byHeart).forEach((tile) => tile.beat());
        }
        if (phase === 'ask' && askedAt >= 0) {
          if (t - lastHeard > REPLAY_AFTER) sayTarget();
          if (t - askedAt > HELP_AFTER) giveHelp();
        }
        if (t < nextAt) return;
        nextAt = Infinity;
        if (phase === 'say' && item().first && !childTurn) {
          // The companion shows how first: it taps each tile in turn, slowly.
          phase = 'show';
          point(words[0].tiles[0]);
          nextAt = t + SHOW_GAP;
        } else if (phase === 'show') {
          const tile = words[0].tiles[shown];
          tile.press();
          tile.beat();
          kit.companion.act('greet');
          const length = kit.say(soundClip(item().sounds[shown]), 0.03);
          shown++;
          if (shown < words[0].tiles.length) {
            point(words[0].tiles[shown]);
            nextAt = t + 0.03 + length + SHOW_GAP;
          } else {
            phase = 'join';
            point(undefined);
            nextAt = t + 0.03 + length + BEFORE_WORD;
          }
        } else if (phase === 'say') {
          phase = 'sound';
          point(words[0].tiles[0]);
          nextAt = t + NUDGE_AFTER;
        } else if (phase === 'sound') {
          // Still waiting for a tap: the companion points again.
          point(words[0].tiles[nextSound]);
          nextAt = t + NUDGE_AFTER;
        } else if (phase === 'join') {
          phase = 'told';
          sfx.whoosh();
          place();
          let end = 0.35 + kit.say(wordClip(item().word), 0.35);
          if (item().first && !childTurn) {
            // The first one ever: the companion goes to a heart, and it is said what a heart means while the hearts beat.
            const said = kit.line([promptClip('learn-this-part-by-heart')], end + 0.5);
            point(tiles().find((tile) => tile.byHeart));
            beatAt = t + said.lastAt;
            beats = BEATS;
            end = Math.max(said.end, end + 0.7 * BEATS);
          }
          nextAt = t + end + 0.9;
        } else if (phase === 'told' && item().first && !childTurn) {
          // Now the child: the tiles open again to be tapped.
          childTurn = true;
          phase = 'sound';
          nextSound = 0;
          place();
          point(words[0].tiles[0]);
          nextAt = t + NUDGE_AFTER;
        } else if (phase === 'told') {
          phase = 'leave';
          tiles().forEach((tile, i) => setTimeout(() => tile.hop(), i * 70));
          kit.nod();
          point(undefined);
          nextAt = t + 0.6;
        } else if (phase === 'ask') {
          // "Which word is ... the?" the first time; after that the word alone.
          const said = asked ? { lastAt: 0, end: kit.say(wordClip(item().word)) } : kit.line([promptClip('which-word-is'), wordClip(item().word)]);
          asked = true;
          lastHeard = t + said.lastAt;
          askedAt = t + said.end;
        } else {
          tiles().forEach((tile) => tile.vanish());
          hooks.itemDone();
          next();
        }
      },

      layout() {
        if (index < items.length) place();
      },

      debug() {
        if (phase === 'sound') return { tap: [`sound:${nextSound}`] };
        if (phase === 'ask' && askedAt >= 0 && t > askedAt) return { tap: [`word:${item().word}:0`] };
        return { waiting: true };
      },
      dispose() {},
    };
  },
};
