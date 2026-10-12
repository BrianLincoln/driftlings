import { COATS, SPECIES, type Rescue } from '../cast/species';
import { ISLANDS, type AreaDef, type IslandDef, type NodeDef } from '../learn/curriculum';

// The areas the game goes to, in order, and the big one who lives on each.
// An area is open once it has a big one here and a place in scenes/places.ts
// (a test checks the two agree); the learning layer knows about the rest already.

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
  // The last of the island, and the biggest by a head.
  i1a4: big('cub', 'plum', 'stirring', 1.4),
  i2a1: big('lop', 'cocoa', 'huffy'),
};

const open = (island: IslandDef): AreaDef[] => island.areas.filter((a) => a.id in BIG_ONES);
export const OPEN_AREAS: AreaDef[] = ISLANDS.flatMap(open);

/** The island an area belongs to, the open areas on it, and where the area comes among them: one chart's worth. */
export function watersOf(area: AreaDef): { island: IslandDef; areas: AreaDef[]; isle: number } {
  const island = ISLANDS.find((i) => i.areas.includes(area))!;
  return { island, areas: open(island), isle: open(island).indexOf(area) };
}

/** The checkpoint that ends an area. */
export const closerOf = (area: AreaDef): NodeDef => area.nodes[area.nodes.length - 1];
export const isFinished = (area: AreaDef, done: ReadonlySet<string>): boolean => done.has(closerOf(area).id);
export const lessonsOf = (area: AreaDef): NodeDef[] => area.nodes.filter((n) => n.kind === 'lesson');

/** Where the ship goes next: the first open area not finished, or the last one once they all are. */
export function frontier(done: ReadonlySet<string>, areas: readonly AreaDef[] = OPEN_AREAS): AreaDef {
  return areas.find((a) => !isFinished(a, done)) ?? areas[areas.length - 1];
}
