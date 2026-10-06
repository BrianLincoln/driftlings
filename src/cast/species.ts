// A rescued creature is a SPECIES (which parts, what proportions) plus a COAT
// (colours and pattern). Parts are shared recipes, so a new species is a few
// lines of data and a hundred rescues do not need a hundred designs.

export type BodyShape = 'pear' | 'round' | 'tall' | 'squat';
export type EarKind = 'long' | 'round' | 'point' | 'flop' | 'antenna' | 'none';
export type TailKind = 'pom' | 'long' | 'bush' | 'fin' | 'none';
export type CrestKind = 'sprig' | 'tuft' | 'spikes' | 'none';
export type ArmKind = 'nub' | 'flipper' | 'wing' | 'none';
export type Pattern = 'plain' | 'stripes' | 'spots';

export interface Species {
  id: string;
  body: BodyShape;
  /** Head half-sizes. */
  head: [number, number, number];
  ears: EarKind;
  earScale: number;
  tail: TailKind;
  crest: CrestKind;
  arms: ArmKind;
  /** A pale patch on the lower face. */
  muzzle: boolean;
  /** Eye spacing (yaw, radians), eye height (pitch), eye size multiplier. */
  eyes: [number, number, number];
  size: number;
}

export interface Coat {
  id: string;
  coat: string;
  belly: string;
  accent: string;
  crest: string;
  pattern: Pattern;
}

const sp = (id: string, s: Omit<Species, 'id'>): Species => ({ id, ...s });

export const SPECIES: Species[] = [
  sp('sprout', { body: 'pear', head: [0.28, 0.24, 0.25], ears: 'long', earScale: 1, tail: 'pom', crest: 'sprig', arms: 'nub', muzzle: false, eyes: [0.38, 0.04, 1], size: 1 }),
  sp('cub', { body: 'squat', head: [0.3, 0.25, 0.26], ears: 'round', earScale: 1, tail: 'pom', crest: 'none', arms: 'nub', muzzle: true, eyes: [0.36, 0.06, 0.95], size: 1.1 }),
  sp('kit', { body: 'pear', head: [0.27, 0.23, 0.24], ears: 'point', earScale: 1, tail: 'long', crest: 'none', arms: 'nub', muzzle: true, eyes: [0.4, 0.05, 1], size: 0.95 }),
  sp('lop', { body: 'round', head: [0.27, 0.24, 0.25], ears: 'flop', earScale: 1.1, tail: 'bush', crest: 'tuft', arms: 'nub', muzzle: false, eyes: [0.37, 0.03, 1.05], size: 1.05 }),
  sp('finlet', { body: 'round', head: [0.26, 0.22, 0.25], ears: 'none', earScale: 1, tail: 'fin', crest: 'spikes', arms: 'flipper', muzzle: false, eyes: [0.44, 0.08, 1.1], size: 0.9 }),
  sp('stalk', { body: 'tall', head: [0.23, 0.21, 0.22], ears: 'antenna', earScale: 1, tail: 'none', crest: 'none', arms: 'nub', muzzle: false, eyes: [0.4, 0.06, 1.1], size: 1 }),
  sp('owlet', { body: 'round', head: [0.3, 0.25, 0.26], ears: 'point', earScale: 0.6, tail: 'fin', crest: 'tuft', arms: 'wing', muzzle: true, eyes: [0.34, 0.08, 1.25], size: 0.85 }),
  sp('mouse', { body: 'pear', head: [0.25, 0.22, 0.23], ears: 'round', earScale: 1.6, tail: 'long', crest: 'none', arms: 'nub', muzzle: false, eyes: [0.36, 0.02, 1], size: 0.75 }),
  sp('tusk', { body: 'squat', head: [0.33, 0.27, 0.28], ears: 'flop', earScale: 0.7, tail: 'none', crest: 'spikes', arms: 'nub', muzzle: true, eyes: [0.42, 0.1, 0.85], size: 1.3 }),
  sp('bean', { body: 'tall', head: [0.25, 0.22, 0.23], ears: 'long', earScale: 0.55, tail: 'bush', crest: 'sprig', arms: 'flipper', muzzle: false, eyes: [0.38, 0.05, 1], size: 0.9 }),
  sp('puff', { body: 'round', head: [0.31, 0.26, 0.27], ears: 'round', earScale: 0.7, tail: 'bush', crest: 'tuft', arms: 'none', muzzle: false, eyes: [0.36, 0.0, 1.15], size: 0.8 }),
  sp('glider', { body: 'squat', head: [0.26, 0.22, 0.24], ears: 'antenna', earScale: 0.8, tail: 'fin', crest: 'none', arms: 'wing', muzzle: false, eyes: [0.42, 0.06, 1.05], size: 1 }),
];

const ct = (id: string, coat: string, belly: string, accent: string, crest: string, pattern: Pattern = 'plain'): Coat =>
  ({ id, coat, belly, accent, crest, pattern });

// Muted, but each a clearly different hue so a crowd reads as a crowd.
export const COATS: Coat[] = [
  ct('apricot', '#e8b48a', '#f7e6cf', '#d99a78', '#8fa862'),
  ct('slate', '#a9b4c6', '#eef0ee', '#8e9ab2', '#d9b25c'),
  ct('moss', '#b7c08c', '#f3efd6', '#98a56f', '#e39a86'),
  ct('rose', '#e3a7a5', '#f8e7e0', '#c98886', '#f1d58a', 'spots'),
  ct('plum', '#b49cc0', '#efe6ee', '#9580a6', '#f0c26a'),
  ct('teal', '#8fc0b8', '#e9f3ec', '#73a59e', '#f0b48a', 'stripes'),
  ct('butter', '#ecd58e', '#fbf4dc', '#d6ba6e', '#9bb47a'),
  ct('cocoa', '#b9917c', '#f0dfcf', '#9c7764', '#e8c46a', 'stripes'),
  ct('sky', '#a8c8e0', '#f0f5f6', '#8aaccc', '#f3a9a0', 'spots'),
  ct('cream', '#f1e6d2', '#fffaf0', '#dcc7a8', '#c98f7a'),
];

export interface Rescue {
  species: Species;
  coat: Coat;
}

/** The n-th rescue: walks species and coats out of step so neighbours differ in both. */
export function rescue(n: number): Rescue {
  return { species: SPECIES[n % SPECIES.length], coat: COATS[(n * 3 + Math.floor(n / SPECIES.length)) % COATS.length] };
}
