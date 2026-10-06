import { areaSkills, type AreaDef, type NodeDef } from './curriculum';
import { askableGraphemes, blendItem, decodableWords, meetItem, pickLetterItem, type GenContext } from './generator';
import type { BlendItem, Item, PickLetterItem, Round } from './items';
import { isDue, statusOf, type SkillState } from './model';
import { shuffle, weighted } from './rng';
import { blend, gpc, graphemeOf, shapeOf, type SkillId } from './skills';

// Chooses what to work on. Driven by evidence, not the calendar:
//  - old material is mixed into every lesson;
//  - a practice round is offered when something is overdue or shaky;
//  - practice only blocks progress when the next area depends on something weak.

export const SIZES = {
  lessonPicks: 6,
  /** Share of a letter lesson's picks spent on the new letter. */
  newShare: 0.6,
  lessonBlends: 2,
  blendLessonBlends: 4,
  blendLessonPicks: 4,
  checkpointPicks: 8,
  checkpointBlends: 3,
  practicePicks: 5,
  practiceBlends: 2,
};

/** How much a skill needs attention right now. */
export function need(s: SkillState | undefined, now: number): number {
  const status = statusOf(s);
  if (status === 'shaky') return 3;
  if (isDue(s, now)) return 2;
  if (status === 'new') return 1.5;
  if (status === 'secure') return 0.4;
  return 1;
}

function nonNull<T>(xs: Array<T | null>): T[] {
  return xs.filter((x): x is T => x !== null);
}

/** Avoid the same answer three times running, where the pool allows. */
function spread<T extends { target?: string; word?: string }>(items: T[], ctx: GenContext): T[] {
  const out = shuffle(items, ctx.rng);
  const k = (t: T) => t.target ?? t.word;
  for (let i = 2; i < out.length; i++) {
    if (k(out[i]) === k(out[i - 1]) && k(out[i]) === k(out[i - 2])) {
      const j = out.findIndex((t, n) => n > i && k(t) !== k(out[i]));
      if (j > 0) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

function picks(n: number, pool: string[], ctx: GenContext, now: number): PickLetterItem[] {
  if (pool.length === 0) return [];
  return nonNull(
    Array.from({ length: n }, () =>
      pickLetterItem(weighted(pool, (g) => need(ctx.states.get(gpc(g)), now), ctx.rng), ctx)),
  );
}

function blends(n: number, ctx: GenContext, now: number, favour: ReadonlySet<string> = new Set()): BlendItem[] {
  let pool = decodableWords(ctx);
  const out: BlendItem[] = [];
  while (out.length < n && pool.length > 0) {
    const w = weighted(
      pool,
      (x) => need(ctx.states.get(blend(shapeOf(x.graphemes))), now) * (x.graphemes.some((g) => favour.has(g)) ? 3 : 1),
      ctx.rng,
    );
    pool = pool.filter((x) => x.text !== w.text); // each word once per round
    const item = blendItem(w.text, ctx);
    if (item) out.push(item);
  }
  return out;
}

const round = (items: Item[]): Round[] => (items.length ? [{ exercise: items[0].kind, items }] : []);

/**
 * A lesson. `ctx.known` must already include what the node teaches.
 * New letters are met, then practised with older letters mixed in, then used in words.
 */
export function planLesson(node: NodeDef, ctx: GenContext, now: number): Round[] {
  const fresh = nonNull(node.teaches.map(graphemeOf)).filter((g) => ctx.content.hasSound(g));
  const older = askableGraphemes(ctx).filter((g) => !fresh.includes(g));
  const teachesBlending = node.teaches.some((s) => s.startsWith('blend:'));

  if (teachesBlending) {
    return [
      ...round(blends(SIZES.blendLessonBlends, ctx, now)),
      ...round(spread(picks(SIZES.blendLessonPicks, older, ctx, now), ctx)),
    ];
  }

  const nNew = older.length ? Math.ceil(SIZES.lessonPicks * SIZES.newShare) : SIZES.lessonPicks;
  const practice = [
    ...nonNull(Array.from({ length: fresh.length ? nNew : 0 }, (_, i) => pickLetterItem(fresh[i % fresh.length], ctx))),
    ...picks(SIZES.lessonPicks - (fresh.length ? nNew : 0), older, ctx, now),
  ];
  return [
    ...round(nonNull(fresh.map((g) => meetItem(g, ctx)))),
    ...round(spread(practice, ctx)),
    ...round(blends(SIZES.lessonBlends, ctx, now, new Set(fresh))),
  ];
}

/** A mini-boss or boss: the cumulative check for an area. Every letter appears at least once. */
export function planCheckpoint(area: AreaDef, ctx: GenContext, now: number): Round[] {
  const letters = nonNull(areaSkills(area).map(graphemeOf)).filter((g) => ctx.known.has(gpc(g)) && ctx.content.hasSound(g));
  const once = nonNull(letters.map((g) => pickLetterItem(g, ctx)));
  const extra = picks(Math.max(0, SIZES.checkpointPicks - once.length), letters, ctx, now);
  return [
    ...round(spread([...once, ...extra], ctx)),
    ...round(blends(SIZES.checkpointBlends, ctx, now)),
  ];
}

/** Skills that are overdue or shaky. An empty list means no practice is called for. */
export function practiceTargets(ctx: GenContext, now: number): SkillId[] {
  return [...ctx.known].filter((id) => {
    const s = ctx.states.get(id);
    return statusOf(s) === 'shaky' || isDue(s, now);
  });
}

/**
 * A practice round aimed at what is overdue or shaky. Returns null when
 * nothing is, unless `force` asks for a general warm-up anyway.
 */
export function planPractice(ctx: GenContext, now: number, force = false): Round[] | null {
  const targets = practiceTargets(ctx, now);
  if (targets.length === 0 && !force) return null;
  const needy = nonNull(targets.map(graphemeOf)).filter((g) => ctx.content.hasSound(g));
  const pool = needy.length ? needy : askableGraphemes(ctx);
  const wantBlends = force || targets.some((t) => t.startsWith('blend:'));
  const rounds = [
    ...round(spread(picks(SIZES.practicePicks, pool, ctx, now), ctx)),
    ...(wantBlends ? round(blends(SIZES.practiceBlends, ctx, now)) : []),
  ];
  return rounds.length ? rounds : null;
}

/**
 * Should practice come before the next area? Only if something that area
 * builds on is shaky after a fair number of tries. Returns the weak skills;
 * an empty list means go ahead.
 */
export function gate(previous: AreaDef | null, states: ReadonlyMap<SkillId, SkillState>): SkillId[] {
  if (!previous) return [];
  return areaSkills(previous).filter((id) => {
    const s = states.get(id);
    return statusOf(s) === 'shaky' && (s?.seen ?? 0) >= 6;
  });
}
