import { hasClip, promptClip, soundClip, type ClipId } from '../content/content';
import type { MeetItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { ExerciseModule } from './contract';

// Meet a letter. The narrator names it and says its sound, the companion
// shows what to do by tapping the tile itself, and then it is the child's
// turn: three taps, each one saying the sound again. Exposure only; nothing
// is scored.

const TAPS = 3;
const NUDGE_AFTER = 6;
const nameClip = (g: string): ClipId => `letters/${g}-name`;

type Phase = 'arrive' | 'tell' | 'show' | 'yours' | 'leave';

export const meet: ExerciseModule<MeetItem> = {
  kind: 'meet',
  clips: (items) => [
    promptClip('this-is-the-letter'), promptClip('it-makes-the-sound'), promptClip('now-you-say-it-with-me'), promptClip('listen'),
    ...items.flatMap((i) => [soundClip(i.grapheme), nameClip(i.grapheme)]),
  ],

  start(items, kit, hooks) {
    let index = -1;
    let tile: LetterTile | null = null;
    let phase: Phase = 'arrive';
    let taps = 0;
    let t = 0;
    let until = 0;
    let touched = false;
    let lastAction = 0;

    const go = (p: Phase, lasts: number) => { phase = p; until = t + lasts; };
    const sound = () => soundClip(tile!.text);

    /** The companion taps the tile: this is the whole instruction. */
    const show = () => {
      kit.companion.act('show');
      touched = false;
      lastAction = t;
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tile = kit.tile(items[index].grapheme, 1.3);
      tile.snap(kit.spot('tiles', 0, 1));
      taps = 0;
      t = 0;
      go('arrive', 0.6);
      const c = kit.companion;
      c.want.pose = 'stand';
      c.want.face = tile.anchor.getWorldPosition(c.want.face ?? tile.goal.clone());
      c.want.at.copy(kit.besideSpot(tile));
    };
    next();

    return {
      touchables: () =>
        tile && phase === 'yours'
          ? [{ id: 'tile:0', object: tile.anchor, radius: tile.radius, onTap: () => {
              if (!tile) return;
              tile.press();
              kit.say(sound(), 0.03);
              kit.nod();
              lastAction = t;
              tile.pips(++taps, TAPS);
              if (taps >= TAPS) {
                tile.active = false;
                tile.done = true;
                tile.hop();
                kit.cheer();
                go('leave', 1.2);
              }
            } }]
          : [],

      update(dt) {
        t += dt;
        if (!tile) return;
        // The companion's reach lands a moment after it starts: that is when the tile reacts.
        if (!touched && (phase === 'show' || phase === 'yours') && t - lastAction > 0.32) {
          touched = true;
          tile.press();
          kit.say(sound());
        }
        if (phase === 'yours' && t - lastAction > NUDGE_AFTER) show();
        if (t < until) return;

        if (phase === 'arrive') {
          const g = tile.text;
          let d = 0;
          if (hasClip(nameClip(g))) {
            // "This is the letter [name]. It makes the sound [sound]."
            d += kit.say(promptClip('this-is-the-letter'), d);
            d += kit.say(nameClip(g), d) + 0.25;
            d += kit.say(promptClip('it-makes-the-sound'), d) + 0.05;
          } else {
            d += kit.say(promptClip('listen'), d) + 0.2;
          }
          d += kit.say(sound(), d);
          tile.press(0.6);
          go('tell', d + 0.35);
        } else if (phase === 'tell') {
          show();
          go('show', 1.3);
        } else if (phase === 'show') {
          const d = index === 0 ? kit.say(promptClip('now-you-say-it-with-me')) : 0;
          tile.active = true;
          tile.pips(0, TAPS);
          lastAction = t + d;
          touched = true;
          phase = 'yours';
          until = Infinity;
        } else if (phase === 'leave') {
          tile.vanish();
          tile = null;
          hooks.itemDone();
          next();
        }
      },

      layout() {
        tile?.goal.copy(kit.spot('tiles', 0, 1));
      },
      debug: () => (tile && phase === 'yours' ? { tap: ['tile:0'] } : { waiting: true }),
      dispose() {},
    };
  },
};
