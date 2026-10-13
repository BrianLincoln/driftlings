import { behaving, byHeart, decodableWords, heartWords, key, oddAt, onTiles, readableWords, type GenContext } from './generator';
import type { Picture, ReadItem, Word } from './items';
import { shuffle, weighted } from './rng';
import { blend, heart, isVowel, second, shapeOf, type SkillId } from './skills';

// Words nobody says: a phrase or a sentence to read in silence, and the pictures to choose between.
// Like everything the generator makes, only from words the child can read and that have their clips.

/** What is asked for: "the bug", "I see a bug", or "the bug is on the bed". The longer two fall back to a phrase. */
export type ReadWant = 'phrase' | 'sentence' | 'scene';

/** The irregular words that may stand in front of a thing. */
const ARTICLES = ['the', 'a'];

/**
 * How a sentence about one thing may begin: "I see a bug", "it is a bug". An article and the thing follow.
 * Each word is an irregular word the child has met or a word they can sound out ("it", and "is" once s says /z/).
 * The picture tells only the thing; the words before it are read in use, as "the" is in a phrase.
 */
const LEADS = [['I', 'see'], ['you', 'see'], ['it', 'is'], ['I', 'have']];

/** Drawn things whose word the child can read with nobody saying it. */
export function readableThings(ctx: GenContext): Array<{ name: string; on: boolean; in: boolean; word: Word }> {
  const words = decodableWords(ctx);
  return ctx.content.drawable.flatMap((d) => {
    const word = words.find((w) => w.text === d.name);
    return word ? [{ ...d, word }] : [];
  });
}

/** A picture in words, for the log: "bug", "bug on bed". */
export const pictureLabel = (p: Picture): string => (p.where ? `${p.thing} ${p.where.rel} ${p.where.thing}` : p.thing);

const tiles = (ws: Word[]) => ws.reduce((n, w) => n + w.graphemes.length, 0);

/**
 * Words to read in silence and the pictures to choose between. `met` are the irregular words the child has met:
 * no other may stand in what is read.
 * A sentence when one is asked for and its words can all be read, in no more than `most` tiles; if not, a phrase ("the bug").
 * Null without three things to choose between, or with no "the" or "a" to put before one.
 * `tell` are vowels to be told apart: a thing with one of them whose word is another's but for the vowel (pan, pin)
 * is the one to read where there is such a thing, and the other is always beside it.
 */
export function readItem(ctx: GenContext, met: readonly string[], want: ReadWant = 'phrase', most = Infinity, tell: readonly string[] = []): ReadItem | null {
  const things = readableThings(ctx);
  const hearts = heartWords(ctx).filter((w) => met.includes(w.text));
  const arts = hearts.filter((w) => ARTICLES.includes(w.text));
  if (things.length < 3 || arts.length === 0) return null;
  const any = <T>(xs: T[]): T => xs[Math.floor(ctx.rng() * xs.length)];
  /** How easily `b` is taken for `a`: most of all when one letter apart (cat, cap), then when it starts the same way. */
  const apart = (a: string, b: string) => (a.length === b.length ? [...a].filter((c, i) => c !== b[i]).length : 9);
  const twins = (a: string, b: string) => apart(a, b) === 1 && [...a].some((c, i) => c !== b[i] && isVowel(c) && isVowel(b[i]));
  const near = (a: string, b: string) => 1 + (apart(a, b) === 1 ? 14 : 0) + (a[0] === b[0] ? 4 : 0) + ([...a].some((c) => b.includes(c)) ? 1 : 0) + (tell.length && twins(a, b) ? 60 : 0);
  /** Another thing, for choice beside `than`: a near miss if there is one, so the first letter is not enough. */
  const other = (than: string, not: string[], ok: (t: (typeof things)[number]) => boolean = () => true) => {
    const pool = things.filter((t) => t.name !== than && !not.includes(t.name) && ok(t));
    return pool.length ? weighted(pool, (t) => near(t.name, than), ctx.rng) : null;
  };
  const subject = tell.length
    ? weighted(things, (t) => (tell.some((v) => t.name.includes(v)) ? 3 : 1) * (things.some((o) => twins(t.name, o.name)) ? 6 : 1), ctx.rng)
    : any(things);
  const used = (ws: Word[]): SkillId[] => [...new Set(ws.flatMap((w) => [...(byHeart(w, ctx).some(Boolean) ? [heart(w.text)] : []), ...behaving(w, ctx), ...w.graphemes.flatMap((g, i) => (oddAt(w, i) && ctx.known.has(second(g)) ? [second(g)] : []))]))];
  const shapes = (ws: Word[]) => [...new Set(ws.map((w) => blend(shapeOf(w.graphemes))))];
  const little = [...hearts, ...readableWords(ctx)];
  const word = (text: string) => little.find((w) => w.text === text);

  if (want === 'scene') {
    const is = word('is');
    const rels = (['on', 'in'] as const).filter((r) => word(r) && things.some((t) => t[r]));
    const rel = any(rels);
    const place = rel && weighted(things.filter((t) => t[rel] && t.name !== subject.name), () => 1, ctx.rng);
    const wrongSubject = place && other(subject.name, [place.name]);
    const wrongPlace = place && other(place.name, [subject.name], (t) => t[rel]);
    if (is && rel && place && wrongSubject) {
      const at = (thing: string, where: string): Picture => ({ thing, where: { rel, thing: where } });
      // The third choice is wrong in its last word where there is somewhere else to put the thing, in its first if not.
      const third = wrongPlace ? at(subject.name, wrongPlace.name) : other(subject.name, [place.name, wrongSubject.name]);
      const words = [any(arts), subject.word, is, word(rel)!, any(arts), place.word];
      if (third && tiles(words) <= most) {
        return {
          kind: 'read', key: key('read', `${subject.name}-${rel}-${place.name}`),
          words: words.map((w) => onTiles(w, ctx)),
          target: at(subject.name, place.name),
          choices: shuffle([at(subject.name, place.name), at(wrongSubject.name, place.name), 'thing' in third ? third : at(third.name, place.name)], ctx.rng),
          skills: shapes([subject.word, place.word]), supports: used(words),
        };
      }
    }
  }
  const a = other(subject.name, []);
  const b = a && other(subject.name, [a.name]);
  if (!a || !b) return null;
  // Every way a sentence could begin that the child can read and that fits; none, and it is a phrase.
  const leads = want === 'phrase' ? [] : LEADS.flatMap((lead) => arts.map((art) => [...lead.map(word), art]))
    .filter((ws): ws is Word[] => ws.every(Boolean) && tiles(ws as Word[]) + subject.word.graphemes.length <= most);
  const words = [...(leads.length ? any(leads) : [any(arts)]), subject.word];
  return {
    kind: 'read', key: key('read', subject.name),
    words: words.map((w) => onTiles(w, ctx)),
    target: { thing: subject.name },
    choices: shuffle([subject, a, b], ctx.rng).map((t) => ({ thing: t.name })),
    skills: shapes([subject.word]), supports: used(words),
  };
}
