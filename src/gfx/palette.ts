// All colour in the game comes from this file. No image textures.

export interface ScenePalette {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  cloud: string;
  cloudShade: string;
  /** The three light bands. Shade is a colour, never a darkening. */
  light: string;
  mid: string;
  shade: string;
  /** Grade: pulls the frame toward one hue family. */
  tint: string;
  tintAmt: number;
  lift: number;
  wash: string;
  outline: string;
  water: string;
  foam: string;
}

export const PALETTES = {
  goldenNoon: {
    skyTop: '#e6d9b8', skyMid: '#eee3c7', skyHorizon: '#f5edd9',
    cloud: '#fffbf2', cloudShade: '#efe4cd',
    light: '#fff8e6', mid: '#e8d8b8', shade: '#bca894',
    tint: '#b3a36c', tintAmt: 0.34, lift: 0.05, wash: '#e7dbbd',
    outline: '#402c20', water: '#9fb8ae', foam: '#f2efe6',
  },
  mintMorning: {
    skyTop: '#cfded2', skyMid: '#dfe8d6', skyHorizon: '#f3efdc',
    cloud: '#fdfbf3', cloudShade: '#dde6d6',
    light: '#fffaf0', mid: '#dde4cf', shade: '#a9b7ac',
    tint: '#93ab8f', tintAmt: 0.4, lift: 0.07, wash: '#e3e8d6',
    outline: '#3d302c', water: '#96b5b0', foam: '#f2f1e8',
  },
} satisfies Record<string, ScenePalette>;

/** Base surface colours, before lighting and grade. */
export const C = {
  grass: '#b9b56e',
  grassDark: '#a5a262',
  sand: '#e2cfa3',
  path: '#d8c197',
  rock: '#b8a39c',
  rockDark: '#8f7c78',
  foliage: '#6f7a45',
  foliageLight: '#86904f',
  bush: '#75783f',
  trunk: '#7a5244',
  flower: '#fbf6ec',
  buttercup: '#f0d25a',
  harebell: '#9ea6e0',
  cutWood: '#e9cf9c',
  // UI and painted features
  ink: '#4a2e36',
  faceInk: '#2e1f28',
  parchment: '#fbf3e4',
  parchmentEdge: '#ead9bd',
  eyeWhite: '#fffdf8',
  blush: '#ef9c93',
  /** The one glow colour. It means "touch this now" and the companion. Nothing else. */
  glow: '#ffd27a',
  amber: '#f4a455',
} as const;
