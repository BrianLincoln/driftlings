import { describe, expect, it } from 'vitest';
import endings from '../../content/endings.json';
import { THING_NAMES } from './index';

describe('things', () => {
  it('has a drawing for every word shown as one and several', () => {
    for (const base of Object.values(endings.many).flat()) expect(THING_NAMES, base).toContain(base);
  });
});
