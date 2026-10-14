import * as THREE from 'three';
import type { ToonMaterial } from '../gfx/materials';
import { Spring } from './spring';

// How much of a creature has its colour, and the waking that brings the rest of it back.

/** Waking: how long the colour sinks back before it bursts out, unless told to hold it longer. */
export const WAKE_DIP = 0.5;

export class Colour {
  /**
   * How much of it has its colour, from the feet up. 1 is wide awake, as at home;
   * 0 is dormant, as they all are far from it.
   */
  colour = 1;
  /** Seconds left of the bracing before a burst, or -1 when not waking; the body crouches and shivers while it runs. */
  waking = -1;
  wakeFor = WAKE_DIP;
  private now = new Spring(1);
  private dip = 0;
  private flash = 0;
  private woke: (() => void) | null = null;

  /** Set how much colour it has at once, with no rise. */
  set(k: number): void {
    this.colour = this.now.x = k;
    this.now.v = 0;
  }

  /** Brace for `hold` seconds, then burst; `woke` is called at the burst. */
  wake(hold: number, woke?: () => void): void {
    if (this.waking >= 0) return;
    this.waking = this.wakeFor = hold;
    this.woke = woke ?? null;
  }

  /** `burst` is called at the burst, after the colour is back and before `woke`. */
  step(dt: number, root: THREE.Group, height: number, mats: ToonMaterial[], burst: () => void): void {
    if (this.waking >= 0) {
      this.waking -= dt;
      this.dip = Math.min(1, this.dip + dt / (this.wakeFor * 0.6));
      if (this.waking < 0) {
        this.set(1);
        this.dip = 0;
        this.flash = 1;
        burst();
        this.woke?.();
      }
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    const k = this.now.step(this.colour, 120, 14, dt);
    // The line starts under the feet and ends clear of the ear tips.
    const line = root.position.y + (k * 1.1 - 0.05) * height * root.scale.y;
    for (const m of mats) m.uniforms.uDorm.value.set(line, this.colour >= 1 ? 0 : 1, this.dip, this.flash);
  }
}
