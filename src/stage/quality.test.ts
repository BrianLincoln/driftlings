import { describe, expect, it } from 'vitest';
import { QualityGovernor, renderScale } from './quality';

function run(g: QualityGovernor, fps: number, seconds: number): boolean {
  let changed = false;
  for (let i = 0; i < fps * seconds; i++) changed = g.frame(1 / fps) || changed;
  return changed;
}

describe('renderScale', () => {
  it('uses the full device ratio on a 3x phone', () => {
    expect(renderScale(3, 390 * 844, 'high')).toBe(3);
  });
  it('halves, never a fractional step, on the low tier', () => {
    expect(renderScale(3, 390 * 844, 'low')).toBe(1.5);
    expect(renderScale(2, 820 * 1180, 'low')).toBe(1);
    expect(renderScale(1, 1600 * 900, 'low')).toBe(1);
  });
  it('halves on very large high-density screens', () => {
    expect(renderScale(2, 2560 * 1440, 'high')).toBe(1);
  });
});

describe('QualityGovernor', () => {
  it('stays high at 60 fps', () => {
    const g = new QualityGovernor();
    expect(run(g, 60, 10)).toBe(false);
    expect(g.quality).toBe('high');
  });

  it('does not mistake a 30 fps frame cap for a slow device', () => {
    const g = new QualityGovernor();
    run(g, 30, 10);
    expect(g.quality).toBe('high');
  });

  it('steps down after two slow windows', () => {
    const g = new QualityGovernor();
    expect(run(g, 18, 4)).toBe(true);
    expect(g.quality).toBe('low');
  });

  it('ignores a single hitch', () => {
    const g = new QualityGovernor();
    run(g, 60, 2);
    g.frame(0.9);
    run(g, 60, 4);
    expect(g.quality).toBe('high');
  });
});
