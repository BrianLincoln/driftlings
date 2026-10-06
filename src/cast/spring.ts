/** A damped spring. Used for squash and stretch, arms, ears, lean: everything secondary. */
export class Spring {
  v = 0;
  constructor(public x = 0) {}

  step(target: number, k: number, c: number, dt: number): number {
    this.v += (k * (target - this.x) - c * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  }

  kick(v: number): void {
    this.v += v;
  }
}

/** Frame-rate independent follow. */
export function ease(x: number, target: number, rate: number, dt: number): number {
  return x + (target - x) * (1 - Math.exp(-rate * dt));
}

/** Volume-preserving squash: sy > 1 stretches up, sy < 1 squashes down. */
export function squash(obj: { scale: { set(x: number, y: number, z: number): unknown } }, sy: number, base = 1): void {
  const s = Math.max(0.4, sy);
  const side = 1 / Math.sqrt(s);
  obj.scale.set(side * base, s * base, side * base);
}

/** Random blinks every 1.6 to 4.8 s lasting 0.12 s. Returns lid openness. */
export class Blinker {
  private next = 1 + Math.random() * 3;
  private t = 0;

  step(dt: number): number {
    this.t += dt;
    if (this.t > this.next + 0.12) {
      this.t = 0;
      this.next = 1.6 + Math.random() * 3.2;
    }
    return this.t > this.next ? 0.05 : 1;
  }
}
