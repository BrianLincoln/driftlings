import { describe, expect, it } from 'vitest';
import { routeAround, type Blocker, type Spot } from './detour';

/** Closest the path comes to a blocker's centre. */
function nearest(path: Spot[], b: Blocker): number {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    for (let k = 0; k <= 50; k++) {
      const x = path[i].x + ((path[i + 1].x - path[i].x) * k) / 50;
      const z = path[i].z + ((path[i + 1].z - path[i].z) * k) / 50;
      best = Math.min(best, Math.hypot(x - b.x, z - b.z));
    }
  }
  return best;
}

describe('routeAround', () => {
  const from = { x: 0, z: 0 };
  const to = { x: 0, z: -8 };

  it('goes straight when nothing is in the way', () => {
    expect(routeAround(from, to, [{ x: 3, z: -4, r: 1 }])).toEqual([to]);
  });

  it('steps round what is in the way, on the nearer side', () => {
    const rock = { x: 0.3, z: -4, r: 1 };
    const route = routeAround(from, to, [rock]);
    expect(route.length).toBeGreaterThan(1);
    expect(route[0].x).toBeLessThan(0);
    expect(nearest([from, ...route], rock)).toBeGreaterThanOrEqual(rock.r - 1e-6);
    expect(route[route.length - 1]).toEqual(to);
  });

  it('clears several things in a row', () => {
    const things = [{ x: 0.2, z: -2, r: 0.8 }, { x: -0.3, z: -5, r: 0.9 }, { x: 0, z: -6.6, r: 0.5 }];
    const path = [from, ...routeAround(from, to, things)];
    for (const b of things) expect(nearest(path, b)).toBeGreaterThanOrEqual(b.r - 1e-6);
  });
});
