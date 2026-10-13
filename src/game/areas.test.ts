import { describe, expect, it } from 'vitest';
import { AREAS } from '../learn/curriculum';
import { SHORE } from '../scenes/chartIsles';
import { sheetLayout } from '../scenes/chartSheets';
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

  it('draws every island on the one chart clear of the others and of the edge, with room for a line from home, however many there are', () => {
    for (const count of [1, 2, AREAS.length, 12, 43, 60]) for (const mode of ['wide', 'tall'] as const) {
      const s = sheetLayout(mode, count);
      const r = SHORE * s.isle;
      const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      expect(s.areas.length).toBe(count);
      [s.home, ...s.areas].forEach((a, i, all) => {
        const tag = `${count} ${mode} ${i}`;
        expect(Math.abs(a[0]) + r, tag).toBeLessThanOrEqual(s.size[0] / 2 - 0.3);
        expect(Math.abs(a[1]) + r, tag).toBeLessThanOrEqual(s.size[1] / 2 - 0.3);
        for (const b of all.slice(0, i)) expect(gap(a, b), tag).toBeGreaterThan(2 * r);
        // The line stops a little off each shore, and the toy ship (about 1.3 times `isle` long) needs that much of it to sail.
        if (i > 0) expect(gap(a, s.home), `${tag} from home`).toBeGreaterThan(2 * r + 2.4 * s.isle);
      });
      for (const w of [s.compass, ...s.waves]) for (const a of [s.home, ...s.areas]) expect(gap(w, a), `${count} ${mode} marks`).toBeGreaterThan(r);
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
