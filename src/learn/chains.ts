import { askableGraphemes, decodableWords, key, oddAt, type GenContext } from './generator';
import type { ChainItem, ChainStep, Word } from './items';
import { shuffle, weighted } from './rng';
import { blend, gpc, isVowel, shapeOf, soundsLike } from './skills';

// Word chains: a word, then another one letter away, then another. Spelling comes first, and every other step
// after it is a reading one wherever the new word has a drawing; where it has none, that step is spelling too.
// The rules it never breaks:
//  - every step changes exactly one tile, in place (never a letter added or dropped);
//  - every word is one the child can be asked to build: its letters and its shape taught, its clip recorded;
//  - every letter says its usual sound, so a tile is worth the same in every word of the chain;
//  - no word comes twice in a chain;
//  - a letter offered is a taught one that can be heard, and never one that would spell the same sound.

/** The lines the exercise says. Without all of them recorded no chain is made. */
export const CHAIN_PROMPTS = {
  /** "Change one letter to make ..." Then the word. */
  spell: 'change-one-letter-to-make',
  /** "What word is it now?" */
  read: 'what-word-is-it-now',
} as const;

/** Where two words differ, if they are the same length and differ in exactly one tile; -1 otherwise. */
export function changedAt(a: readonly string[], b: readonly string[]): number {
  if (a.length !== b.length) return -1;
  let at = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (at >= 0) return -1;
    at = i;
  }
  return at;
}

/** Words a chain may pass through: buildable, and every letter saying its usual sound. */
export function chainWords(ctx: GenContext): Word[] {
  return decodableWords(ctx).filter((w) => !w.graphemes.some((_, i) => oddAt(w, i)));
}

export interface ChainOptions {
  /** How many steps to try for, and the fewest that will do. A chain is as long as it can be between the two. */
  steps?: number;
  min?: number;
  /** Letters the chain should bring in, best of all as the letter a spelling step asks for. */
  favour?: readonly string[];
  /** Change the vowel wherever the words allow (sat, sit, set), and set only vowels beside a vowel that is asked for. */
  vowels?: boolean;
  /** Keep the chain to some of the words. */
  only?: (w: Word) => boolean;
  /** How much each word is wanted (by need, say). 1 if not given. */
  weight?: (w: Word) => number;
}

/** How many chains are drawn before the best is kept. */
const DRAWS = 16;

/** One walk through the words: from a start drawn by weight, each next word one letter from the last, none twice. */
function walk(pool: Word[], steps: number, o: ChainOptions, ctx: GenContext): Word[] | null {
  const want = (w: Word) => (o.weight?.(w) ?? 1) * (w.graphemes.some((g) => o.favour?.includes(g)) ? 4 : 1);
  const extend = (path: Word[], last: number): Word[] | null => {
    if (path.length === steps + 1) return path;
    const here = path[path.length - 1];
    let next = pool.filter((w) => !path.includes(w) && changedAt(here.graphemes, w.graphemes) >= 0);
    while (next.length) {
      // A chain that changes a different tile each time asks for the whole word to be looked at; one about vowels stays on the vowel.
      const turn = (w: Word) => {
        const at = changedAt(here.graphemes, w.graphemes);
        return o.vowels && isVowel(w.graphemes[at]) ? 9 : at !== last ? 3 : 1;
      };
      const pick = weighted(next, (w) => want(w) * turn(w), ctx.rng);
      next = next.filter((w) => w !== pick);
      const found = extend([...path, pick], changedAt(here.graphemes, pick.graphemes));
      if (found) return found;
    }
    return null;
  };
  let starts = [...pool];
  while (starts.length) {
    const start = weighted(starts, want, ctx.rng);
    starts = starts.filter((w) => w !== start);
    const found = extend([start], -1);
    if (found) return found;
  }
  return null;
}

/** How good a walk is: a favoured letter asked for in a spelling step counts most, then one seen at all, then tiles changed, and a word to be read that has a drawing. */
function score(path: Word[], o: ChainOptions, drawn: ReadonlySet<string>): number {
  let n = 0;
  const places = new Set<number>();
  for (let i = 1; i < path.length; i++) {
    const at = changedAt(path[i - 1].graphemes, path[i].graphemes);
    places.add(at);
    const fav = o.favour?.includes(path[i].graphemes[at]);
    n += fav ? (i % 2 === 1 ? 6 : 2) : path[i].graphemes.some((g) => o.favour?.includes(g)) ? 1 : 0;
    if (o.vowels && isVowel(path[i].graphemes[at])) n += 5;
    if (i % 2 === 0 && drawn.has(path[i].text)) n += 0.4; // only between chains otherwise as good
  }
  return n + places.size * 2;
}

/** Up to `n` of `pool`, drawn by weight, none twice. */
function draw<T>(pool: T[], n: number, weight: (t: T) => number, ctx: GenContext): T[] {
  const out: T[] = [];
  let left = [...pool];
  while (out.length < n && left.length) {
    const pick = weighted(left, weight, ctx.rng);
    out.push(pick);
    left = left.filter((x) => x !== pick);
  }
  return out;
}

/**
 * The letters set beside the right one in a spelling step: taught and heard, never the letter that is leaving,
 * never one that sounds like the right one. One of its own kind (a vowel for a vowel), one that makes a real word,
 * and one the child has put there before are the most use.
 */
function spellStep(from: Word, to: Word, at: number, pool: Word[], taught: string[], ctx: GenContext, vowels = false): ChainStep | null {
  const target = to.graphemes[at];
  const made = (g: string) => pool.find((w) => w.graphemes.length === to.graphemes.length && w.graphemes.every((x, i) => (i === at ? g : to.graphemes[i]) === x));
  const confused = ctx.confusions.get(target);
  const wrong = draw(
    taught.filter((g) => !soundsLike(g, target) && !soundsLike(g, from.graphemes[at]) && (!vowels || !isVowel(target) || isVowel(g))),
    2,
    (g) => 1 + (isVowel(g) === isVowel(target) ? 2 : 0) + (made(g) ? 2 : 0) + 3 * (confused?.get(g) ?? 0),
    ctx,
  );
  if (wrong.length === 0) return null;
  return {
    mode: 'spell', word: to.text, graphemes: to.graphemes, at,
    letters: shuffle([target, ...wrong], ctx.rng).map((g) => (g !== target && made(g) ? { grapheme: g, makes: made(g)!.text } : { grapheme: g })),
    words: [],
    skills: [gpc(target), blend(shapeOf(to.graphemes))],
    supports: [...new Set(to.graphemes.filter((_, i) => i !== at).map(gpc))].filter((s) => s !== gpc(target)),
  };
}

/**
 * A reading step: the new word and two others, each as a drawing. Only where the word has a drawing and there are two
 * more drawn words the child can read to stand beside it; null if not. Ones that differ from it only in the tile that
 * changed (the word it was a moment ago among them) come first, then others one letter away, then others of its length.
 */
function readStep(to: Word, at: number, drawn: Word[], ctx: GenContext): ChainStep | null {
  const others = drawn.filter((w) => w.text !== to.text);
  if (others.length === drawn.length || others.length < 2) return null;
  const confused = ctx.confusions.get(to.text);
  const near = (w: Word) => {
    const d = changedAt(to.graphemes, w.graphemes);
    // Near misses all but always: there are many drawn words, and few of them a letter away.
    return (d === at ? 100 : d >= 0 ? 40 : w.graphemes.length === to.graphemes.length ? 1 : 0.2) + 3 * (confused?.get(w.text) ?? 0);
  };
  return {
    mode: 'read', word: to.text, graphemes: to.graphemes, at,
    letters: [],
    words: shuffle([to, ...draw(others, 2, near, ctx)], ctx.rng).map((w) => w.text),
    skills: [blend(shapeOf(to.graphemes))],
    supports: [...new Set(to.graphemes.map(gpc))],
  };
}

/** A word chain, or null where the words the child can build do not link up far enough, or the exercise's lines are not recorded. */
export function chainItem(ctx: GenContext, o: ChainOptions = {}): ChainItem | null {
  if (!Object.values(CHAIN_PROMPTS).every((p) => ctx.content.hasPrompt?.(p))) return null;
  const all = chainWords(ctx);
  const pool = all.filter(o.only ?? (() => true));
  const taught = askableGraphemes(ctx);
  const names = new Set(ctx.content.drawable.map((d) => d.name));
  const drawn = all.filter((w) => names.has(w.text));
  const most = o.steps ?? 4;
  for (let steps = most; steps >= Math.min(most, o.min ?? 3); steps--) {
    let best: Word[] | null = null;
    for (let i = 0; i < DRAWS; i++) {
      const path = walk(pool, steps, o, ctx);
      if (!path) break; // none this long from any start
      if (!best || score(path, o, names) > score(best, o, names)) best = path;
    }
    if (!best) continue;
    const made = best.slice(1).map((to, i) => {
      const at = changedAt(best![i].graphemes, to.graphemes);
      // Every other step is read, where its word can be shown; where it cannot, it is spelt like the rest.
      return (i % 2 === 1 && readStep(to, at, drawn, ctx)) || spellStep(best![i], to, at, all, taught, ctx, o.vowels);
    });
    if (made.some((s) => !s)) continue;
    return { kind: 'chain', key: key('chain', best[0].text), start: best[0].text, graphemes: best[0].graphemes, steps: made as ChainStep[] };
  }
  return null;
}
