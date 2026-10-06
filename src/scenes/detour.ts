// Getting from one spot to another on foot without walking through things.
// Everything in the way is a circle; where the straight line crosses one, the
// route steps out to its near side and carries on from there.

export interface Spot {
  x: number;
  z: number;
}

export interface Blocker extends Spot {
  /** How wide a berth to give it, the walker's own width included. */
  r: number;
}

const CLEAR = 0.15;

/** The spots to pass through, in order, ending with `to`. */
export function routeAround(from: Spot, to: Spot, blockers: readonly Blocker[], depth = 4): Spot[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (depth <= 0 || len < 1e-3) return [to];
  let first: { b: Blocker; t: number; px: number; pz: number } | null = null;
  for (const b of blockers) {
    // Standing inside one already, or headed into one: nothing to go round.
    if (Math.hypot(from.x - b.x, from.z - b.z) < b.r || Math.hypot(to.x - b.x, to.z - b.z) < b.r) continue;
    const t = ((b.x - from.x) * dx + (b.z - from.z) * dz) / (len * len);
    if (t <= 0 || t >= 1 || (first && t >= first.t)) continue;
    const px = from.x + dx * t;
    const pz = from.z + dz * t;
    if (Math.hypot(px - b.x, pz - b.z) < b.r) first = { b, t, px, pz };
  }
  if (!first) return [to];
  let nx = first.px - first.b.x;
  let nz = first.pz - first.b.z;
  let d = Math.hypot(nx, nz);
  if (d < 1e-4) [nx, nz, d] = [-dz / len, dx / len, 1]; // dead centre: either side will do
  const out = first.b.r + CLEAR;
  const by = { x: first.b.x + (nx / d) * out, z: first.b.z + (nz / d) * out };
  return [...routeAround(from, by, blockers, depth - 1), ...routeAround(by, to, blockers, depth - 1)];
}

/** Ground for one bound through the air from `from` to `to`, `height` high at its top: the way across where there is no walking. */
export function bound(from: Spot & { y: number }, to: Spot & { y: number }, height: number): (x: number, z: number) => number {
  const [fx, fy, fz, ty] = [from.x, from.y, from.z, to.y];
  const far = Math.max(1e-3, Math.hypot(to.x - fx, to.z - fz));
  return (x, z) => {
    const k = Math.min(1, Math.max(0, Math.hypot(x - fx, z - fz) / far));
    return fy + (ty - fy) * k + Math.sin(k * Math.PI) * height;
  };
}
