import { blend, gpc, heart, second, suffix, type SkillId } from './skills';

// The order follows the published UFLI Foundations scope and sequence
// (lesson numbers in `ufli`). Only the order and the review points are taken
// from it; no lesson content is reproduced.

export type NodeKind = 'lesson' | 'miniboss' | 'boss';

export interface NodeDef {
  id: string;
  kind: NodeKind;
  /** UFLI lesson number this node corresponds to, or null where the checkpoint is ours. */
  ufli: number | null;
  teaches: SkillId[];
  /** For a lesson on word shapes: the letters its words should have in them, where there are such words. */
  favours?: string[];
  /**
   * Added to its area after children had already played it. Its rescue is numbered after the area's others,
   * so nobody a child has already woken turns into somebody else.
   */
  late?: boolean;
}

export interface AreaDef {
  id: string;
  nodes: NodeDef[];
}

const lesson = (id: string, ufli: number, ...teaches: SkillId[]): NodeDef => ({ id, kind: 'lesson', ufli, teaches });
/** A lesson on building words of new shapes, added to an area already out (see `late`). */
const shapes = (id: string, ufli: number, favours: string[], ...teaches: SkillId[]): NodeDef => ({ ...lesson(id, ufli, ...teaches), favours, late: true });
const check = (id: string, kind: 'miniboss' | 'boss', ufli: number | null): NodeDef => ({ id, kind, ufli, teaches: [] });

/** Every island there is, in the order the ship finds them. Each is one area: a few lessons and the checkpoint that ends it. */
export const AREAS: AreaDef[] = [
  {
    id: 'i1a1',
    nodes: [
      lesson('i1a1-a', 1, gpc('a')),
      lesson('i1a1-m', 2, gpc('m')),
      lesson('i1a1-s', 3, gpc('s')),
      lesson('i1a1-t', 4, gpc('t')),
      lesson('i1a1-blend', 5, blend('vc'), blend('cvc')),
      check('i1a1-boss', 'miniboss', null),
    ],
  },
  {
    id: 'i1a2',
    nodes: [
      // Irregular words come one to a lesson, never before UFLI has them (docs/heart-words.md).
      lesson('i1a2-p', 6, gpc('p'), heart('the')),
      lesson('i1a2-f', 7, gpc('f'), heart('a')),
      lesson('i1a2-i', 8, gpc('i')),
      lesson('i1a2-n', 9, gpc('n')),
      check('i1a2-boss', 'miniboss', 10),
    ],
  },
  {
    id: 'i1a3',
    nodes: [
      // UFLI 11 (nasalised a in am, an) is a pronunciation point, not a new correspondence.
      lesson('i1a3-o', 12, gpc('o')),
      lesson('i1a3-d', 13, gpc('d')),
      lesson('i1a3-c', 14, gpc('c')),
      check('i1a3-boss', 'miniboss', null),
    ],
  },
  {
    id: 'i1a4',
    nodes: [
      lesson('i1a4-u', 15, gpc('u')),
      lesson('i1a4-g', 16, gpc('g')),
      lesson('i1a4-b', 17, gpc('b')),
      lesson('i1a4-e', 18, gpc('e')),
      check('i1a4-boss', 'boss', 19),
    ],
  },
  {
    id: 'i2a1',
    nodes: [
      // UFLI 20 and 21: an s on the end for more than one, saying /s/ (cups), then saying /z/ (beds, and in "is").
      lesson('i2a1-add-s', 20, suffix('s')),
      lesson('i2a1-s-z', 21, second('s')),
      lesson('i2a1-k', 22, gpc('k')),
      lesson('i2a1-h', 23, gpc('h')),
      // UFLI gives r and l two lessons each. The first is the letter; the second is the letter next to another
      // consonant: 25 is r after one at the start of a word (trip), 27 is l there (flag) and before one at the end (milk).
      lesson('i2a1-r', 24, gpc('r')),
      shapes('i2a1-r2', 25, ['r'], blend('ccvc')),
      lesson('i2a1-l', 26, gpc('l')),
      shapes('i2a1-l2', 27, ['l'], blend('ccvc'), blend('cvcc')),
      check('i2a1-boss', 'miniboss', null),
    ],
  },
];

export const allNodes = (): NodeDef[] => AREAS.flatMap((a) => a.nodes);

export function findNode(id: string): { node: NodeDef; area: AreaDef } | null {
  for (const area of AREAS) {
    const node = area.nodes.find((n) => n.id === id);
    if (node) return { node, area };
  }
  return null;
}

/** The checkpoint that ends an area. */
export const closerOf = (area: AreaDef): NodeDef => area.nodes[area.nodes.length - 1];

/**
 * What counts as done, from the nodes the log says were finished. Beating an area's checkpoint settles the
 * whole area, so a lesson added to it afterwards is done too: the island stays finished, what the lesson
 * teaches is known (and is shown how the first time it comes up, having never been tried), and its little
 * one comes home with the rest. A child still on the island finds the new lesson on the path as the next to do.
 */
export function settled(done: ReadonlySet<string>): Set<string> {
  const out = new Set(done);
  for (const area of AREAS) if (done.has(closerOf(area).id)) for (const n of area.nodes) out.add(n.id);
  return out;
}

/** Every skill taught by the given completed nodes. */
export function knownSkills(done: ReadonlySet<string>): Set<SkillId> {
  const out = new Set<SkillId>();
  for (const n of allNodes()) if (done.has(n.id)) for (const s of n.teaches) out.add(s);
  return out;
}

export const areaSkills = (area: AreaDef): SkillId[] => area.nodes.flatMap((n) => n.teaches);

/** Nodes open one at a time, in order. The first node not yet done is the current one. */
export function currentNode(area: AreaDef, done: ReadonlySet<string>): NodeDef | null {
  return area.nodes.find((n) => !done.has(n.id)) ?? null;
}

/** The lesson nodes in the order their rescues are numbered: area by area, a late lesson after the others of its area. */
const rescueOrder = (): NodeDef[] => AREAS.flatMap((a) => {
  const lessons = a.nodes.filter((n) => n.kind === 'lesson');
  return [...lessons.filter((n) => !n.late), ...lessons.filter((n) => n.late)];
});

/** Which rescue a lesson node gives. */
export function rescueIndex(nodeId: string): number {
  return rescueOrder().findIndex((n) => n.id === nodeId);
}

/** Rescues that have gone home: those from areas whose closing checkpoint is done. */
export function rescuesHome(done: ReadonlySet<string>): number[] {
  const out: number[] = [];
  for (const area of AREAS) {
    if (!done.has(closerOf(area).id)) continue;
    for (const n of area.nodes) if (n.kind === 'lesson') out.push(rescueIndex(n.id));
  }
  return out.sort((a, b) => a - b);
}
