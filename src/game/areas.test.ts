import { describe, expect, it } from 'vitest';
import { AREAS } from '../learn/curriculum';
import { SHORE } from '../scenes/chartIsles';
import { SEA, placeInSea, seaOf, sheetLayout } from '../scenes/chartSheets';
import { PLACES } from '../scenes/places';
import { BIG_ONES, OPEN_AREAS, frontier, lessonsOf } from './areas';

const all = (ids: string[]) => new Set(ids.flatMap((id) => AREAS.find((a) => a.id === id)!.nodes.map((n) => n.id)));

describe('areas', () => {
  it('opens areas in curriculum order with no gaps', () => {
    expect(OPEN_AREAS.length).toBeGreaterThanOrEqual(2);
    expect(OPEN_AREAS).toEqual(AREAS.slice(0, OPEN_AREAS.length));
  });

  it('gives every open area a place, and the place a stone position for every lesson', () => {
    for (const a of OPEN_AREAS) {
      const place = PLACES[a.id];
      expect(place, a.id).toBeDefined();
      expect(place.wideZ.length, a.id).toBeGreaterThanOrEqual(lessonsOf(a).length);
      expect(place.tallX.length, a.id).toBeGreaterThanOrEqual(lessonsOf(a).length);
    }
    expect(Object.keys(PLACES).sort()).toEqual(Object.keys(BIG_ONES).sort());
  });

  it('draws every island on its sea\'s sheet clear of the others and of the edge, with room for a line from home, however many there are', () => {
    const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const sizes = new Set<string>();
    for (const total of [1, 2, AREAS.length, SEA, SEA + 1, 12, 43, 60]) for (const mode of ['wide', 'tall'] as const) {
      const sheets = Array.from({ length: seaOf(total - 1) + 1 }, (_, sea) => sheetLayout(mode, sea, Math.min(SEA, total - sea * SEA)));
      expect(sheets.reduce((n, s) => n + s.areas.length, 0)).toBe(total);
      sheets.forEach((s, sea) => {
        const r = SHORE * s.isle;
        sizes.add(`${mode} ${s.isle}`);
        [s.home, ...s.areas].forEach((a, i, all) => {
          const tag = `${total} ${mode} sea ${sea} ${i}`;
          expect(Math.abs(a[0]) + r, tag).toBeLessThanOrEqual(s.size[0] / 2 - 0.3);
          expect(Math.abs(a[1]) + r, tag).toBeLessThanOrEqual(s.size[1] / 2 - 0.3);
          for (const b of all.slice(0, i)) expect(gap(a, b), tag).toBeGreaterThan(2 * r);
          // The line stops a little off each shore, and the toy ship (about 1.3 times `isle` long) needs that much of it to sail.
          if (i > 0) expect(gap(a, s.home), `${tag} from home`).toBeGreaterThan(2 * r + 2.4 * s.isle);
        });
        for (const w of [s.compass, ...s.waves]) for (const a of [s.home, ...s.areas]) expect(gap(w, a), `${total} ${mode} marks`).toBeGreaterThan(r);
      });
    }
    // Islands are one size on every sheet of a layout, whatever the total.
    expect(sizes.size).toBe(2);
  });

  it('never moves an island on the chart when the curriculum grows, and scatters each sea its own way', () => {
    for (const mode of ['wide', 'tall'] as const) {
      const spot = (index: number, total: number) => {
        const sea = seaOf(index);
        return sheetLayout(mode, sea, Math.min(SEA, total - sea * SEA)).areas[placeInSea(index)];
      };
      for (let i = 0; i < 20; i++) for (const total of [i + 1, i + 2, 43, 60]) expect(spot(i, total), `${mode} ${i} of ${total}`).toEqual(spot(i, 20));
      expect(sheetLayout(mode, 1).areas).not.toEqual(sheetLayout(mode, 0).areas);
      expect(sheetLayout(mode, 1).home).toEqual(sheetLayout(mode, 0).home);
    }
  });

  it('gives each area a big one unlike the others', () => {
    const seen = new Set(OPEN_AREAS.map((a) => `${BIG_ONES[a.id].who.species.id}/${BIG_ONES[a.id].who.coat.id}`));
    expect(seen.size).toBe(OPEN_AREAS.length);
  });

  it('sails for the first area not finished, and stays at the last once they all are', () => {
    expect(frontier(new Set()).id).toBe('i1a1');
    expect(frontier(new Set(['i1a1-a', 'i1a1-m'])).id).toBe('i1a1');
    expect(frontier(all(['i1a1'])).id).toBe('i1a2');
    expect(frontier(new Set([...all(['i1a1']), 'i1a2-p'])).id).toBe('i1a2');
    expect(frontier(all(OPEN_AREAS.map((a) => a.id))).id).toBe(OPEN_AREAS[OPEN_AREAS.length - 1].id);
  });
});
