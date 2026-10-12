import { COATS, SPECIES, type Rescue } from '../cast/species';
import { ISLAND_1, type AreaDef, type NodeDef } from '../learn/curriculum';

// The areas the game goes to, in order, and the big one who lives on each.
// An area is open once it has a big one here and a place in scenes/places.ts
// (a test checks the two agree); the learning layer knows about the rest already.

/**
 * How a big one carries on until it has had its turn. `sleepy` snores through the little ones
 * being woken and only stirs at the end; `watchful` is wide awake and sees every one of them go.
 */
export type Manner = 'sleepy' | 'watchful';

export interface BigOne {
  who: Rescue;
  manner: Manner;
}

const big = (species: string, coat: string, manner: Manner): BigOne =>
  ({ who: { species: SPECIES.find((s) => s.id === species)!, coat: COATS.find((c) => c.id === coat)! }, manner });

export const BIG_ONES: Record<string, BigOne> = {
  i1a1: big('tusk', 'slate', 'sleepy'),
  i1a2: big('glider', 'rose', 'watchful'),
};

export const OPEN_AREAS: AreaDef[] = ISLAND_1.areas.filter((a) => a.id in BIG_ONES);

/** The checkpoint that ends an area. */
export const closerOf = (area: AreaDef): NodeDef => area.nodes[area.nodes.length - 1];
export const isFinished = (area: AreaDef, done: ReadonlySet<string>): boolean => done.has(closerOf(area).id);
export const lessonsOf = (area: AreaDef): NodeDef[] => area.nodes.filter((n) => n.kind === 'lesson');

/** Where the ship goes next: the first open area not finished, or the last one once they all are. */
export function frontier(done: ReadonlySet<string>, areas: readonly AreaDef[] = OPEN_AREAS): AreaDef {
  return areas.find((a) => !isFinished(a, done)) ?? areas[areas.length - 1];
}
