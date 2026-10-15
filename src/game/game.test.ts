import { describe, expect, it } from 'vitest';
import endings from '../content/endings.json';
import hearts from '../content/hearts.json';
import keywords from '../content/keywords.json';
import wordGroups from '../content/words.json';
import { AREAS, allNodes, rescueIndex } from '../learn/curriculum';
import type { LogEvent } from '../learn/events';
import { graphemeOf, heartOf, shapeOf } from '../learn/skills';
import { cut } from '../content/content';
import { isFinished } from './areas';
import { Game } from './game';
import type { EventStore } from './store';

/** A log as a child's play left it: these nodes finished, in this order. */
async function gameWith(nodes: string[]): Promise<Game> {
  const events: LogEvent[] = nodes.map((node, i) => ({ type: 'node-done', id: `e${i}`, at: i + 1, node }));
  const store: EventStore = { all: async () => [...events], add: async () => {}, clear: async () => {} };
  return Game.load(store);
}

// The fifth island as it was first played: no lessons on two consonants together.
const NEW = ['i2a1-r2', 'i2a1-l2'];
const earlier = AREAS.slice(0, 4).flatMap((a) => a.nodes.map((n) => n.id));
const was = AREAS[4].nodes.map((n) => n.id).filter((id) => !NEW.includes(id));

describe('a saved game from before lessons were added to an island', () => {
  it('keeps the island finished for a child who had beaten it, with the new lessons done and their little ones home', async () => {
    const game = await gameWith([...earlier, ...was]);
    expect(AREAS.slice(0, 5).every((a) => isFinished(a, game.done))).toBe(true);
    expect(AREAS[4].nodes.every((n) => game.done.has(n.id))).toBe(true);
    // With the little one of the stop for "the", numbered after everybody.
    expect(game.home.residents).toEqual([...Array.from({ length: 24 }, (_, i) => i), rescueIndex('i1a2-the')]);
    // Every node can still be played again, the new ones included.
    for (const n of AREAS[4].nodes) expect(game.planNode(n.id)!.rounds.length, n.id).toBeGreaterThan(0);
  });

  it('puts the new lessons before the checkpoint for a child who had not beaten it, and undoes nothing', async () => {
    const game = await gameWith([...earlier, ...was.slice(0, -1)]);
    expect(game.area.id).toBe('i2a1');
    for (const id of [...earlier, ...was.slice(0, -1)]) expect(game.done.has(id), id).toBe(true);
    const next = () => game.area.nodes.find((n) => !game.done.has(n.id))!.id;
    for (const id of [...NEW, 'i2a1-boss']) {
      expect(next()).toBe(id);
      expect(game.planNode(id)!.rounds.length, id).toBeGreaterThan(0);
      game.completeNode(id);
    }
    expect(isFinished(AREAS[4], game.done)).toBe(true);
    expect(game.home.residents.length).toBe(25);
  });
});

describe('the word list', () => {
  const groups = Object.entries(wordGroups as Record<string, string[] | string>).filter((e): e is [string, string[]] => Array.isArray(e[1]));
  const words = groups.flatMap(([, list]) => list);
  /** A word's graphemes: qu is one. */
  const split = (w: string) => cut(w).graphemes;
  /** The letters taught by the end of an area. */
  const taughtBy = (area: string) => {
    const nodes = allNodes();
    const last = AREAS.find((a) => a.id === area)!.nodes.at(-1)!;
    return new Set(nodes.slice(0, nodes.indexOf(last) + 1).flatMap((n) => n.teaches.map(graphemeOf)));
  };

  it('lists no word twice, and none that is in another list', () => {
    expect(new Set(words).size).toBe(words.length);
    for (const w of endings.sSaysZ) expect(words).not.toContain(w);
  });

  it('spells every word of an area with letters taught by the end of it', () => {
    for (const [group, list] of groups) {
      const area = group.split(' ')[0];
      if (!AREAS.some((a) => a.id === area)) continue;
      const taught = taughtBy(area);
      for (const w of list) expect(split(w).every((g) => taught.has(g)), `${w} in ${group}`).toBe(true);
    }
  });

  it('has words of every shape a lesson teaches, and none with two consonants together that could be read before the lessons on them are near', () => {
    const shapes = new Set(words.map((w) => shapeOf(split(w))));
    for (const s of allNodes().flatMap((n) => n.teaches).filter((t) => t.startsWith('blend:'))) expect(shapes.has(s.slice(6) as 'cvc'), s).toBe(true);
    // Before the fifth island every lesson's words are two or three letters long, bar the keywords that happen to be decodable.
    const early = taughtBy('i1a4');
    // The words of the vowel review (i2a3) are spelled with early letters too (stop, stamp): the game holds each back until its shape is taught.
    const review = new Set(groups.filter(([g]) => g.startsWith('i2a3')).flatMap(([, list]) => list));
    const long = words.filter((w) => w.length > 3 && !review.has(w) && split(w).every((g) => early.has(g)));
    expect(long).toEqual(['nest']);
  });
});

describe('the last letters of the alphabet', () => {
  const groups = Object.entries(wordGroups as Record<string, string[] | string>).filter((e): e is [string, string[]] => Array.isArray(e[1]));
  const words = groups.flatMap(([, list]) => list).map(cut);

  it('cuts qu as one grapheme wherever it is, and never leaves a q or its u on a tile alone', () => {
    expect(cut('quit').graphemes).toEqual(['qu', 'i', 't']);
    expect(cut('squid').graphemes).toEqual(['s', 'qu', 'i', 'd']);
    expect(shapeOf(cut('quilt').graphemes)).toBe('cvcc');
    for (const w of words) {
      expect(w.graphemes.join(''), w.text).toBe(w.text);
      expect(w.graphemes, w.text).not.toContain('q');
    }
  });

  it('has x only where it says /ks/: after a vowel, never at the start of a word', () => {
    const withX = words.filter((w) => w.graphemes.includes('x'));
    expect(withX.length).toBeGreaterThan(3);
    for (const w of withX) for (const [i, g] of w.graphemes.entries()) if (g === 'x') expect('aeiou', w.text).toContain(w.graphemes[i - 1] ?? '-');
    for (const k of keywords.x) expect(k.endsWith('x'), k).toBe(true);
  });

  it('has words for every one of the letters, some with two consonants together', () => {
    for (const g of ['w', 'j', 'y', 'x', 'qu', 'v', 'z']) {
      const with_ = words.filter((w) => w.graphemes.includes(g));
      expect(with_.filter((w) => shapeOf(w.graphemes) === 'cvc').length, g).toBeGreaterThanOrEqual(2);
      expect(with_.some((w) => ['ccvc', 'cvcc'].includes(shapeOf(w.graphemes))), g).toBe(true);
    }
  });
});

describe('the digraphs', () => {
  const groups = Object.entries(wordGroups as Record<string, string[] | string>).filter((e): e is [string, string[]] => Array.isArray(e[1]));
  const NEW = AREAS.find((a) => a.id === 'i2a4')!.nodes.flatMap((n) => n.teaches.map(graphemeOf)).filter((g): g is string => !!g);

  it('has a new grapheme in every word of the island, enough of each for a lesson, and its keywords', () => {
    const words = groups.filter(([g]) => g.startsWith('i2a4')).flatMap(([, list]) => list).map(cut);
    for (const w of words) expect(w.graphemes.some((g) => NEW.includes(g)), w.text).toBe(true);
    for (const g of NEW) {
      expect(words.filter((w) => w.graphemes.includes(g)).length, g).toBeGreaterThanOrEqual(3);
      expect((keywords as Record<string, unknown>)[g], g).toBeDefined();
    }
    expect((keywords as Record<string, unknown>)['th-unvoiced']).toBeDefined();
  });

  it('cuts a vowel and ll as a glued sound, and a short vowel before ll only where a dot says so', () => {
    expect(cut('ball').graphemes).toEqual(['b', 'all']);
    expect(cut('bell').graphemes).toEqual(['b', 'e', 'll']);
    // doll and dull would teach the glued sounds wrong, so the list has none.
    const all = groups.flatMap(([, list]) => list);
    for (const w of ['doll', 'dull', 'gull', 'hull', 'shall']) expect(all, w).not.toContain(w);
  });

  it('lists the words where th says /th/ as in "this", each of them in a group of its own island', () => {
    const voiced = String((wordGroups as Record<string, unknown>).thSaysThis).split(' ');
    const i2a4 = groups.filter(([g]) => g.startsWith('i2a4')).flatMap(([, list]) => list);
    for (const w of voiced) expect(i2a4, w).toContain(w);
    expect(voiced).toEqual(['this', 'that', 'then', 'them', 'than', 'with']);
  });
});

describe('irregular words', () => {
  it('each one a lesson teaches is cut into tiles in hearts.json, with a sound for every tile', () => {
    const taught = allNodes().flatMap((n) => n.teaches.map(heartOf)).filter((w): w is string => !!w);
    expect(taught.sort()).toEqual(Object.keys(hearts.words).sort());
    for (const [word, w] of Object.entries(hearts.words)) {
      expect(w.graphemes.join(''), word).toBe(word);
      expect(w.sounds.length, word).toBe(w.graphemes.length);
    }
  });

  it('only things with a drawing can have something put on or in them', () => {
    const drawn = Object.values(endings.many).flat();
    for (const name of [...hearts.on, ...hearts.in]) expect(drawn, name).toContain(name);
  });
});
