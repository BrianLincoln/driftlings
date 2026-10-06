import { sfx } from '../audio/sound';
import { promptClip, soundClip } from '../content/content';
import type { PickLetterItem } from '../learn/items';
import type { LetterTile } from '../scenes/letterTile';
import type { Touchable } from '../stage/touch';
import type { ExerciseModule } from './contract';

// Hear a sound, pick the letter. A wrong pick dims that tile, which says its
// own sound, and the question plays again; after two, or a long pause, the
// companion shows the answer.

const REPLAY_AFTER = 6;
const HELP_AFTER = 14;
const OWN_SOUND_AFTER = 0.3; // after the "oops"
const BEFORE_REASK = 2; // long enough that the two sounds are not heard as a pair

export const pickLetter: ExerciseModule<PickLetterItem> = {
  kind: 'pick-letter',
  clips: (items) => [promptClip('which-letter-makes-the-sound'), ...items.flatMap((i) => i.choices.map(soundClip))],

  start(items, kit, hooks) {
    let index = -1;
    let tiles: LetterTile[] = [];
    let t = 0;
    /** When the sound finished playing: the moment the question was fully posed. */
    let askedAt = -1;
    let lastHeard = 0;
    let tries = 0;
    let helped = false;
    let answered = false;
    let leaveAt = -1;

    const item = () => items[index];
    const place = () => tiles.forEach((tile, i) => tile.goal.copy(kit.spot('tiles', i, tiles.length)));
    const ask = (lead = 0) => {
      lastHeard = t + lead;
      return lead + kit.say(soundClip(item().target), lead);
    };
    const giveHelp = () => {
      if (helped || answered) return;
      helped = true;
      const right = tiles.find((x) => x.text === item().target)!;
      right.active = true;
      kit.companion.want.pose = 'point';
      kit.companion.want.face = right.anchor.getWorldPosition(right.goal.clone());
      kit.companion.want.at.copy(kit.besideSpot(right));
      kit.companion.nudge();
    };

    const next = () => {
      index++;
      if (index >= items.length) return hooks.finished();
      tiles = item().choices.map((g) => kit.tile(g));
      tiles.forEach((tile, i) => tile.snap(kit.spot('tiles', i, tiles.length)));
      t = 0;
      askedAt = -1;
      tries = 0;
      helped = false;
      answered = false;
      leaveAt = -1;
      kit.companion.want.pose = 'stand';
      kit.companion.want.face = null;
      kit.companion.want.at.copy(kit.sideSpot());
    };

    const choose = (tile: LetterTile) => {
      if (answered || tile.dim || askedAt < 0) return;
      tries++;
      const correct = tile.text === item().target;
      hooks.attempt({
        exercise: 'pick-letter',
        skills: item().skills,
        supports: [],
        target: item().target,
        answer: tile.text,
        correct,
        try: tries,
        helped,
        ms: Math.max(0, Math.round((t - askedAt) * 1000)),
      });
      tile.press();
      if (correct) {
        answered = true;
        kit.hush(); // answered before the question was over: leave the rest unsaid
        tile.done = true;
        tile.active = false;
        tile.hop();
        tiles.forEach((x) => (x.dim = x !== tile));
        kit.cheer();
        leaveAt = t + 1.15;
      } else {
        tile.shake();
        tile.dim = true;
        sfx.oops();
        // The tile says what it is, so the tap is never paired with the wrong sound; then the question again.
        const own = kit.say(soundClip(tile.text), OWN_SOUND_AFTER);
        ask(OWN_SOUND_AFTER + own + BEFORE_REASK);
        if (tries >= 2) giveHelp();
      }
    };

    next();

    return {
      touchables() {
        const out: Touchable[] = tiles.map((tile) => ({
          id: `choice:${tile.text}`,
          object: tile.anchor,
          radius: tile.radius,
          enabled: () => !tile.dim && !answered && askedAt >= 0,
          onTap: () => choose(tile),
        }));
        // Tapping the companion says the sound again.
        out.push({ id: 'again', object: kit.companion.root, radius: 0.38, onTap: () => { kit.companion.act('greet'); ask(0.1); } });
        return out;
      },
      update(dt) {
        t += dt;
        if (index >= items.length) return;
        if (askedAt < 0 && t > 0.5) {
          if (index === 0) {
            const said = kit.line([promptClip('which-letter-makes-the-sound'), soundClip(item().target)]);
            lastHeard = t + said.lastAt;
            askedAt = t + said.end;
          } else askedAt = t + ask();
        }
        if (askedAt >= 0 && !answered) {
          if (t - lastHeard > REPLAY_AFTER) ask();
          if (t - askedAt > HELP_AFTER) giveHelp();
        }
        if (leaveAt > 0 && t > leaveAt) {
          tiles.forEach((x) => x.vanish());
          tiles = [];
          hooks.itemDone();
          next();
        }
      },
      layout: place,
      debug: () => (askedAt >= 0 && t > askedAt && !answered ? { tap: [`choice:${item().target}`] } : { waiting: true }),
      dispose() {},
    };
  },
};
