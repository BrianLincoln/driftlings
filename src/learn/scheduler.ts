import { areaSkills, type AreaDef, type NodeDef } from './curriculum';
import { askableGraphemes, blendItem, catchItem, decodableWords, heartBuild, heartFind, heartMeet, heartWords, manyItem, manyWords, meetItem, oddAt, pickLetterItem, readItem, readableWords, type GenContext } from './generator';
import type { BlendItem, Item, ManyItem, PickLetterItem, ReadItem, Round, Word } from './items';
import { isDue, statusOf, type SkillState } from './model';
import { shuffle, weighted } from './rng';
import { blend, gpc, graphemeOf, heart, heartOf, shapeOf, type SkillId } from './skills';

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
  /** Picking an irregular word out by ear: in the lesson that teaches one, and when one has gone shaky or is due. */
  heartFinds: 3,
  reviewFinds: 2,
  /** Irregular words taught before the child's game had them, met at the top of a later lesson: this many at a time. */
  catchUps: 2,
  /** Phrases or sentences read in silence at the end of a lesson, and at a checkpoint. */
  lessonReads: 2,
  checkpointReads: 2,
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

/** What every lesson ends with once there are irregular words: anything about them that is owed, and words to read in silence. */
function closing(node: NodeDef, ctx: GenContext, now: number): Round[] {
  const h = hearts(ctx, now, nonNull(node.teaches.map(heartOf)));
  return [...h.rounds, ...round(reads(SIZES.lessonReads, ctx, h.met))];
}

const round = (items: Item[]): Round[] => (items.length ? [{ exercise: items[0].kind, items }] : []);

/** An irregular word the child has answered about at least once. Until then it has to be met before anything asks about it. */
const metHeart = (word: string, ctx: GenContext) => (ctx.states.get(heart(word))?.seen ?? 0) > 0;

/**
 * The rounds about irregular words. `fresh` are the ones this lesson teaches. A word is always met before it is
 * asked about: the fresh ones, any the child was taught before the game had them (a few at a time), and any gone shaky.
 * Then each is picked out by ear, twice for a fresh one, with older ones by need; and a fresh one is spelled once, shown how.
 * With nothing to meet there is a round only when a word is shaky or due, or `ask` names the words to ask about.
 */
function hearts(ctx: GenContext, now: number, fresh: readonly string[] = [], ask: readonly string[] = []): { rounds: Round[]; met: string[] } {
  const all = heartWords(ctx).map((w) => w.text);
  const taught = fresh.filter((w) => all.includes(w));
  const behind = all.filter((w) => !taught.includes(w) && !metHeart(w, ctx)).slice(0, SIZES.catchUps);
  const shaky = all.filter((w) => !taught.includes(w) && statusOf(ctx.states.get(heart(w))) === 'shaky');
  const meeting = [...taught, ...behind, ...shaky];
  const met = all.filter((w) => metHeart(w, ctx) || meeting.includes(w));
  const due = met.filter((w) => isDue(ctx.states.get(heart(w)), now));
  const first = !all.some((w) => metHeart(w, ctx));
  const meets = nonNull(meeting.map((w, i) => heartMeet(w, ctx, first && i === 0)));
  // Every word being met is asked about straight after, a fresh one twice; the rest of the round goes by need.
  const targets = [...taught, ...taught, ...behind, ...shaky, ...ask.filter((w) => met.includes(w) && !meeting.includes(w))];
  const n = meeting.length ? Math.max(SIZES.heartFinds, targets.length) : targets.length || (due.length ? SIZES.reviewFinds : 0);
  while (met.length && targets.length < n) targets.push(weighted(met, (w) => need(ctx.states.get(heart(w)), now), ctx.rng));
  const finds = spread(nonNull(targets.map((w) => heartFind(w, ctx, met))), ctx, meeting[0]);
  return {
    rounds: [...round([...meets, ...finds]), ...round(nonNull(taught.map((w) => heartBuild(w, ctx, 'guided'))))],
    met,
  };
}

/**
 * Sentences ("the bug is on the bed") are made by the generator and can be played by the exercise, but are not asked for yet:
 * the little scenes are too big for the clearing and a sentence's two lines hide each other on a tall screen (docs/heart-words.md).
 */
const SENTENCES = false;

/** Words read in silence: a phrase, and once `SENTENCES` is on, then a sentence if one can be made. Only irregular words the child has met stand in them. */
function reads(n: number, ctx: GenContext, met: readonly string[]): ReadItem[] {
  const out: ReadItem[] = [];
  for (let i = 0; i < n; i++) {
    // Not the same thing twice running, where chance allows another.
    let item = readItem(ctx, met, SENTENCES && i > 0);
    for (let tries = 0; item && out.length && tries < 4 && item.target.thing === out[out.length - 1].target.thing; tries++) item = readItem(ctx, met, SENTENCES && i > 0);
    if (item) out.push(item);
  }
  return out;
}

/**
 * A lesson. `ctx.known` must already include what the node teaches.
 * New letters are met, then practised with older letters mixed in, then caught as they fall, then used in words
 * (only sounded out and heard until the lesson that teaches word building).
 * The first question after meeting a letter is always about that letter.
 * Then an irregular word, if the lesson teaches one, and last of all a few words to read with nobody saying them.
 */
export function planLesson(node: NodeDef, ctx: GenContext, now: number): Round[] {
  return [...teaching(node, ctx, now), ...closing(node, ctx, now)];
}

function teaching(node: NodeDef, ctx: GenContext, now: number): Round[] {
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
    ...closingCheck(area, ctx, now),
  ];
}

/** A checkpoint asks for each irregular word its area taught, has each spelled unaided, and ends on words read in silence. */
function closingCheck(area: AreaDef, ctx: GenContext, now: number): Round[] {
  const own = nonNull(areaSkills(area).map(heartOf));
  const h = hearts(ctx, now, [], own);
  const builds = nonNull(own.filter((w) => h.met.includes(w)).map((w) => heartBuild(w, ctx, 'free')));
  return [...h.rounds, ...round(builds), ...round(reads(SIZES.checkpointReads, ctx, h.met))];
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
    ...hearts(ctx, now).rounds,
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
  // Irregular words do not hold anyone back yet: not until real children have been watched with them.
  return areaSkills(previous).filter((id) => !heartOf(id)).filter((id) => {
    const s = states.get(id);
    return statusOf(s) === 'shaky' && (s?.seen ?? 0) >= 6;
  });
}
