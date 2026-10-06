import { hasClip, promptClip, soundClip, type ClipId } from '../content/content';
import type { MeetItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { ExerciseModule } from './contract';

// Meet a letter: it appears, the narrator names it and says its sound, and
// after a beat the lesson moves on. Nothing to tap and nothing scored; the
// questions that follow are where the child answers.

const nameClip = (g: string): ClipId => `letters/${g}-name`;

export const meet: ExerciseModule<MeetItem> = {
  kind: 'meet',
  clips: (items) => [
    promptClip('this-is-the-letter'), promptClip('it-makes-the-sound'), promptClip('listen'),
    ...items.flatMap((i) => [soundClip(i.grapheme), nameClip(i.grapheme)]),
  ],

  start(items, kit, hooks) {
    let index = -1;
    let tile: LetterTile | null = null;
    let t = 0;
    let told = false;
    /** When the sound itself is spoken, so the tile can react on it. */
    let soundAt = Infinity;
    let leaveAt = Infinity;

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tile = kit.tile(items[index].grapheme, 1.3);
      tile.snap(kit.spot('tiles', 0, 1));
      t = 0;
      told = false;
      soundAt = leaveAt = Infinity;
      const c = kit.companion;
      c.want.pose = 'point';
      c.want.face = tile.anchor.getWorldPosition(c.want.face ?? tile.goal.clone());
      c.want.at.copy(kit.besideSpot(tile));
      c.nudge();
    };
    next();

    return {
      touchables: () => [],
      update(dt) {
        t += dt;
        if (!tile) return;
        if (!told && t > 0.6) {
          told = true;
          const g = tile.text;
          // "This is the letter [name]. It makes the sound [sound]."
          const said = kit.line(
            hasClip(nameClip(g))
              ? [promptClip('this-is-the-letter'), nameClip(g), promptClip('it-makes-the-sound'), soundClip(g)]
              : [promptClip('listen'), soundClip(g)],
          );
          soundAt = t + said.lastAt;
          leaveAt = t + said.end + 0.8; // a beat, then on to the questions
        }
        if (t >= soundAt) {
          soundAt = Infinity;
          tile.hop();
          kit.nod();
        }
        if (t >= leaveAt) {
          tile.vanish();
          tile = null;
          hooks.itemDone();
          next();
        }
      },
      layout() {
        tile?.goal.copy(kit.spot('tiles', 0, 1));
      },
      debug: () => ({ waiting: true }),
      dispose() {},
    };
  },
};
