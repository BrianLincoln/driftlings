import type { Quality } from '../gfx/post';

// Adaptive quality, with the reference project's phone lesson built in: iOS
// caps animation frames at 30 fps in Low Power Mode, and that must not be
// mistaken for a slow GPU. So "slow" means clearly under 30, and only after two
// slow 1.5 s windows in a row. It only steps down; a reload restores full quality.

/**
 * Render pixels per CSS pixel. Only the device ratio or half of it: any other
 * factor makes the browser resample the canvas unevenly, which turns thin
 * outlines into dotted ones (seen at 2x on a 3x phone). Letters are DOM and
 * stay at native resolution whatever this returns.
 */
export function renderScale(dpr: number, cssPixels: number, quality: Quality): number {
  const full = Math.min(dpr, 3);
  const half = Math.max(1, full / 2);
  if (quality === 'low') return half;
  return cssPixels * full * full > 9e6 ? half : full;
}

const WINDOW = 1.5;
const SLOW_FPS = 26;

export class QualityGovernor {
  private t = 0;
  private frames = 0;
  private slowWindows = 0;
  quality: Quality = 'high';
  locked = false;

  /** Returns true when the tier changed. Pass real elapsed seconds. */
  frame(realDt: number): boolean {
    if (this.locked || this.quality === 'low') return false;
    if (realDt > 0.5) return false; // a hitch or a hidden tab, not a slow device
    this.t += realDt;
    this.frames++;
    if (this.t < WINDOW) return false;
    const fps = this.frames / this.t;
    this.t = 0;
    this.frames = 0;
    this.slowWindows = fps < SLOW_FPS ? this.slowWindows + 1 : 0;
    if (this.slowWindows < 2) return false;
    this.quality = 'low';
    return true;
  }
}
