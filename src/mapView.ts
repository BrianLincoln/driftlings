import { CONTENT, soundClip } from './content/content';
import { OPEN_AREAS, isFinished } from './game/areas';
import { AREAS, rescueIndex, type AreaDef, type NodeDef } from './learn/curriculum';
import { blend, graphemeOf, heartOf, shapeOf } from './learn/skills';
import { rescue } from './cast/species';
import type { MapNode } from './scenes/areaMap';
import { SEA, placeInSea, seaOf } from './scenes/chartSheets';
import { PLACES } from './scenes/places';

// What the area maps and the chart are told, worked out from the curriculum and what is done.

/** What the chart shows on a crossing to or from `area`: every island of its sea, those up to this one found, and ticked if finished. */
export function charted(params: URLSearchParams, area: AreaDef, done: ReadonlySet<string>) {
  // `?sea=3` draws the third sea instead, as on the crossing to its last island, and `?isles=43` the chart as it
  // will be with that many islands, the extra ones blank. Islands not made yet borrow the look of ones that are.
  const ahead = Math.max(0, Math.floor(Number(params.get('sea')) || 0));
  const count = Math.max(AREAS.length, Number(params.get('isles')) || 0, ahead * SEA);
  const last = ahead ? Math.min(ahead * SEA, count) - 1 : AREAS.indexOf(area);
  const first = seaOf(last) * SEA;
  const lent = (i: number) => PLACES[(AREAS[i] ?? OPEN_AREAS[i % OPEN_AREAS.length]).id];
  return {
    sea: seaOf(last),
    isle: placeInSea(last),
    isles: Array.from({ length: Math.min(SEA, count - first) }, (_, n) => {
      const i = first + n;
      return {
        seed: PLACES[AREAS[i]?.id]?.shape.seed ?? 1.3 + i * 1.7,
        found: i <= last ? { place: lent(i), finished: AREAS[i] ? isFinished(AREAS[i], done) : i < last } : null,
      };
    }),
  };
}

/**
 * What a word-building lesson's stone shows: the word it opens on, the first in the list of a shape it teaches (with its
 * letter in, where it has one). A stone's tile holds three letters, so of a longer word it shows the two consonants that stand together.
 */
const opensOn = (n: NodeDef): string => {
  const fits = CONTENT.words.filter((w) => n.teaches.includes(blend(shapeOf(w.graphemes))));
  const word = (fits.find((w) => n.favours?.some((g) => w.graphemes.includes(g))) ?? fits[0])?.text ?? n.favours?.[0] ?? '';
  return word.length > 3 ? word.match(/[^aeiou]{2}/)?.[0] ?? word.slice(0, 2) : word;
};

/** The stones of `area`'s map, given what is `done`. */
export function mapNodesOf(area: AreaDef, done: ReadonlySet<string>): MapNode[] {
  const nodes = area.nodes;
  const currentId = nodes.find((n) => !done.has(n.id))?.id ?? null;
  return nodes.map((n) => {
    const letter = n.teaches.map(graphemeOf).find((g) => g);
    // A lesson about an s on the end shows the s: a whole word with one is too long for a stone's tile. One about a
    // letter's second sound shows the letter (th).
    // A stop for an irregular word alone shows the word, on a heart tile.
    const word = n.teaches.length && n.teaches.every(heartOf) ? heartOf(n.teaches[0]) : null;
    const ending = n.teaches.map((s) => (s.startsWith('suffix:') ? 's' : s.startsWith('second:') ? s.slice(7) : null)).find((g) => g) ?? null;
    return {
      id: n.id,
      state: done.has(n.id) ? 'done' : n.id === currentId ? 'current' : 'locked',
      // The word-building lesson shows the word it opens on: the first in the list of a shape it teaches. A lesson that
      // goes back over vowels shows them.
      label: n.kind !== 'lesson' ? '' : word ?? letter ?? ending ?? (n.review ? (n.favours ?? []).join('') : opensOn(n)),
      byHeart: !!word,
      rescue: n.kind === 'lesson' ? rescue(rescueIndex(n.id)) : null,
      boss: n.kind !== 'lesson',
    };
  });
}

/** The sound clips to have ready before the map of `area` is played from. */
export const soundsOf = (area: AreaDef): string[] =>
  area.nodes.flatMap((n) => n.teaches.map(graphemeOf)).filter((g): g is string => !!g).map(soundClip);
