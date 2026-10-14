import { areaSkills, areaVowels, type AreaDef, type NodeDef } from './curriculum';
import { chainItem } from './chains';
import { askableGraphemes, catchItem, heartBuild, heartFind, heartMeet, heartWords, manyItem, manyWords, meetItem, oddAt, pickLetterItem, secondMeetItem, secondPickItem, type GenContext } from './generator';
import { readItem, type ReadWant } from './reads';
import type { ChainItem, ReadItem, Round, Word } from './items';
import { isDue, statusOf, type SkillState } from './model';
import { shuffle, weighted } from './rng';
import { SIZES, blends, manyAsks, need, nonNull, picks, round, spread, vowelPicks } from './rounds';
import { SECOND_SOUND, blend, gpc, graphemeOf, heart, heartOf, shapeOf, type SkillId } from './skills';

export { SIZES, need } from './rounds';

// Chooses what to work on. Driven by evidence, not the calendar:
//  - old material is mixed into every lesson;
//  - a practice round is offered when something is overdue or shaky;
//  - practice only blocks progress when the next area depends on something weak.

/** The grapheme whose second sound a skill is, where that sound is taught as a sound (th as in "thin"), not as an ending. */
const secondOf = (s: SkillId): string | null => (s.startsWith('second:') && s.slice(7) in SECOND_SOUND ? s.slice(7) : null);
/** An s on the end, and s saying /z/ there. */
const isEnding = (s: SkillId) => s.startsWith('suffix:') || (s.startsWith('second:') && !secondOf(s));

/**
 * A lesson on a grapheme's second sound (th as in "thin"): the tile is met again with that sound, picked by it among older
 * letters (never by its first sound in the same round), then words with that sound in it are built.
 */
function planSecond(node: NodeDef, ctx: GenContext, now: number): Round[] {
  const gs = nonNull(node.teaches.map(secondOf));
  const older = askableGraphemes(ctx).filter((g) => !gs.includes(g));
  const fresh = nonNull(Array.from({ length: Math.ceil(SIZES.lessonPicks * SIZES.newShare) }, (_, i) => secondPickItem(gs[i % gs.length], ctx)));
  const odd = (w: Word) => w.graphemes.some((g, i) => gs.includes(g) && oddAt(w, i));
  return [
    ...round(nonNull(gs.map((g) => secondMeetItem(g, ctx)))),
    ...round(spread([...fresh, ...picks(SIZES.lessonPicks - fresh.length, older, ctx, now)], ctx, fresh.length ? gs[0] : undefined)),
    ...round(blends(SIZES.lessonBlends, ctx, now, { only: odd, favour: gs })),
  ];
}

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
  return [...h.rounds, ...round(node.review ? reads(SIZES.reviewReads, ctx, h.met, node.favours) : reads(SIZES.lessonReads, ctx, h.met))];
}

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
 * A sentence about a thing on or in another ("the bug is on the bed") is made by the generator and can be played by the
 * exercise, but is not asked for yet: the little scenes are too big for the clearing (docs/heart-words.md).
 */
const SCENES = false;

/**
 * Words read in silence: first a phrase ("the bug"), then sentences that say which thing ("I see a bug"), once the child
 * has met the words they begin with; a phrase again until then. Only irregular words the child has met stand in them.
 * `tell` are vowels to be told apart (pan, pin).
 */
function reads(n: number, ctx: GenContext, met: readonly string[], tell: readonly string[] = []): ReadItem[] {
  const out: ReadItem[] = [];
  for (let i = 0; i < n; i++) {
    const want: ReadWant = i === 0 ? 'phrase' : SCENES && ctx.rng() < 0.5 ? 'scene' : 'sentence';
    // Not the same thing twice running, where chance allows another.
    let item = readItem(ctx, met, want, SIZES.sentenceTiles, tell);
    for (let tries = 0; item && out.length && tries < 4 && item.target.thing === out[out.length - 1].target.thing; tries++) item = readItem(ctx, met, want, SIZES.sentenceTiles, tell);
    if (item) out.push(item);
  }
  return out;
}

/**
 * A word chain: one a lesson, after its own teaching, so nothing the lesson is for waits behind it.
 * `favour` are letters it should bring in. A lesson on new word shapes (`own`) gets a chain of those shapes if its
 * words link up at all, even a short one; if not, and everywhere else, the chain is of any words the child can build.
 * Nothing before there are words enough to link: in practice, from the lesson after the first on blending.
 */
function chains(ctx: GenContext, now: number, favour: readonly string[] = [], own: readonly SkillId[] = []): ChainItem[] {
  const weight = (w: Word) => need(ctx.states.get(blend(shapeOf(w.graphemes))), now);
  const any = { steps: SIZES.chainSteps, favour, weight };
  const ofOwn = own.length ? chainItem(ctx, { ...any, min: SIZES.shapeChainLeast, only: (w) => own.includes(blend(shapeOf(w.graphemes))) }) : null;
  return nonNull([ofOwn ?? chainItem(ctx, { ...any, min: SIZES.chainLeast })]);
}

/**
 * The chains of a lesson that goes back over vowels, and of its checkpoint: two, each changing the vowel wherever its
 * words allow (sat, sit, set). The first is of three-letter words, where a vowel has the most neighbours; the second of
 * the lesson's new shapes if they link up, and of any longer words if not, so more sounds are held while the vowel moves.
 */
function vowelChains(ctx: GenContext, now: number, vowels: readonly string[], own: readonly SkillId[] = []): ChainItem[] {
  const weight = (w: Word) => need(ctx.states.get(blend(shapeOf(w.graphemes))), now);
  const any = { steps: SIZES.chainSteps, favour: vowels, weight, vowels: true };
  const long = (w: Word) => w.graphemes.length > 3;
  const short = chainItem(ctx, { ...any, min: SIZES.chainLeast, only: (w) => !long(w) });
  const ofOwn = own.length ? chainItem(ctx, { ...any, min: SIZES.shapeChainLeast, only: (w) => own.includes(blend(shapeOf(w.graphemes))) }) : null;
  return nonNull([short, ofOwn ?? chainItem(ctx, { ...any, min: SIZES.shapeChainLeast, only: long })]);
}

/**
 * A lesson that goes back over short vowels. A sound is matched to its vowel with only vowels to choose between;
 * then words with the lesson's vowels are built, the first two of a new shape if the lesson brings one (shown how).
 */
function planReview(node: NodeDef, ctx: GenContext, now: number): Round[] {
  const vowels = node.favours ?? [];
  const own = (w: Word) => node.teaches.includes(blend(shapeOf(w.graphemes)));
  const fresh = blends(node.teaches.length ? SIZES.lessonBlends : 0, ctx, now, { intro: true, only: own, favour: vowels });
  return [
    ...round(vowelPicks(SIZES.reviewPicks, vowels, ctx, now)),
    ...round([...fresh, ...blends(SIZES.reviewBlends - fresh.length, ctx, now, { favour: vowels, only: (w) => !own(w) })]),
  ];
}

/**
 * A lesson. `ctx.known` must already include what the node teaches.
 * New letters are met, then practised with older letters mixed in, then caught as they fall, then used in words
 * (only sounded out and heard until the lesson that teaches word building).
 * The first question after meeting a letter is always about that letter.
 * Then a word chain, once the child's words link up into one.
 * Then an irregular word, if the lesson teaches one, and last of all a few words to read with nobody saying them.
 */
export function planLesson(node: NodeDef, ctx: GenContext, now: number): Round[] {
  const letters = [...nonNull(node.teaches.map(graphemeOf)), ...(node.favours ?? [])];
  const shapes = node.teaches.filter((s) => s.startsWith('blend:'));
  if (node.review) return [...planReview(node, ctx, now), ...round(vowelChains(ctx, now, node.favours ?? [], shapes)), ...closing(node, ctx, now)];
  return [...teaching(node, ctx, now), ...round(chains(ctx, now, letters, shapes)), ...closing(node, ctx, now)];
}

function teaching(node: NodeDef, ctx: GenContext, now: number): Round[] {
  const fresh = nonNull(node.teaches.map(graphemeOf)).filter((g) => ctx.content.hasSound(g));
  const older = askableGraphemes(ctx).filter((g) => !fresh.includes(g));
  const teachesBlending = node.teaches.some((s) => s.startsWith('blend:'));

  if (node.teaches.some(isEnding)) return planEnding(node, older, ctx, now);
  if (node.teaches.some(secondOf)) return planSecond(node, ctx, now);

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

/** A mini-boss or boss: the cumulative check for an area. Every letter appears at least once, its words use them, an ending taught here is asked about, and there is a word chain. */
export function planCheckpoint(area: AreaDef, ctx: GenContext, now: number): Round[] {
  const vowels = areaVowels(area);
  // An area that went back over the vowels: every one of them is asked for and stands in a word, of the new shapes most of all.
  if (vowels.length) {
    return [
      ...round(vowelPicks(SIZES.checkpointPicks, vowels, ctx, now)),
      ...round(blends(SIZES.reviewCheckBlends, ctx, now, { favour: vowels })),
      ...round(vowelChains(ctx, now, vowels)),
      ...closingCheck(area, ctx, now, vowels),
    ];
  }
  const letters = nonNull(areaSkills(area).map(graphemeOf)).filter((g) => ctx.known.has(gpc(g)) && ctx.content.hasSound(g));
  // A second sound taught here is asked for too (th as in "thin").
  const once = nonNull([...letters.map((g) => pickLetterItem(g, ctx)), ...areaSkills(area).map(secondOf).map((g) => (g ? secondPickItem(g, ctx) : null))]);
  const extra = picks(Math.max(0, SIZES.checkpointPicks - once.length), letters, ctx, now);
  return [
    ...round(spread([...once, ...extra], ctx)),
    ...round(blends(SIZES.checkpointBlends, ctx, now, { favour: letters })),
    ...round(areaSkills(area).some(isEnding) ? manyAsks(SIZES.checkpointMany, manyWords(ctx), ctx) : []),
    ...round(chains(ctx, now, letters)),
    ...closingCheck(area, ctx, now),
  ];
}

/** A checkpoint asks for each irregular word its area taught, has each spelled unaided, and ends on words read in silence. */
function closingCheck(area: AreaDef, ctx: GenContext, now: number, tell: readonly string[] = []): Round[] {
  const own = nonNull(areaSkills(area).map(heartOf));
  const h = hearts(ctx, now, [], own);
  const builds = nonNull(own.filter((w) => h.met.includes(w)).map((w) => heartBuild(w, ctx, 'free')));
  return [...h.rounds, ...round(builds), ...round(reads(SIZES.checkpointReads, ctx, h.met, tell))];
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
  const seconds = nonNull(targets.map(secondOf).map((g) => (g ? secondPickItem(g, ctx) : null)));
  const rounds = [
    ...round(spread([...seconds, ...picks(SIZES.practicePicks - seconds.length, pool, ctx, now)], ctx)),
    ...(wantBlends ? round(blends(SIZES.practiceBlends, ctx, now)) : []),
    ...(wantBlends ? round(chains(ctx, now)) : []),
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
