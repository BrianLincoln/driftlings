import { C } from '../gfx/palette';
import type { Rescue } from './species';

// A creature's head from the front, as a flat drawing, for places outside the 3D scene (the
// grown-ups' corner). It follows the recipes in creatureParts.ts and the face in gfx/face.ts
// part for part: change a head, an ear or a crest there and change it here.

/** Ink line weight, in the same units as the head. */
const LINE = 0.022;
const deg = (rad: number) => ((rad * 180) / Math.PI).toFixed(1);
const n = (v: number) => v.toFixed(3);

/** An SVG of the whole head, ears and crest included, fitted to a circle. */
export function portrait(who: Rescue): string {
  const { species: s, coat: c } = who;
  const [hx, hy, hz] = s.head;
  const k = s.earScale;
  /** Every point the drawing reaches, to fit the frame round. */
  const reach: Array<[number, number]> = [];
  const ink = `stroke="currentColor" stroke-width="${LINE}" stroke-linejoin="round" stroke-linecap="round"`;

  /** An ellipse at (x, y), turned `turn` radians about (px, py). */
  const oval = (x: number, y: number, rx: number, ry: number, fill: string, lined = true, px = 0, py = 0, turn = 0): string => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const [lx, ly] = [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
      reach.push([px + lx * Math.cos(turn) - ly * Math.sin(turn), py + lx * Math.sin(turn) + ly * Math.cos(turn)]);
    }
    return `<ellipse transform="translate(${n(px)} ${n(py)}) rotate(${deg(turn)})" cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" ${lined ? ink : ''}/>`;
  };
  /** A triangle standing on a base `wide` across at y, turned like an oval. */
  const spike = (y: number, wide: number, tall: number, fill: string, lined = true, px = 0, py = 0, turn = 0): string => {
    const pts: Array<[number, number]> = [[-wide, y], [wide, y], [0, y + tall]];
    for (const [lx, ly] of pts) reach.push([px + lx * Math.cos(turn) - ly * Math.sin(turn), py + lx * Math.sin(turn) + ly * Math.cos(turn)]);
    return `<path transform="translate(${n(px)} ${n(py)}) rotate(${deg(turn)})" d="M${pts.map((p) => `${n(p[0])} ${n(p[1])}`).join('L')}Z" fill="${fill}" ${lined ? ink : ''}/>`;
  };

  // Behind the head: ears and crest, their roots hidden by it.
  const behind: string[] = [];
  const [ex0, ey0] = [hx * 0.62, hy * (s.ears === 'flop' ? 0.45 : 0.62)];
  for (const side of [-1, 1]) {
    const px = side * ex0;
    const at = (lean: number) => [px, ey0, -side * lean] as const;
    if (s.ears === 'long') behind.push(oval(0, 0.16 * k, 0.075, 0.19 * k, c.accent, true, ...at(0.55)), oval(0, 0.16 * k, 0.05, 0.155 * k, c.belly, false, ...at(0.55)));
    if (s.ears === 'round') behind.push(oval(0, 0.06 * k, 0.1 * k, 0.1 * k, c.accent, true, ...at(0.35)), oval(0, 0.06 * k, 0.068 * k, 0.068 * k, c.belly, false, ...at(0.35)));
    if (s.ears === 'point') behind.push(spike(-0.02 * k, 0.095 * k, 0.2 * k, c.accent, true, ...at(0.3)), spike(-0.02 * k, 0.055 * k, 0.135 * k, c.belly, false, ...at(0.3)));
    if (s.ears === 'flop') behind.push(oval(0, 0.17 * k, 0.07, 0.2 * k, c.accent, true, ...at(2.25)), oval(0, 0.17 * k, 0.045, 0.165 * k, c.belly, false, ...at(2.25)));
    if (s.ears === 'antenna') {
      const turn = -side * 0.3;
      const tip = (len: number) => [px - Math.sin(turn) * len, ey0 + Math.cos(turn) * len];
      const [tx, ty] = tip(0.21 * k);
      behind.push(`<path d="M${n(px)} ${n(ey0)}L${n(tx)} ${n(ty)}" ${ink} stroke-width="${LINE * 2.4}"/>`,
        `<path d="M${n(px)} ${n(ey0)}L${n(tx)} ${n(ty)}" stroke="${c.accent}" stroke-width="${LINE * 1.1}" stroke-linecap="round"/>`,
        oval(tx, ty, 0.04, 0.04, c.crest));
    }
  }
  if (s.crest === 'sprig') behind.push(oval(0, 0, 0.035, 0.09, c.crest, true, 0.045, hy + 0.04, -0.6), oval(0, 0, 0.03, 0.07, c.crest, true, -0.035, hy + 0.03, 0.7));
  if (s.crest === 'tuft') {
    for (const [x, rz, len] of [[-0.05, 0.5, 0.07], [0.05, -0.5, 0.07], [0, 0, 0.1]]) behind.push(oval(0, 0, 0.035, len, c.coat, true, x, hy + len * 0.5, rz));
  }
  if (s.crest === 'spikes') behind.push(spike(hy * 0.98 - 0.025, 0.05, 0.11, c.crest));

  // Where a direction on the head (yaw, pitch) lands when seen from the front.
  const on = (yaw: number, pitch: number): [number, number] => {
    const d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const t = 1 / Math.hypot(d[0] / hx, d[1] / hy, d[2] / hz);
    return [d[0] * t, d[1] * t];
  };
  /** A patch of the face given as the shader has it, in angles: centre and half-size. */
  const patch = (yaw: number, pitch: number, w: number, h: number, fill: string, extra = ''): string => {
    const [l, r, b, t] = [on(yaw - w, pitch)[0], on(yaw + w, pitch)[0], on(yaw, pitch - h)[1], on(yaw, pitch + h)[1]];
    return `<ellipse cx="${n((l + r) / 2)}" cy="${n((b + t) / 2)}" rx="${n(Math.abs(r - l) / 2)}" ry="${n((t - b) / 2)}" fill="${fill}" ${extra}/>`;
  };

  const face: string[] = [];
  if (s.muzzle) {
    // The pale lower face: the front of the head below a line.
    const [a, b] = [hx * 0.86, hy * 0.86];
    const x = a * Math.sqrt(Math.max(0, 1 - (0.12 / b) ** 2));
    face.push(`<path d="M${n(-x)} -0.12A${n(a)} ${n(b)} 0 0 1 ${n(x)} -0.12Z" fill="${c.belly}"/>`);
  }
  const [yaw, pitch, es] = s.eyes;
  const [pw, ph] = [0.13 * es, 0.17 * es];
  for (const side of [-1, 1]) {
    face.push(
      patch(side * (yaw + 0.28), pitch - 0.28, 0.13 / 0.8, 0.13 / 1.3, C.blush, 'opacity="0.5"'),
      patch(side * yaw, pitch, 0.215 * es, 0.28 * es, C.eyeWhite, `stroke="${C.faceInk}" stroke-width="${LINE * 0.8}"`),
      patch(side * yaw, pitch, pw, ph, C.faceInk),
      patch(side * yaw - 0.32 * pw, pitch + 0.36 * ph, pw * 0.3, pw * 0.3, C.eyeWhite),
    );
  }
  const mouthAt = pitch - 0.44;
  const [mx, my] = on(0.12, mouthAt);
  face.push(`<path d="M${n(-mx)} ${n(my)}Q0 ${n(on(0, mouthAt - 0.06)[1])} ${n(mx)} ${n(my)}" fill="none" stroke="${C.faceInk}" stroke-width="${LINE * 0.9}" stroke-linecap="round"/>`);

  const head = oval(0, 0, hx, hy, c.coat);
  // The smallest circle about the middle of the drawing that holds all of it, and the line round it.
  const xs = reach.map((p) => p[0]);
  const ys = reach.map((p) => p[1]);
  const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const r = Math.max(...reach.map((p) => Math.hypot(p[0] - cx, p[1] - cy))) + LINE;
  // Drawn with y up, as the creature is built, and flipped once here.
  return `<svg viewBox="${n(cx - r)} ${n(-cy - r)} ${n(r * 2)} ${n(r * 2)}"><g transform="scale(1 -1)">${behind.join('')}${head}${face.join('')}</g></svg>`;
}
