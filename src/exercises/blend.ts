import { sfx } from '../audio/sound';
import { soundClip, wordClip } from '../content/content';
import type { BlendItem } from '../learn/items';
import { SPEAKER_ICON, type LetterTile } from '../scenes/letterTile';
import type { Touchable } from '../stage/touch';
import type { ExerciseModule } from './contract';

// Blending. Tap each letter to hear its sound, slide across to blend them,
// then, without being told the word, pick which spoken word it was. The pick
// is the evidence: tapping and sliding prove nothing about reading.

type Phase = 'sound' | 'slide' | 'merge' | 'listen' | 'choose' | 'leave';

/** Taps in order this close together also count as a slide: a four-year-old's drag is not reliable. */
const TAP_CHAIN_GAP = 1.6;

export const blendExercise: ExerciseModule<BlendItem> = {
  kind: 'blend',
  clips: (items) => items.flatMap((i) => [...i.graphemes.map(soundClip), ...i.choices.map(wordClip)]),

  start(items, kit, hooks) {
    let index = -1;
    let phase: Phase = 'sound';
    let tiles: LetterTile[] = [];
    let options: LetterTile[] = [];
    let t = 0;
    let phaseAt = 0;
    let nextSound = 0;
    let crossed = 0;
    let dragging = false;
    let lastX = 0;
    let lastChainTap = -10;
    let demo = 0;
    let speaking = -1;
    let speakAt = 0;
    let askedAt = 0;
    let tries = 0;
    let helped = false;

    const item = () => items[index];
    const go = (p: Phase) => { phase = p; phaseAt = t; };
    const n = () => tiles.length;

    const placeTiles = (merged: boolean) => tiles.forEach((tile, i) => {
      const p = kit.spot('tiles', i, n());
      // Merged: the tiles close up until they touch and read as one word.
      if (merged) p.x = (i - (n() - 1) / 2) * 0.94;
      tile.goal.copy(p);
    });
    const placeOptions = () => options.forEach((o, i) => o.goal.copy(kit.spot('options', i, options.length)));

    const pointAt = (tile: LetterTile | null) => {
      const c = kit.companion;
      if (!tile) {
        c.want.pose = 'stand';
        c.want.face = null;
        c.want.at.copy(kit.sideSpot());
        return;
      }
      c.want.pose = 'point';
      c.want.face = tile.anchor.getWorldPosition(tile.goal.clone());
      c.want.at.copy(kit.besideSpot(tile));
      c.nudge();
    };

    const markNext = () => {
      tiles.forEach((tile, i) => (tile.active = phase === 'sound' && i === nextSound));
      pointAt(phase === 'sound' ? tiles[nextSound] ?? null : null);
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tiles = item().graphemes.map((g) => kit.tile(g));
      options = [];
      tiles.forEach((tile, i) => tile.snap(kit.spot('tiles', i, n())));
      nextSound = 0;
      crossed = 0;
      tries = 0;
      helped = false;
      speaking = -1;
      go('sound');
      markNext();
    };

    const startSlide = () => {
      go('slide');
      crossed = 0;
      demo = 0;
      tiles.forEach((tile) => (tile.active = false));
      kit.companion.want.pose = 'stand';
      kit.companion.want.face = null;
    };

    const cross = (i: number) => {
      tiles[i].press(0.8);
      kit.say(soundClip(tiles[i].text));
      crossed = i + 1;
      if (crossed >= n()) {
        go('merge');
        sfx.whoosh();
        placeTiles(true);
        pointAt(null);
      }
    };

    const speakOptions = (from = 0) => {
      speaking = from - 1;
      speakAt = t + 0.35;
      go('listen');
    };

    const tapTile = (i: number) => {
      const tile = tiles[i];
      if (phase === 'sound') {
        tile.press();
        kit.say(soundClip(tile.text), 0.03);
        if (i === nextSound) {
          nextSound++;
          kit.nod();
          if (nextSound >= n()) startSlide();
          else markNext();
        }
      } else if (phase === 'slide' && !dragging) {
        // A quick run of taps in order is accepted as a slide.
        if (i === 0 || (i === crossed && t - lastChainTap < TAP_CHAIN_GAP)) {
          if (i === 0) crossed = 0;
          lastChainTap = t;
          cross(i);
        } else {
          tile.press();
          kit.say(soundClip(tile.text), 0.03);
        }
      }
    };

    const choose = (o: LetterTile, word: string) => {
      if (phase !== 'choose' || o.dim) return;
      tries++;
      const correct = word === item().word;
      hooks.attempt({
        exercise: 'blend',
        skills: item().skills,
        supports: item().supports,
        target: item().word,
        answer: word,
        correct,
        try: tries,
        helped,
        ms: Math.max(0, Math.round((t - askedAt) * 1000)),
      });
      o.press();
      if (correct) {
        o.done = true;
        o.active = false;
        o.hop();
        options.forEach((x) => (x.dim = x !== o));
        tiles.forEach((tile, i) => { tile.done = true; setTimeout(() => tile.hop(), i * 70); });
        kit.say(wordClip(word), 0.15);
        kit.cheer();
        go('leave');
      } else {
        o.shake();
        o.dim = true;
        sfx.oops();
        // One left is no choice at all: from here the answer has been given away.
        if (options.filter((x) => !x.dim).length <= 1) {
          helped = true;
          options.find((x, i) => item().choices[i] === item().word && !x.dim)!.active = true;
        }
        speakOptions(options.findIndex((x) => !x.dim));
      }
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = [];
        if (phase === 'sound' || phase === 'slide') {
          tiles.forEach((tile, i) => out.push({ id: `tile:${i}`, object: tile.anchor, radius: tile.radius, onTap: () => tapTile(i) }));
        }
        if (phase === 'choose') {
          options.forEach((o, i) => out.push({
            id: `option:${item().choices[i]}`, object: o.anchor, radius: Math.max(0.42, o.radius),
            enabled: () => !o.dim, onTap: () => choose(o, item().choices[i]),
          }));
          out.push({ id: 'again', object: kit.companion.root, radius: 0.38, onTap: () => { kit.companion.act('greet'); speakOptions(options.findIndex((x) => !x.dim)); } });
        }
        return out;
      },

      pointer(kind, x) {
        if (phase !== 'slide') { dragging = false; return; }
        if (kind === 'down') { dragging = true; lastX = x; if (t - lastChainTap > 0.05) crossed = Math.min(crossed, 1); return; }
        if (kind === 'up') {
          // The slide must be one movement; lifting early starts it again.
          if (dragging && crossed < n() && t - lastChainTap > TAP_CHAIN_GAP) crossed = 0;
          dragging = false;
          return;
        }
        if (!dragging) return;
        while (crossed < n() && phase === 'slide') {
          const cx = kit.screenX(tiles[crossed]);
          const passed = crossed === 0 ? Math.abs(x - cx) < 40 || (lastX < cx && x >= cx) : x >= cx;
          if (!passed) break;
          lastChainTap = t;
          cross(crossed);
        }
        lastX = x;
      },

      update(dt) {
        t += dt;
        if (index >= items.length) return;
        if (phase === 'slide') {
          // The companion shows how: it glides along the row, again and again.
          demo = (demo + dt / 2.6) % 1;
          const k = Math.min(1, demo / 0.62);
          const a = kit.besideSpot(tiles[0]);
          const b = kit.besideSpot(tiles[n() - 1]);
          if (!dragging) kit.companion.want.at.set(a.x + (b.x - a.x + 0.9) * k, 0, a.z);
          const lit = Math.floor(k * n() * 0.999);
          tiles.forEach((tile, i) => (tile.active = !dragging && k < 1 && i === lit));
        }
        if (phase === 'merge' && t - phaseAt > 0.75) {
          options = item().choices.map(() => kit.tile(SPEAKER_ICON, 0.62, true));
          options.forEach((o, i) => o.snap(kit.spot('options', i, options.length)));
          speakOptions();
        }
        if (phase === 'listen' && t >= speakAt) {
          // Each option says its word in turn, lighting up as it speaks.
          options.forEach((o) => { if (!helped) o.active = false; });
          speaking++;
          while (speaking < options.length && options[speaking].dim) speaking++;
          if (speaking >= options.length) {
            askedAt = t;
            go('choose');
          } else {
            const o = options[speaking];
            o.press(0.7);
            o.active = true;
            speakAt = t + kit.say(wordClip(item().choices[speaking])) + 0.45;
          }
        }
        if (phase === 'leave' && t - phaseAt > 1.7) {
          [...tiles, ...options].forEach((x) => x.vanish());
          tiles = [];
          options = [];
          hooks.itemDone();
          next();
        }
      },

      layout() {
        placeTiles(phase !== 'sound' && phase !== 'slide');
        placeOptions();
      },

      debug() {
        if (phase === 'sound') return { tap: [`tile:${nextSound}`] };
        if (phase === 'slide') return { slide: true };
        if (phase === 'choose') return { tap: [`option:${item().word}`] };
        return { waiting: true };
      },
      dispose() {},
    };
  },
};
