import { areaSkills, type AreaDef, type NodeDef } from './curriculum';
import { askableGraphemes, blendItem, catchItem, decodableWords, manyItem, manyWords, meetItem, oddAt, pickLetterItem, readableWords, type GenContext } from './generator';
import type { BlendItem, Item, ManyItem, PickLetterItem, Round, Word } from './items';
import { isDue, statusOf, type SkillState } from './model';
import { shuffle, weighted } from './rng';
import { blend, gpc, graphemeOf, shapeOf, type SkillId } from './skills';

// Chooses what to work on. Driven by evidence, not the calendar:
//  - old material is mixed into every lesson;
//  - a practice round is offered when something is overdue or shaky;
//  - practice only blocks progress when the next area depends on something weak.

export const SIZES = {
  lessonPicks: 6,
  /** Picks when the new letter is the only one there is: every question has the same answer. */
  soloPicks: 3,
  /** Share of a letter lesson's picks spent on the new letter. */
  newShare: 0.6,
  /** How many of the new letter to catch as they fall. */
  lessonCatches: 4,
  lessonBlends: 2,
  blendLessonBlends: 4,
  blendLessonPicks: 4,
  checkpointPicks: 8,
  checkpointBlends: 3,
  practicePicks: 5,
  practiceBlends: 2,
  /** In a lesson about an ending: how many things are shown going from one to several, and how many are then asked about. */
  manyShows: 3,
  manyAsks: 4,
  manyLessonPicks: 3,
  checkpointMany: 2,
  practiceMany: 3,
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

/**
 * Avoid the same answer three times running, where the pool allows.
 * `first`, when given, is the answer the round must open with.
 */
function spread<T extends { target?: string; word?: string }>(items: T[], ctx: GenContext, first?: string): T[] {
  const out = shuffle(items, ctx.rng);
  const k = (t: T) => t.target ?? t.word;
  const lead = first === undefined ? -1 : out.findIndex((t) => k(t) === first);
  if (lead > 0) out.unshift(...out.splice(lead, 1));
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

/**
 * Words to build. A word whose shape has not been taught yet is only sounded
 * out and heard; letter lessons use these from the start (`early`), so words
 * being made of letters is familiar long before anything is asked.
 *
 * `only` keeps the round to some of the words.
 * `intro` is the lesson that teaches the shapes, where the watcher first
 * jumbles the letters. It goes through the word list in order (the list starts
 * with the simplest), so it always opens on the same word, and the child is
 * shown how on the first word of each shape. No shape takes more than its
 * share of the round while another has a word left. Anywhere else the child is
 * shown how on the first word unless that word shape is already going well.
 */
function blends(n: number, ctx: GenContext, now: number, opts: { favour?: readonly string[]; intro?: boolean; early?: boolean; only?: (w: Word) => boolean } = {}): BlendItem[] {
  let pool = (opts.early ? readableWords(ctx) : decodableWords(ctx)).filter(opts.only ?? (() => true));
  const out: BlendItem[] = [];
  const shown = new Set<SkillId>();
  const favoured = (x: { graphemes: string[] }) => x.graphemes.filter((g) => opts.favour?.includes(g));
  const shapeOfWord = (x: { graphemes: string[] }) => blend(shapeOf(x.graphemes));
  const share = Math.ceil(n / Math.max(1, new Set(pool.map(shapeOfWord)).size));
  const room = (xs: Word[]) => xs.find((x) => out.filter((i) => i.skills[0] === shapeOfWord(x)).length < share);
  while (out.length < n && pool.length > 0) {
    // Words with a favoured letter come first, and one with a favoured letter no word has used yet before those:
    // however long the word list gets, a new letter is seen in a word, and a checkpoint's words go round its letters.
    const used = new Set(out.flatMap((i) => i.graphemes));
    const unseen = pool.filter((x) => favoured(x).some((g) => !used.has(g)));
    const any = unseen.length ? unseen : pool.filter((x) => favoured(x).length > 0);
    const from = any.length ? any : pool;
    const w = opts.intro ? room(from) ?? room(pool) ?? from[0] : weighted(from, (x) => need(ctx.states.get(shapeOfWord(x)), now), ctx.rng);
    pool = pool.filter((x) => x.text !== w.text); // each word once per round
    const shape = shapeOfWord(w);
    const status = statusOf(ctx.states.get(shape));
    const guide = opts.intro ? !shown.has(shape) : out.length === 0 && (status === 'new' || status === 'shaky');
    const item = blendItem(w.text, ctx, !ctx.known.has(shape) ? 'read' : guide ? 'guided' : 'free');
    if (!item) continue;
    shown.add(shape);
    out.push(item);
  }
  return out;
}

/** "Which word is ...": the word for one or the word for several, turn about, going round the things given. */
function manyAsks(n: number, pool: ReadonlyArray<{ base: string }>, ctx: GenContext): ManyItem[] {
  const things = shuffle([...pool], ctx.rng);
  const first = ctx.rng() < 0.5 ? 0 : 1;
  return things.length ? nonNull(Array.from({ length: n }, (_, i) => manyItem(things[i % things.length].base, ctx, 'ask', (i + first) % 2 === 0))) : [];
}

const isEnding = (s: SkillId) => s.startsWith('suffix:') || s.startsWith('second:');

/**
 * A lesson about an s on the end. Three things go from one to several while the child taps the s on,
 * then one of each pair of words is asked for. The lesson on s saying /z/ uses the things whose s says
 * that, asks about one from before as well, and goes on to build the short words where s says it too.
 */
function planEnding(node: NodeDef, older: string[], ctx: GenContext, now: number): Round[] {
  const z = node.teaches.some((s) => s.startsWith('second:'));
  const all = manyWords(ctx);
  // A different three each time where there are more; the questions go round all of the lesson's own.
  const own = shuffle(all.filter((m) => (m.sound !== 's') === z), ctx.rng);
  const before = z ? all.filter((m) => m.sound === 's') : [];
  const odd = (w: Word) => w.graphemes.some((_, i) => oddAt(w, i));
  return [
    ...round([
      ...nonNull(own.slice(0, SIZES.manyShows).map((m) => manyItem(m.base, ctx, 'show'))),
      ...manyAsks(SIZES.manyAsks - (before.length ? 1 : 0), own, ctx),
      ...manyAsks(1, before, ctx),
    ]),
    ...round(blends(SIZES.lessonBlends, ctx, now, z ? { only: odd } : {})),
    ...round(spread(picks(SIZES.manyLessonPicks, older, ctx, now), ctx)),
  ];
}

const round = (items: Item[]): Round[] => (items.length ? [{ exercise: items[0].kind, items }] : []);

/**
 * A lesson. `ctx.known` must already include what the node teaches.
 * New letters are met, then practised with older letters mixed in, then caught as they fall, then used in words
 * (only sounded out and heard until the lesson that teaches word building).
 * The first question after meeting a letter is always about that letter.
 */
export function planLesson(node: NodeDef, ctx: GenContext, now: number): Round[] {
  const fresh = nonNull(node.teaches.map(graphemeOf)).filter((g) => ctx.content.hasSound(g));
  const older = askableGraphemes(ctx).filter((g) => !fresh.includes(g));
  const teachesBlending = node.teaches.some((s) => s.startsWith('blend:'));

  if (node.teaches.some(isEnding)) return planEnding(node, older, ctx, now);

  if (teachesBlending) {
    // Only words of the shapes this lesson is about: a later one has every earlier shape to hand as well.
    const own = (w: Word) => node.teaches.includes(blend(shapeOf(w.graphemes)));
    return [
      ...round(blends(SIZES.blendLessonBlends, ctx, now, { intro: true, only: own, favour: node.favours })),
      ...round(spread(picks(SIZES.blendLessonPicks, older, ctx, now), ctx)),
    ];
  }

  const nNew = older.length ? Math.ceil(SIZES.lessonPicks * SIZES.newShare) : SIZES.soloPicks;
  const practice = [
    ...nonNull(Array.from({ length: fresh.length ? nNew : 0 }, (_, i) => pickLetterItem(fresh[i % fresh.length], ctx))),
    ...picks(SIZES.lessonPicks - (fresh.length ? nNew : 0), older, ctx, now),
  ];
  return [
    ...round(nonNull(fresh.map((g) => meetItem(g, ctx)))),
    ...round(spread(practice, ctx, fresh[fresh.length - 1])),
    ...round(nonNull(fresh.slice(-1).map((g) => catchItem(g, ctx, SIZES.lessonCatches)))),
    ...round(blends(SIZES.lessonBlends, ctx, now, { favour: fresh, early: true })),
  ];
}

/** A mini-boss or boss: the cumulative check for an area. Every letter appears at least once, its words use them, and an ending taught here is asked about. */
export function planCheckpoint(area: AreaDef, ctx: GenContext, now: number): Round[] {
  const letters = nonNull(areaSkills(area).map(graphemeOf)).filter((g) => ctx.known.has(gpc(g)) && ctx.content.hasSound(g));
  const once = nonNull(letters.map((g) => pickLetterItem(g, ctx)));
  const extra = picks(Math.max(0, SIZES.checkpointPicks - once.length), letters, ctx, now);
  return [
    ...round(spread([...once, ...extra], ctx)),
    ...round(blends(SIZES.checkpointBlends, ctx, now, { favour: letters })),
    ...round(areaSkills(area).some(isEnding) ? manyAsks(SIZES.checkpointMany, manyWords(ctx), ctx) : []),
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
    ...(targets.some(isEnding) ? round(manyAsks(SIZES.practiceMany, manyWords(ctx), ctx)) : []),
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
