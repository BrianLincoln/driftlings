import * as THREE from 'three';
import { capsule, ellipsoid, hash, lathe, merge, paint, place, puff } from '../gfx/geo';
import type { FaceLook } from '../gfx/face';
import type { BodyShape, Coat, Species } from './species';

// Geometry recipes for creature parts. Built once per species+coat and shared.

export interface CreatureGeo {
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  /** One ear, pivoting at its base and pointing up. Null if the species has none. */
  ear: THREE.BufferGeometry | null;
  earPivot: THREE.Vector3;
  /** Outward lean of each ear at rest, radians. */
  earLean: number;
  headY: number;
  face: FaceLook;
}

const PROFILES: Record<BodyShape, { pts: Array<[number, number]>; top: number; wide: number }> = {
  pear: { pts: [[0, 0.02], [0.2, 0.03], [0.27, 0.16], [0.25, 0.32], [0.17, 0.44], [0, 0.5]], top: 0.5, wide: 0.27 },
  round: { pts: [[0, 0.02], [0.22, 0.04], [0.3, 0.2], [0.27, 0.36], [0.15, 0.46], [0, 0.5]], top: 0.5, wide: 0.3 },
  tall: { pts: [[0, 0.02], [0.16, 0.03], [0.21, 0.2], [0.2, 0.45], [0.14, 0.6], [0, 0.66]], top: 0.66, wide: 0.21 },
  squat: { pts: [[0, 0.02], [0.26, 0.03], [0.34, 0.15], [0.29, 0.29], [0.15, 0.36], [0, 0.39]], top: 0.39, wide: 0.34 },
};

const cache = new Map<string, CreatureGeo>();

export function creatureGeo(s: Species, c: Coat): CreatureGeo {
  const key = `${s.id}/${c.id}`;
  let g = cache.get(key);
  if (!g) cache.set(key, (g = build(s, c)));
  return g;
}

function build(s: Species, c: Coat): CreatureGeo {
  const prof = PROFILES[s.body];
  const w = prof.wide;
  const mid = prof.top * 0.5;

  // Coat pattern on the back and sides; the belly stays clean.
  const coatAt = (p: THREE.Vector3, n: THREE.Vector3): string => {
    if (n.z > 0.45 && p.y < prof.top * 0.8) return c.belly;
    if (c.pattern === 'stripes' && n.z < 0.2 && Math.sin(p.y * 34) > 0.35) return c.accent;
    if (c.pattern === 'spots' && n.z < 0.3 && hash(Math.round(p.y * 14) * 7 + Math.round(Math.atan2(p.x, p.z) * 3)) > 0.72) return c.accent;
    return c.coat;
  };

  const parts: THREE.BufferGeometry[] = [
    lathe(prof.pts, coatAt),
    place(ellipsoid(0.09, 0.05, 0.13, c.accent), [w * 0.5, 0.04, w * 0.5]),
    place(ellipsoid(0.09, 0.05, 0.13, c.accent), [-w * 0.5, 0.04, w * 0.5]),
  ];
  for (const side of [-1, 1]) {
    if (s.arms === 'nub') parts.push(place(ellipsoid(0.06, 0.11, 0.06, c.coat), [side * (w - 0.02), mid, 0.04], [0, 0, side * 0.5]));
    if (s.arms === 'flipper') parts.push(place(ellipsoid(0.05, 0.15, 0.09, c.accent), [side * (w + 0.02), mid, 0.02], [0, 0, side * 0.85]));
    if (s.arms === 'wing') parts.push(place(ellipsoid(0.04, 0.2, 0.13, c.accent), [side * (w + 0.01), mid + 0.02, -0.02], [0.2, 0, side * 0.35]));
  }
  if (s.tail === 'pom') parts.push(place(ellipsoid(0.09, 0.09, 0.09, c.belly), [0, 0.15, -w]));
  if (s.tail === 'bush') parts.push(place(puff(0.17, c.accent, 5, 0.2, 16), [0, 0.2, -w - 0.08]));
  if (s.tail === 'fin') parts.push(place(ellipsoid(0.03, 0.13, 0.15, c.accent), [0, 0.2, -w - 0.06], [0.5, 0, 0]));
  if (s.tail === 'long') {
    for (let i = 0; i < 5; i++) {
      const r = 0.055 - i * 0.007;
      parts.push(place(ellipsoid(r, r, r, i === 4 ? c.belly : c.coat), [0.03 * i, 0.08 + i * i * 0.022, -w - 0.03 - i * 0.065]));
    }
  }

  const [hx, hy, hz] = s.head;
  const headParts: THREE.BufferGeometry[] = [
    ellipsoid(hx, hy, hz, (p, n) => (s.muzzle && n.z > 0.5 && p.y < -0.12 ? c.belly : c.coat), 40),
  ];
  if (s.crest === 'sprig') {
    headParts.push(place(ellipsoid(0.035, 0.09, 0.02, c.crest), [0.045, hy + 0.04, 0], [0, 0, -0.6]));
    headParts.push(place(ellipsoid(0.03, 0.07, 0.02, c.crest), [-0.035, hy + 0.03, 0], [0, 0, 0.7]));
  }
  if (s.crest === 'tuft') {
    for (const [x, rz, len] of [[-0.05, 0.5, 0.07], [0, 0, 0.1], [0.05, -0.5, 0.07]]) {
      headParts.push(place(ellipsoid(0.035, len, 0.035, c.coat), [x, hy + len * 0.5, 0], [0, 0, rz]));
    }
  }
  if (s.crest === 'spikes') {
    for (let i = 0; i < 3; i++) {
      const cone = paint(new THREE.ConeGeometry(0.05 - i * 0.008, 0.11 - i * 0.02, 14), c.crest);
      headParts.push(place(cone, [0, hy * (0.98 - i * 0.14) + 0.03, -i * hz * 0.42], [-i * 0.5, 0, 0]));
    }
  }

  let ear: THREE.BufferGeometry | null = null;
  let earLean = 0.55;
  const inner = (_p: THREE.Vector3, n: THREE.Vector3) => (n.z > 0.5 ? c.belly : c.accent);
  const k = s.earScale;
  if (s.ears === 'long') ear = place(ellipsoid(0.075, 0.19 * k, 0.04, inner), [0, 0.16 * k, 0]);
  if (s.ears === 'round') { ear = place(ellipsoid(0.1 * k, 0.1 * k, 0.04, inner), [0, 0.06 * k, 0]); earLean = 0.35; }
  if (s.ears === 'point') { ear = place(paint(new THREE.ConeGeometry(0.095 * k, 0.2 * k, 18), inner), [0, 0.08 * k, 0]); earLean = 0.3; }
  if (s.ears === 'flop') { ear = place(ellipsoid(0.07, 0.2 * k, 0.045, inner), [0, 0.17 * k, 0]); earLean = 2.25; }
  if (s.ears === 'antenna') {
    ear = merge(place(capsule(0.014, 0.16 * k, c.accent), [0, 0.1 * k, 0]), place(ellipsoid(0.04, 0.04, 0.04, c.crest), [0, 0.21 * k, 0]));
    earLean = 0.3;
  }

  const [ex, ey, es] = s.eyes;
  return {
    body: merge(...parts),
    head: merge(...headParts),
    ear,
    earPivot: new THREE.Vector3(hx * 0.62, hy * (s.ears === 'flop' ? 0.45 : 0.62), -0.02),
    earLean,
    headY: prof.top + hy * 0.28,
    face: {
      origin: [0, 0, 0],
      eye: [ex, ey, 0.215 * es, 0.28 * es],
      pupil: [0.13 * es, 0.17 * es, 0.07, 0.07],
      mouth: [ey - 0.44, 0.12],
      blush: [ex + 0.28, ey - 0.28, 0.13],
    },
  };
}
