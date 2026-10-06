import { blend, gpc, type SkillId } from './skills';

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
}

export interface AreaDef {
  id: string;
  nodes: NodeDef[];
}

export interface IslandDef {
  id: string;
  areas: AreaDef[];
}

const lesson = (id: string, ufli: number, ...teaches: SkillId[]): NodeDef => ({ id, kind: 'lesson', ufli, teaches });
const check = (id: string, kind: 'miniboss' | 'boss', ufli: number | null): NodeDef => ({ id, kind, ufli, teaches: [] });

export const ISLAND_1: IslandDef = {
  id: 'i1',
  areas: [
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
        lesson('i1a2-p', 6, gpc('p')),
        lesson('i1a2-f', 7, gpc('f')),
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
  ],
};

export const ISLANDS: IslandDef[] = [ISLAND_1];

export const allNodes = (): NodeDef[] => ISLANDS.flatMap((i) => i.areas.flatMap((a) => a.nodes));

export function findNode(id: string): { node: NodeDef; area: AreaDef; island: IslandDef } | null {
  for (const island of ISLANDS) for (const area of island.areas) {
    const node = area.nodes.find((n) => n.id === id);
    if (node) return { node, area, island };
  }
  return null;
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

/** Which rescue a lesson node gives: its position among all lesson nodes. */
export function rescueIndex(nodeId: string): number {
  return allNodes().filter((n) => n.kind === 'lesson').findIndex((n) => n.id === nodeId);
}

/** Rescues that have gone home: those from areas whose closing checkpoint is done. */
export function rescuesHome(done: ReadonlySet<string>): number[] {
  const out: number[] = [];
  for (const island of ISLANDS) for (const area of island.areas) {
    const closer = area.nodes[area.nodes.length - 1];
    if (!done.has(closer.id)) continue;
    for (const n of area.nodes) if (n.kind === 'lesson') out.push(rescueIndex(n.id));
  }
  return out;
}
