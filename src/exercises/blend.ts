import { sfx } from '../audio/sound';
import { promptClip, soundClip, wordClip } from '../content/content';
import type { BlendItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { Touchable } from '../stage/touch';
import type { ExerciseModule } from './contract';

// Words are built out of letters. Every word starts the same way: tap each
// letter in order to hear its sound, the letters close up, and the word is
// said. How much is asked after that depends on the item's stage:
//   read    nothing more. The idea itself is the lesson.
//   guided  the watcher jumbles the letters; the child taps them in word
//           order, with the next letter lit each time, and they slide back.
//   free    the same with no light. Only this is evidence, so only this is scored.

type Phase = 'sound' | 'word' | 'jumble' | 'build' | 'leave';

const REPLAY_AFTER = 7;
const HELP_AFTER = 12;
/** After the last letter's sound has finished, a beat of quiet before the letters close up and the word is said. */
const BEFORE_WORD = 0.45;

export const blendExercise: ExerciseModule<BlendItem> = {
  kind: 'blend',
  clips: (items) => [
    promptClip('oh-no-mixed-up-tap-in-order'), promptClip('oh-no'), promptClip('tap-the-letters-to-build-the-word'),
    ...items.flatMap((i) => [...i.graphemes.map(soundClip), wordClip(i.word)]),
  ],

  start(items, kit, hooks) {
    let index = -1;
    let phase: Phase = 'sound';
    let tiles: LetterTile[] = [];
    /** The tiles in the order they stand in the word row. */
    let order: LetterTile[] = [];
    /** Which place in the row each tile stands in while the word is jumbled, by tile index. */
    let slots: number[] = [];
    let placed: LetterTile[] = [];
    let t = 0;
    let phaseAt = 0;
    /** Taps count from here: a spoken prompt gets a moment to itself first. */
    let openAt = 0;
    let nextSound = 0;
    let wordEnd = 0;
    /** When the letters close up into the word; Infinity unless the last letter has just been tapped. */
    let joinAt = Infinity;
    let joinThen: 'jumble' | 'celebrate' = 'celebrate';
    let afterWord: 'jumble' | 'celebrate' = 'celebrate';
    let scatterAt = 0;
    /** The watcher lands on the letters to jumble them. Letters are drawn over everything, so they are wiped while it is there. */
    let blankAt = Infinity;
    let clearAt = 0;
    let jumbles = 0;
    let lastHeard = 0;
    let lastMove = 0;
    let wrongs = 0;
    let wrongHere = 0;
    let helped = false;

    const item = () => items[index];
    const go = (p: Phase) => { phase = p; phaseAt = t; };
    const n = () => tiles.length;
    const shown = () => item().stage === 'guided' || helped;
    /** The tile that belongs in the next gap. Either of two matching letters will do. */
    const wanted = () => tiles.find((tile) => !placed.includes(tile) && tile.text === item().graphemes[placed.length]);

    const place = () => {
      if (phase === 'build') {
        tiles.forEach((tile, i) => tile.goal.copy(kit.spot('tiles', slots[i], n())));
        return;
      }
      order.forEach((tile, i) => {
        const p = kit.spot('tiles', i, n());
        // Once sounded out, the tiles close up until they touch and read as one word.
        if (phase !== 'sound') p.x = (i - (n() - 1) / 2) * 0.94;
        tile.goal.copy(p);
      });
    };

    const guide = () => {
      const c = kit.companion;
      const tile = phase === 'sound' ? tiles[nextSound] : phase === 'build' && shown() ? wanted() : undefined;
      c.want.pose = tile ? 'point' : 'stand';
      c.want.face = tile ? tile.goal.clone().setY(tile.goal.y + 0.5) : null;
      c.want.at.copy(tile ? kit.besideSpot(tile) : kit.sideSpot());
      if (tile) c.nudge();
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tiles = item().graphemes.map((g) => kit.tile(g));
      order = [...tiles];
      placed = [];
      nextSound = 0;
      wrongs = 0;
      wrongHere = 0;
      helped = false;
      joinAt = Infinity;
      go('sound');
      tiles.forEach((tile, i) => tile.snap(kit.spot('tiles', i, n())));
      openAt = t + 0.4;
      guide();
    };

    /** The last letter has been tapped: hear it out before anything else happens. */
    const lastLetter = (tile: LetterTile, then: 'jumble' | 'celebrate') => {
      joinAt = t + 0.03 + kit.say(soundClip(tile.text), 0.03) + BEFORE_WORD;
      joinThen = then;
      guide();
    };

    const sayWord = (then: 'jumble' | 'celebrate') => {
      afterWord = then;
      go('word');
      sfx.whoosh();
      place();
      guide();
      wordEnd = t + 0.35 + kit.say(wordClip(item().word), 0.35);
    };

    const scatter = () => {
      // Never back into the right order: there would be nothing to put right.
      const word = item().graphemes.join('');
      do {
        slots = tiles.map((_, i) => i).sort(() => Math.random() - 0.5);
      } while (new Set(word).size > 1 && tiles.every((tile, i) => tile.text === word[slots[i]]));
      go('build');
      place();
      tiles.forEach((tile) => tile.press(1.4));
      sfx.whoosh();
      // The prompt ends "...to build the word", so the word itself always follows it.
      // First time the whole explanation; after that "Oh no! Tap the letters to build the word..."
      const prompts = jumbles++ === 0
        ? [promptClip('oh-no-mixed-up-tap-in-order')]
        : [promptClip('oh-no'), promptClip('tap-the-letters-to-build-the-word')];
      const said = kit.line([...prompts, wordClip(item().word)]);
      openAt = t + Math.min(said.lastAt, 2) + 0.2;
      lastHeard = t + said.end;
      lastMove = openAt;
      guide();
    };

    const tapTile = (i: number) => {
      const tile = tiles[i];
      if (phase === 'sound') {
        tile.press();
        if (i !== nextSound) return void kit.say(soundClip(tile.text), 0.03);
        nextSound++;
        kit.nod();
        if (nextSound >= n()) return lastLetter(tile, item().stage === 'read' ? 'celebrate' : 'jumble');
        kit.say(soundClip(tile.text), 0.03);
        guide();
        return;
      }
      if (phase !== 'build' || placed.includes(tile)) return;
      lastMove = t;
      const scored = item().stage === 'free';
      const report = (correct: boolean, answer: string) => hooks.attempt({
        exercise: 'blend',
        skills: item().skills,
        supports: item().supports,
        target: item().word,
        answer,
        correct,
        try: correct && wrongs > 0 ? 2 : 1,
        helped,
        ms: Math.max(0, Math.round((t - openAt) * 1000)),
      });
      if (tile.text !== item().graphemes[placed.length]) {
        tile.shake();
        sfx.oops();
        // The first slip is the evidence; the fumbling after it is not counted again.
        if (scored && wrongs === 0) report(false, placed.map((x) => x.text).join('') + tile.text);
        wrongs++;
        if (++wrongHere >= 2) helped = true;
        guide();
        return;
      }
      // A chosen letter turns green where it stands. Nothing moves until the
      // last one is chosen; then they all slide into the word together.
      placed.push(tile);
      tile.done = true;
      wrongHere = 0;
      tile.hop();
      if (placed.length < n()) {
        kit.say(soundClip(tile.text), 0.03);
        kit.nod();
        guide();
        return;
      }
      if (scored) report(true, item().word);
      order = placed;
      lastLetter(tile, 'celebrate');
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = [];
        if (t < openAt || joinAt < Infinity) return out;
        if (phase === 'sound') {
          tiles.forEach((tile, i) => out.push({ id: `tile:${i}`, object: tile.anchor, radius: tile.radius, onTap: () => tapTile(i) }));
        }
        if (phase === 'build') {
          tiles.forEach((tile, i) => out.push({
            id: `build:${i}`, object: tile.anchor, radius: tile.radius,
            enabled: () => !placed.includes(tile), onTap: () => tapTile(i),
          }));
          // Tapping the companion says the word again.
          out.push({ id: 'again', object: kit.companion.root, radius: 0.38, onTap: () => { kit.companion.act('greet'); lastHeard = t + kit.say(wordClip(item().word), 0.1); } });
        }
        return out;
      },

      update(dt) {
        t += dt;
        if (index >= items.length) return;
        const open = t >= openAt;
        const lit = phase === 'sound' ? tiles[nextSound] : phase === 'build' && shown() ? wanted() : undefined;
        tiles.forEach((tile) => (tile.active = open && tile === lit));
        if (t >= joinAt) {
          joinAt = Infinity;
          sayWord(joinThen);
        }
        if (phase === 'word' && t > wordEnd + 0.25) {
          if (afterWord === 'jumble') {
            go('jumble');
            const { lands, clear } = kit.trouble();
            scatterAt = t + lands;
            blankAt = scatterAt - 0.2;
            clearAt = t + clear;
          } else {
            order.forEach((tile, i) => { tile.done = true; setTimeout(() => tile.hop(), i * 70); });
            kit.cheer();
            go('leave');
          }
        }
        if (phase === 'jumble' && t >= scatterAt) scatter();
        tiles.forEach((tile) => (tile.blank = t >= blankAt && t < clearAt));
        if (phase === 'build' && open && joinAt === Infinity) {
          if (t - lastHeard > REPLAY_AFTER) lastHeard = t + kit.say(wordClip(item().word));
          if (!helped && t - lastMove > HELP_AFTER) {
            helped = true;
            guide();
          }
        }
        if (phase === 'leave' && t - phaseAt > 1.5) {
          tiles.forEach((x) => x.vanish());
          tiles = [];
          order = [];
          hooks.itemDone();
          next();
        }
      },

      layout() {
        place();
        guide();
      },

      debug() {
        if (t < openAt || joinAt < Infinity) return { waiting: true };
        if (phase === 'sound') return { tap: [`tile:${nextSound}`] };
        if (phase === 'build') return { tap: [`build:${tiles.indexOf(wanted()!)}`] };
        return { waiting: true };
      },
      dispose() {},
    };
  },
};
