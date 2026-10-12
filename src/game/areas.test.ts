import { describe, expect, it } from 'vitest';
import { ISLAND_1 } from '../learn/curriculum';
import { CHART_SEEDS } from '../scenes/chartIsles';
import { PLACES } from '../scenes/places';
import { BIG_ONES, OPEN_AREAS, frontier, lessonsOf } from './areas';

const all = (ids: string[]) => new Set(ids.flatMap((id) => ISLAND_1.areas.find((a) => a.id === id)!.nodes.map((n) => n.id)));

describe('areas', () => {
  it('opens areas in curriculum order with no gaps', () => {
    expect(OPEN_AREAS.length).toBeGreaterThanOrEqual(2);
    expect(OPEN_AREAS).toEqual(ISLAND_1.areas.slice(0, OPEN_AREAS.length));
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

  it('has room on the chart for every area there will be', () => {
    expect(CHART_SEEDS.length).toBeGreaterThanOrEqual(ISLAND_1.areas.length);
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
