// What is drawn where on the chart. Each island of the curriculum has a sheet
// of its own: home, and every area there will be on that island, found or not.

/**
 * Everything on a sheet for one layout, as fractions of the sheet's half-width and half-depth
 * (so -1,-1 is the far left corner): home, each area's island in order as [x, z, size while it is
 * still blank], the compass, and the little wave marks. `isle` is the size of home and of a found
 * island: every one of them has to fit at that size, and lie far enough from home for a line to
 * be drawn between them. `box` is what has to fit on screen, and `tilt` how steeply we look down
 * on the sheet, in degrees.
 */
export interface SheetLayout {
  size: [number, number];
  isle: number;
  home: [number, number];
  box: [number, number];
  tilt: number;
  areas: Array<[number, number, number]>;
  compass: [number, number];
  waves: Array<[number, number]>;
}

export interface Sheet {
  /** The outline of each area's island, found or not, in the order the areas come. */
  seeds: number[];
  wide: SheetLayout;
  tall: SheetLayout;
}

const WIDE = { size: [10.4, 5.5], home: [-0.66, 0.28], box: [11.2, 5.3], tilt: 68, compass: [-0.8, -0.58] } satisfies Partial<SheetLayout>;
const TALL = { size: [4.7, 8.0], home: [-0.3, 0.72], box: [5.0, 7.9], tilt: 74, compass: [0.56, 0.74] } satisfies Partial<SheetLayout>;

/** By the id of the island in the curriculum. */
export const SHEETS: Record<string, Sheet> = {
  // Four islands, each further from home than the last.
  i1: {
    seeds: [2.6, 3.1, 5.4, 0.6],
    wide: {
      ...WIDE, isle: 0.8,
      areas: [[0.17, -0.4, 0.6], [0.72, 0.42, 0.62], [0.74, -0.45, 0.48], [0.23, 0.44, 0.5]],
      waves: [[-0.3, 0.72], [-0.08, -0.84], [-0.42, -0.3], [0.5, -0.82], [0.9, -0.06], [-0.9, 0.82]],
    },
    tall: {
      ...TALL, isle: 0.56,
      areas: [[0.3, -0.08, 0.5], [-0.42, -0.27, 0.5], [0.4, -0.5, 0.4], [-0.36, -0.74, 0.36]],
      waves: [[0.5, 0.36], [-0.7, 0.4], [0.5, -0.86], [-0.74, -0.52], [0.74, -0.2], [0.1, 0.92]],
    },
  },
  // New waters: one island so far, a long way out.
  i2: {
    seeds: [4.0],
    wide: {
      ...WIDE, isle: 0.9,
      areas: [[0.52, -0.2, 0.6]],
      waves: [[-0.3, 0.72], [0.38, 0.66], [-0.36, -0.36], [0.2, -0.82], [0.9, 0.3], [-0.9, 0.82]],
    },
    tall: {
      ...TALL, isle: 0.68,
      areas: [[0.22, -0.42, 0.5]],
      waves: [[0.5, 0.36], [-0.7, 0.4], [-0.2, -0.84], [0.7, -0.74], [-0.72, -0.5], [0.1, 0.92]],
    },
  },
};
