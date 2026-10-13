import type { LayoutMode } from '../stage/framing';
import { SHORE } from './chartIsles';

// What is drawn where on the chart. There is one chart: home at one end, and
// every island the curriculum lists, found or not, winding away from it across
// the sea. Nothing is placed by hand: the sheet is cut into as many spots as there
// are islands, and each island strays about inside its own, so they never line up
// and a new island only gives the others a little less sea.

/**
 * Everything on the sheet for one layout, in the sheet's own units from its middle: home, each island
 * in order, the compass and the little wave marks. `isle` is the size home and a found island are drawn
 * at, and `marks` the size of the compass and waves beside what they are on a roomy sheet. `box` is what
 * has to fit on screen, and `tilt` how steeply we look down on the sheet, in degrees.
 */
export interface SheetLayout {
  size: [number, number];
  box: [number, number];
  tilt: number;
  isle: number;
  marks: number;
  home: [number, number];
  areas: Array<[number, number]>;
  compass: [number, number];
  waves: Array<[number, number]>;
}

const PAPER = {
  wide: { size: [10.4, 5.5], box: [11.2, 5.3], tilt: 68 },
  tall: { size: [4.7, 8.0], box: [5.0, 7.9], tilt: 74 },
} satisfies Record<LayoutMode, Pick<SheetLayout, 'size' | 'box' | 'tilt'>>;

/** Clear paper inside the edge, and how many spots' worth of the sheet's length home keeps to itself. */
const EDGE = 0.45;
const HOME_ROOM = 2;
/**
 * How far across its spot an island's shore reaches from its middle, and the furthest it ever reaches
 * however few islands there are: there will be dozens, and the chart is mostly sea from the start.
 */
const FILL = 0.22;
const BIGGEST = 0.36;
/** How much of the sea left in its spot an island strays into, away from the middle. */
const STRAY = 0.95;
const WAVES = 10;

/** The same scatter every time: -1 to 1 for each `n`. */
const scatter = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

/** The sheet for `count` islands. Home is at the left of a wide sheet and the bottom of a tall one. */
export function sheetLayout(mode: LayoutMode, count: number): SheetLayout {
  const paper = PAPER[mode];
  const tall = mode === 'tall';
  const long = paper.size[tall ? 1 : 0] - 2 * EDGE;
  const short = paper.size[tall ? 0 : 1] - 2 * EDGE;
  // As many islands abreast as leaves each the biggest spot.
  let rows = 1;
  let cell = 0;
  for (let r = 1; r <= count; r++) {
    const c = Math.min(short / r, long / (Math.ceil(count / r) + HOME_ROOM));
    if (c > cell + 1e-9) [rows, cell] = [r, c];
  }
  const cols = Math.ceil(count / rows);
  const first = -long / 2 + HOME_ROOM * cell;
  const [colStep, rowStep] = [(long / 2 - first) / cols, short / rows];
  /** Home's side of the sheet: toward the viewer on a wide one, the left on a tall one. */
  const side = tall ? -1 : 1;
  /** `along` runs away from home, `across` toward home's side. */
  const at = (along: number, across: number): [number, number] => (tall ? [side * across, -along] : [along, side * across]);
  const shore = Math.min(FILL * cell, BIGGEST);
  // Two neighbours that both stray as far as they can toward each other still have sea between them.
  const [strayAlong, strayAcross] = [STRAY * (colStep / 2 - shore), STRAY * (rowStep / 2 - shore)];

  const areas = Array.from({ length: count }, (_, i) => {
    const col = Math.floor(i / rows);
    // Each row sets off from where the last one ended.
    const row = col % 2 ? rows - 1 - (i % rows) : i % rows;
    return at(first + (col + 0.5) * colStep + scatter(i + 1) * strayAlong, ((rows - 1) / 2 - row) * rowStep + scatter(i + 7.3) * strayAcross);
  });
  // Waves are drawn where four spots meet, which no island strays as far as.
  const corners: Array<[number, number]> = [];
  for (let c = 0; c < cols; c++) for (let r = 1; r < rows; r++) {
    const n = c * 31 + r;
    corners.push(at(first + c * colStep + scatter(n + 0.4) * 0.25 * shore, (rows / 2 - r) * rowStep + scatter(n + 0.9) * 0.25 * shore));
  }
  // Any few of them, not a line of them.
  const some = corners.map((c, i) => [scatter(i + 3.1), c] as const).sort((a, b) => a[0] - b[0]).slice(0, WAVES).map(([, c]) => c);

  return {
    ...paper,
    isle: shore / SHORE,
    marks: Math.min(0.5, cell / 1.9),
    home: at(-long / 2 + 0.6 * cell, short * 0.22),
    areas,
    compass: at(-long / 2 + 0.6 * cell, -short * 0.27),
    waves: some,
  };
}
