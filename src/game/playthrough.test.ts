import { describe, expect, it } from 'vitest';
import drawn from '../content/drawn.json';
import { recorded } from '../content/content';
import { EXERCISES } from '../exercises';
import type { AttemptDraft, LogEvent } from '../learn/events';
import type { Item } from '../learn/items';
import { OPEN_AREAS, isFinished, lessonsOf } from './areas';
import { Game } from './game';
import type { EventStore } from './store';

// The whole game played by a child who never slips, with no browser: every open island in order, every node of it.
// It is what `npm run play` checks of the lessons themselves (that each has something to ask, that what it asks can
// be answered and heard, that the islands open one after another and everyone gets home), in the time of a unit test.
// What it cannot see is the staging: taps landing, scenes following one another. That is what the scripted play is for.

/** What a faultless child answers to an item: one right response for each thing it asks. */
function answers(item: Item): Array<Pick<AttemptDraft, 'skills' | 'supports' | 'target'>> {
  if (item.kind === 'meet') return [];
  if (item.kind === 'chain') return item.steps.map((s) => ({ skills: s.skills, supports: s.supports, target: s.word }));
  const target = item.kind === 'blend' || item.kind === 'heart' ? item.word : item.kind === 'read' ? item.target.thing : item.target;
  return [{ skills: item.skills, supports: 'supports' in item ? item.supports : [], target }];
}

const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

/** An item an exercise can stage: the answer is among what is offered, and the tiles add up to the word. */
function check(item: Item, at: string): void {
  if (item.kind === 'pick-letter') {
    expect(item.choices, at).toContain(item.target);
    expect(new Set(item.choices).size, at).toBe(item.choices.length);
  } else if (item.kind === 'catch') {
    expect(item.others, at).not.toContain(item.target);
    expect(item.count, at).toBeGreaterThan(0);
  } else if (item.kind === 'blend' || item.kind === 'heart') {
    expect(item.graphemes.join(''), at).toBe(item.word);
    expect(item.sounds.length, at).toBe(item.graphemes.length);
    if (item.kind === 'heart' && item.stage === 'find') expect(item.choices.map((c) => c.text), at).toContain(item.word);
  } else if (item.kind === 'many') {
    expect([item.base, `${item.base}s`], at).toContain(item.target);
    expect(item.graphemes.join(''), at).toBe(item.base);
  } else if (item.kind === 'read') {
    expect(item.words.length, at).toBeGreaterThan(0);
    expect(item.choices.filter((c) => same(c, item.target)).length, at).toBe(1);
    for (const c of item.choices) expect(drawn.things, at).toContain(c.thing);
  } else if (item.kind === 'chain') {
    expect(item.steps.length, at).toBeGreaterThan(0);
    let before = item.graphemes;
    for (const s of item.steps) {
      const here = `${at} ${s.word}`;
      expect(s.graphemes.join(''), here).toBe(s.word);
      // One tile changes, and it is the one the step says.
      expect(s.graphemes.flatMap((g, i) => (g === before[i] ? [] : [i])), here).toEqual([s.at]);
      expect(s.graphemes.length, here).toBe(before.length);
      if (s.mode === 'spell') expect(s.letters.map((l) => l.grapheme), here).toContain(s.graphemes[s.at]);
      else {
        expect(s.words, here).toContain(s.word);
        for (const w of s.words) expect(drawn.things, here).toContain(w);
      }
      before = s.graphemes;
    }
  }
}

describe('the game played through by a child who never slips', () => {
  it('has something to ask at every node of every open island, all of it answerable and recorded, and brings everyone home', async () => {
    const events: LogEvent[] = [];
    const store: EventStore = { all: async () => events, add: async () => {}, clear: async () => {} };
    const game = await Game.load(store);
    let home = 0;
    for (const area of OPEN_AREAS) {
      expect(game.area.id).toBe(area.id);
      for (const node of area.nodes) {
        // Nothing is skipped: this is the next stone on the path.
        expect(area.nodes.find((n) => !game.done.has(n.id))?.id).toBe(node.id);
        const plan = game.planNode(node.id)!;
        expect(plan.rounds.length, node.id).toBeGreaterThan(0);
        for (const round of plan.rounds) {
          const at = `${node.id} ${round.exercise}`;
          const exercise = EXERCISES.get(round.exercise);
          expect(exercise, at).toBeDefined();
          expect(round.items.length, at).toBeGreaterThan(0);
          for (const item of round.items) {
            expect(item.kind, at).toBe(round.exercise);
            check(item, `${at} ${item.key}`);
            for (const a of answers(item)) game.record(node.id, { ...a, exercise: round.exercise, answer: a.target, correct: true, try: 1, helped: false, ms: 1500 });
          }
          // Whatever the exercise will say has been recorded: nothing in a lesson is silent.
          for (const clip of exercise!.clips(round.items)) expect(recorded(clip), `${at} ${clip}`).toBe(true);
        }
        game.completeNode(node.id);
      }
      expect(isFinished(area, game.done), area.id).toBe(true);
      home += lessonsOf(area).length;
      expect(game.home.residents.length, area.id).toBe(home);
    }
  });
});
