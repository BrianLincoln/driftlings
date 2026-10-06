import { promptClip, soundClip } from '../content/content';
import type { MeetItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { ExerciseModule } from './contract';

// Meet a letter: one big tile, the narrator says its sound, and the child taps
// it a few times to hear it again. Exposure only; nothing is scored.

const TAPS = 3;

export const meet: ExerciseModule<MeetItem> = {
  kind: 'meet',
  clips: (items) => [promptClip('listen'), ...items.map((i) => soundClip(i.grapheme))],

  start(items, kit, hooks) {
    let index = -1;
    let tile: LetterTile | null = null;
    let taps = 0;
    let t = 0;
    let saidAt = -1;
    let leaveAt = -1;

    const place = () => tile?.goal.copy(kit.spot('tiles', 0, 1));
    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tile = kit.tile(items[index].grapheme, 1.3);
      tile.snap(kit.spot('tiles', 0, 1));
      taps = 0;
      t = 0;
      saidAt = -1;
      leaveAt = -1;
      kit.companion.want.pose = 'point';
      kit.companion.want.face = tile.anchor.getWorldPosition(kit.companion.want.face ?? tile.goal.clone());
      kit.companion.want.at.copy(kit.besideSpot(tile));
      kit.companion.nudge();
    };
    next();

    return {
      touchables: () =>
        tile && saidAt >= 0 && leaveAt < 0
          ? [{ id: 'tile:0', object: tile.anchor, radius: tile.radius, onTap: () => {
              if (!tile) return;
              tile.press();
              kit.say(soundClip(tile.text), 0.03);
              kit.nod();
              if (++taps >= TAPS) {
                tile.active = false;
                tile.done = true;
                tile.hop();
                kit.cheer();
                leaveAt = t + 1.1;
              }
            } }]
          : [],
      update(dt) {
        t += dt;
        if (!tile) return;
        if (saidAt < 0 && t > 0.6) {
          // "Listen", then the sound. The tile lights up once it has been heard.
          const lead = index === 0 ? kit.say(promptClip('listen')) + 0.25 : 0;
          saidAt = t + lead + kit.say(soundClip(tile.text), lead);
          tile.press(0.6);
        }
        if (saidAt >= 0 && t > saidAt && leaveAt < 0) tile.active = true;
        if (leaveAt > 0 && t > leaveAt) {
          tile.vanish();
          tile = null;
          hooks.itemDone();
          next();
        }
      },
      layout: place,
      debug: () => (tile && saidAt >= 0 && t > saidAt && leaveAt < 0 ? { tap: ['tile:0'] } : { waiting: true }),
      dispose() {},
    };
  },
};
