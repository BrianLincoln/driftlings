import { rescue, type Rescue } from '../cast/species';
import { CONTENT } from '../content/content';
import { allNodes, findNode, knownSkills, rescueIndex, rescuesHome, settled, type AreaDef } from '../learn/curriculum';
import { attemptsOf, doneNodes, type AttemptDraft, type LogEvent } from '../learn/events';
import type { GenContext } from '../learn/generator';
import type { Round } from '../learn/items';
import { confusions, foldSkills } from '../learn/model';
import { seeded } from '../learn/rng';
import { planCheckpoint, planLesson } from '../learn/scheduler';
import { graphemeOf, type SkillId } from '../learn/skills';
import { BIG_ONES, OPEN_AREAS, frontier } from './areas';
import { uuid } from './children';
import type { EventStore } from './store';

// One child's game: the event log and everything derived from it. This is the
// only place the learning layer and the presentation meet.

export interface NodePlan {
  rounds: Round[];
  guest: Rescue;
  boss: boolean;
}

export class Game {
  private rng = seeded((Date.now() ^ 0x9e3779b9) >>> 0);

  private constructor(private store: EventStore, public events: LogEvent[]) {}

  static async load(store: EventStore): Promise<Game> {
    return new Game(store, await store.all());
  }

  private add(e: LogEvent): void {
    this.events.push(e);
    void this.store.add(e);
  }

  /** Unique on any device, so two devices' logs can be put together. */
  private id(): string {
    return uuid();
  }

  /** The nodes finished: those the log says, and every node of an area whose checkpoint is among them. */
  get done(): Set<string> {
    return settled(doneNodes(this.events));
  }

  /** The area being explored: the first one not finished. */
  get area(): AreaDef {
    return frontier(this.done);
  }

  record(node: string, a: AttemptDraft): void {
    this.add({ type: 'attempt', id: this.id(), at: Date.now(), node, ...a });
  }

  completeNode(node: string): void {
    this.add({ type: 'node-done', id: this.id(), at: Date.now(), node });
  }

  /** Rescues living on the home island, and how many of them the child has already seen arrive. */
  get home(): { residents: number[]; welcomed: number } {
    const welcomed = this.events.reduce((n, e) => (e.type === 'welcomed' ? Math.max(n, e.count) : n), 0);
    return { residents: rescuesHome(this.done), welcomed };
  }

  welcome(count: number): void {
    this.add({ type: 'welcomed', id: this.id(), at: Date.now(), count });
  }

  private context(extra: readonly SkillId[], area: AreaDef): GenContext {
    const attempts = attemptsOf(this.events);
    const known = knownSkills(this.done);
    for (const s of extra) known.add(s);
    // Letters later in this area may stand in as wrong choices in the first lessons.
    const foils = area.nodes.flatMap((n) => n.teaches.map(graphemeOf)).filter((g): g is string => !!g && !known.has(`gpc:${g}`));
    return { known, foils, content: CONTENT, states: foldSkills(attempts), confusions: confusions(attempts), rng: this.rng };
  }

  planNode(nodeId: string): NodePlan | null {
    const found = findNode(nodeId);
    if (!found) return null;
    const { node, area } = found;
    // Whoever is at this node has been taught everything before it, even if the log does not say so
    // (`?area=` and `?scene=` put the map ahead of the progress): a checkpoint is never left with nothing to ask.
    const order = allNodes();
    const before = order.slice(0, order.indexOf(node)).flatMap((n) => n.teaches);
    const ctx = this.context([...before, ...node.teaches], area);
    if (node.kind === 'lesson') {
      return { rounds: planLesson(node, ctx, Date.now()), guest: rescue(rescueIndex(node.id)), boss: false };
    }
    return { rounds: planCheckpoint(area, ctx, Date.now()), guest: (BIG_ONES[area.id] ?? BIG_ONES[OPEN_AREAS[0].id]).who, boss: true };
  }

  async reset(): Promise<void> {
    this.events = [];
    await this.store.clear();
  }
}
