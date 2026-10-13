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
 * on the lot of them; `stirring` starts out asleep, then watches, then paces, as the ship fills up.
 */
export type Manner = 'sleepy' | 'watchful' | 'restless' | 'huffy' | 'stirring';

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
};

export const OPEN_AREAS: AreaDef[] = AREAS.filter((a) => a.id in BIG_ONES);

export { closerOf };
export const isFinished = (area: AreaDef, done: ReadonlySet<string>): boolean => done.has(closerOf(area).id);
export const lessonsOf = (area: AreaDef): NodeDef[] => area.nodes.filter((n) => n.kind === 'lesson');

/** Where the ship goes next: the first open area not finished, or the last one once they all are. */
export function frontier(done: ReadonlySet<string>, areas: readonly AreaDef[] = OPEN_AREAS): AreaDef {
  return areas.find((a) => !isFinished(a, done)) ?? areas[areas.length - 1];
}
