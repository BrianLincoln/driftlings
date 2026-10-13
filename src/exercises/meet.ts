import { hasClip, keywordClip, nameClip, promptClip, soundClip, type ClipId } from '../content/content';
import type { MeetItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { ExerciseModule } from './contract';

// Meet a letter: it appears, the narrator names it, says its sound and a word
// that starts with it (x: ends with it), and after a beat the lesson moves on.
// Nothing to tap and nothing scored; the questions that follow are where the
// child answers. Two letters that make one sound (qu) stand on one tile and
// have no name: "Together, these letters make the sound ...".

/** "Like in [word]", for a letter that has a keyword recorded. */
const likeIn = (g: string): ClipId[] => {
  const word = keywordClip(g);
  return word ? [promptClip('like-in'), word] : [];
};
const BEFORE_LIKE_IN = 0.45;
const TOGETHER = promptClip('together-these-letters-make-the-sound');
/** What is said before the sound itself. Until the line for two letters is recorded, they get what a letter with no name gets. */
const lead = (g: string): ClipId[] =>
  g.length > 1
    ? [hasClip(TOGETHER) ? TOGETHER : promptClip('listen')]
    : hasClip(nameClip(g)) ? [promptClip('this-is-the-letter'), nameClip(g), promptClip('it-makes-the-sound')] : [promptClip('listen')];

export const meet: ExerciseModule<MeetItem> = {
  kind: 'meet',
  clips: (items) => [
    ...items.flatMap((i) => [...lead(i.grapheme), soundClip(i.grapheme), ...likeIn(i.grapheme)]),
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
          // "This is the letter [name]. It makes the sound [sound]. Like in [word]."
          const said = kit.line([...lead(g), soundClip(g)]);
          soundAt = t + said.lastAt;
          const example = likeIn(g);
          const end = example.length ? kit.line(example, said.end + BEFORE_LIKE_IN).end : said.end;
          leaveAt = t + end + 0.8; // a beat, then on to the questions
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
