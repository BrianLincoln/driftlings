import { describe, expect, it } from 'vitest';
import { ISLANDS } from '../learn/curriculum';
import { SHEETS } from '../scenes/chartSheets';
import { PLACES } from '../scenes/places';
import { BIG_ONES, OPEN_AREAS, frontier, lessonsOf, watersOf } from './areas';

const AREAS = ISLANDS.flatMap((i) => i.areas);
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

  it('has a sheet of the chart for every island, with room for every area there will be', () => {
    for (const island of ISLANDS) {
      const sheet = SHEETS[island.id];
      expect(sheet, island.id).toBeDefined();
      for (const part of [sheet.seeds, sheet.wide.areas, sheet.tall.areas]) expect(part.length, island.id).toBe(island.areas.length);
      expect(sheet.tall.waves.length).toBe(sheet.wide.waves.length);
    }
  });

  it('draws a found island clear of the others and of the sheet\'s edge, and far enough from home for a line between', () => {
    for (const [id, sheet] of Object.entries(SHEETS)) for (const mode of ['wide', 'tall'] as const) {
      const s = sheet[mode];
      const at = ([u, v]: number[]) => [(u * s.size[0]) / 2, (v * s.size[1]) / 2];
      const r = 1.25 * s.isle;
      const gap = (a: number[], b: number[]) => Math.hypot(at(a)[0] - at(b)[0], at(a)[1] - at(b)[1]);
      s.areas.forEach((a, i) => {
        const [x, z] = at(a);
        expect(Math.abs(x) + r, `${id} ${mode} ${i}`).toBeLessThanOrEqual(s.size[0] / 2);
        expect(Math.abs(z) + r, `${id} ${mode} ${i}`).toBeLessThanOrEqual(s.size[1] / 2);
        expect(gap(a, s.home), `${id} ${mode} ${i} from home`).toBeGreaterThan(2 * (r + 0.6) + 0.5);
        for (const b of s.areas.slice(0, i)) expect(gap(a, b), `${id} ${mode} ${i}`).toBeGreaterThan(2 * r);
      });
    }
  });

  it('keeps each island to its own sheet', () => {
    for (const a of OPEN_AREAS) {
      const w = watersOf(a);
      expect(w.island.areas).toContain(a);
      expect(w.areas[w.isle]).toBe(a);
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
