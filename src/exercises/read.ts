import * as THREE from 'three';
import { sfx } from '../audio/sound';
import { promptClip, soundClip, wordClip } from '../content/content';
import { pictureLabel } from '../learn/generator';
import type { Picture, ReadItem, ReadWord } from '../learn/items';
import type { Thing } from '../scenes/things';
import type { Touchable } from '../stage/touch';
import type { ExerciseModule } from './contract';
import { placeLine, standWords, wordScale, type StoodWord } from './wordRow';

// Words nobody says. A phrase ("the cat") or a sentence ("the bug is on the bed") stands on its
// tiles, and below it three things, or three little scenes. The child reads, and taps the one the
// words describe. Tapping a letter says its sound, which is how reading is done and costs nothing;
// tapping the companion has it read the words aloud, which is help and is reported as help.
// When the right one is tapped the words are read back, each word hopping as it is said.

type Phase = 'read' | 'back' | 'leave';

interface Choice {
  picture: Picture;
  /** The thing itself, then what it is on or in. */
  things: Thing[];
  out: boolean;
}

/** Between words, at full size. */
const BETWEEN = 0.55;
const MOST = 0.8;
/** On a tall screen more tiles than this go on two lines, this far up the clearing. */
const ONE_LINE = 8;
const LINES_Z = [0.15, 1.5];
/** How long the child may look before the companion reads it to them. */
const READ_FOR_THEM_AFTER = 25;
/** A word read back takes at least this long, so its hop can be seen. */
const WORD_BEAT = 0.42;
/** How much of itself a thing sinks into what it is in. */
const SUNK = 0.45;

const box = new THREE.Box3();
const top = (thing: Thing) => {
  thing.root.geometry.computeBoundingBox();
  return box.copy(thing.root.geometry.boundingBox!).max.y;
};

export const readExercise: ExerciseModule<ReadItem> = {
  kind: 'read',
  clips: (items) => [
    promptClip('your-turn-read-it'), promptClip('tap-what-it-says'),
    ...items.flatMap((i) => [
      ...i.words.flatMap((w) => [wordClip(w.text), ...w.sounds.map(soundClip)]),
      ...i.choices.flatMap((c) => [wordClip(c.thing), ...(c.where ? [wordClip(c.where.thing)] : [])]),
    ]),
  ],

  start(items, kit, hooks) {
    let index = -1;
    let phase: Phase = 'read';
    let t = 0;
    let words: StoodWord[] = [];
    let lines: StoodWord[][] = [];
    let scale = 1;
    let choices: Choice[] = [];
    let openAt = 0;
    let nextAt = Infinity;
    /** The words being read back: when each is said, so it can hop. */
    let hops: Array<{ at: number; word: StoodWord }> = [];
    let tries = 0;
    let helped = false;

    const item = () => items[index];
    const right = () => choices.find((c) => pictureLabel(c.picture) === pictureLabel(item().target))!;

    /** Where a tall screen breaks a long sentence in two: where the lines come out most alike in length. 0 for one line. */
    const breakAt = (): number => {
      const ws = item().words;
      const count = (xs: ReadWord[]) => xs.reduce((n, w) => n + w.graphemes.length, 0);
      if (kit.mode !== 'tall' || count(ws) <= ONE_LINE || ws.length < 2) return 0;
      const uneven = (i: number) => Math.abs(count(ws.slice(0, i)) - count(ws.slice(i)));
      return ws.map((_, i) => i).slice(1).reduce((best, i) => (uneven(i) < uneven(best) ? i : best), 1);
    };
    const inLines = <T,>(xs: T[]): T[][] => (breakAt() ? [xs.slice(0, breakAt()), xs.slice(breakAt())] : [xs]);

    const place = () => {
      lines = inLines(words);
      lines.forEach((line, i) => placeLine(kit, line, scale, BETWEEN, lines.length > 1 ? LINES_Z[i] : undefined));
      choices.forEach((c, i) => {
        const [thing, under] = c.things;
        const at = kit.spot('options', i, choices.length);
        (under ?? thing).root.position.copy(at);
        if (!under) return;
        // On it: standing on its highest point. In it: sunk part of the way, so it looks out over the rim.
        thing.root.position.copy(at);
        thing.root.position.y += top(under) - (c.picture.where!.rel === 'in' ? top(thing) * SUNK : 0.02);
      });
    };

    const point = (c: Choice | undefined) => {
      const want = kit.companion.want;
      const base = c?.things[c.things.length - 1].root.position;
      want.pose = base ? 'point' : 'stand';
      want.face = base ? base.clone().setY(base.y + 0.3) : null;
      want.at.copy(base ? base.clone().setX(base.x - 0.62).setY(0) : kit.sideSpot());
      if (base) kit.companion.nudge();
    };

    /** The words said one after another, each hopping as it is said. Returns the seconds until it is over. */
    const readAloud = (lead: number): number => {
      let at = lead;
      hops = [];
      for (const w of words) {
        hops.push({ at: t + at, word: w });
        at += Math.max(WORD_BEAT, kit.say(wordClip(w.word.text), at) + 0.12);
      }
      return at;
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      phase = 'read';
      tries = 0;
      helped = false;
      hops = [];
      point(undefined);
      // The size is settled by the layout the item opens in.
      scale = wordScale(kit, inLines(item().words), BETWEEN, MOST);
      words = standWords(kit, item().words, scale);
      choices = item().choices.map((picture) => ({
        picture,
        things: [kit.thing(picture.thing), ...(picture.where ? [kit.thing(picture.where.thing)] : [])],
        out: false,
      }));
      place();
      words.forEach((w) => w.tiles.forEach((tile) => tile.snap(tile.goal)));
      // "Your turn. Read it. Tap what it says." Once a round; after that the words just stand there.
      openAt = t + 0.5 + (index === 0 ? kit.line([promptClip('your-turn-read-it'), promptClip('tap-what-it-says')], 0.5).end : 0);
      nextAt = openAt + READ_FOR_THEM_AFTER;
    };

    const choose = (c: Choice) => {
      if (phase !== 'read' || t < openAt || c.out) return;
      tries++;
      const correct = c === right();
      hooks.attempt({
        exercise: 'read',
        skills: item().skills,
        supports: item().supports,
        target: pictureLabel(item().target),
        answer: pictureLabel(c.picture),
        correct,
        try: tries,
        helped,
        ms: Math.max(0, Math.round((t - openAt) * 1000)),
      });
      kit.hush();
      if (correct) {
        phase = 'back';
        choices.filter((x) => x !== c).forEach((x) => { x.out = true; x.things.forEach((thing) => thing.vanish()); });
        c.things.forEach((thing) => thing.hop());
        kit.cheer();
        point(undefined);
        nextAt = t + readAloud(0.5) + 0.9;
        return;
      }
      // It goes away, saying what it is: the word that made it the wrong one.
      const mine = c.picture.where && c.picture.thing === item().target.thing ? c.picture.where.thing : c.picture.thing;
      c.out = true;
      c.things.forEach((thing) => thing.vanish());
      sfx.oops();
      kit.say(wordClip(mine), 0.3);
      const left = choices.filter((x) => !x.out);
      if (left.length === 1) {
        helped = true;
        point(left[0]);
      }
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = [];
        if (phase !== 'read' || t < openAt) return out;
        words.forEach((w, n) => w.tiles.forEach((tile, i) => out.push({
          id: `letter:${n}:${i}`, object: tile.anchor, radius: tile.radius,
          onTap: () => { tile.press(); tile.beat(); kit.say(soundClip(w.word.sounds[i]), 0.03); },
        })));
        choices.forEach((c, i) => out.push({
          id: `pick:${i}`, object: c.things[c.things.length - 1].root, radius: 0.46, enabled: () => !c.out, onTap: () => choose(c),
        }));
        // Tapping the companion has it read the words aloud. That is help.
        out.push({ id: 'again', object: kit.companion.root, radius: 0.38, onTap: () => { kit.companion.act('greet'); helped = true; readAloud(0.1); } });
        return out;
      },

      update(dt) {
        t += dt;
        if (index >= items.length) return;
        for (const h of hops) if (t >= h.at) h.word.tiles.forEach((tile) => tile.hop());
        hops = hops.filter((h) => t < h.at);
        if (t < nextAt) return;
        nextAt = Infinity;
        if (phase === 'read') {
          // Nothing tapped in a long while: it is read to them, and what they tap after is helped.
          helped = true;
          nextAt = t + readAloud(0) + READ_FOR_THEM_AFTER;
        } else if (phase === 'back') {
          phase = 'leave';
          words.forEach((w) => w.tiles.forEach((tile) => { tile.done = true; }));
          nextAt = t + 0.5;
        } else {
          words.forEach((w) => w.tiles.forEach((tile) => tile.vanish()));
          choices.forEach((c) => c.things.forEach((thing) => thing.vanish()));
          hooks.itemDone();
          next();
        }
      },

      layout() {
        if (index < items.length) place();
      },

      debug() {
        if (phase === 'read' && t >= openAt) return { tap: [`pick:${choices.indexOf(right())}`] };
        return { waiting: true };
      },
      dispose() {},
    };
  },
};
