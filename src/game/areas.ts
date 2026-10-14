import { COATS, SPECIES, type Rescue } from '../cast/species';
import { AREAS, closerOf, type AreaDef, type NodeDef } from '../learn/curriculum';

// The islands the game goes to, in order, and the big one who lives on each.
// An island (an "area" in the code) is open once it has a big one here and a
// place in scenes/places.ts (a test checks the two agree); the learning layer
// knows about the rest already.

/**
 * How a big one carries on until it has had its turn. `sleepy` snores through the little ones
 * being woken and only stirs at the end; `watchful` is wide awake and sees every one of them go;
 * `restless` cannot keep still, and paces up and down its bit of shore; `huffy` has turned its back
 * on the lot of them; `stirring` starts out asleep, then watches, then paces, as the ship fills up;
 * `merry` bobs about to a tune of its own and bounces each of them off, not seeing that it is being left.
 */
export type Manner = 'sleepy' | 'watchful' | 'restless' | 'huffy' | 'stirring' | 'merry';

export interface BigOne {
  who: Rescue;
  manner: Manner;
}

/** `size` is for one bigger still than the big ones are: the same creature, that many times over. */
const big = (species: string, coat: string, manner: Manner, size = 1): BigOne => {
  const kind = SPECIES.find((s) => s.id === species)!;
  return { who: { species: { ...kind, size: kind.size * size }, coat: COATS.find((c) => c.id === coat)! }, manner };
};

export const BIG_ONES: Record<string, BigOne> = {
  i1a1: big('tusk', 'slate', 'sleepy'),
  i1a2: big('glider', 'rose', 'watchful'),
  i1a3: big('kit', 'apricot', 'restless'),
  // The biggest by a head.
  i1a4: big('cub', 'plum', 'stirring', 1.4),
  i2a1: big('lop', 'cocoa', 'huffy'),
  // The end of the alphabet: as big as the one who ended the vowels.
  i2a2: big('owlet', 'teal', 'merry', 1.4),
  // The first of the second sea, and the first with fins.
  i2a3: big('finlet', 'sky', 'restless'),
  // Two letters to a sound: a tall one, the first with feelers, watching every one of them go.
  i2a4: big('stalk', 'butter', 'watchful'),
};

export const OPEN_AREAS: AreaDef[] = AREAS.filter((a) => a.id in BIG_ONES);

export { closerOf };
export const isFinished = (area: AreaDef, done: ReadonlySet<string>): boolean => done.has(closerOf(area).id);
export const lessonsOf = (area: AreaDef): NodeDef[] => area.nodes.filter((n) => n.kind === 'lesson');

/** Where the ship goes next: the first open area not finished, or the last one once they all are. */
export function frontier(done: ReadonlySet<string>, areas: readonly AreaDef[] = OPEN_AREAS): AreaDef {
  return areas.find((a) => !isFinished(a, done)) ?? areas[areas.length - 1];
}
