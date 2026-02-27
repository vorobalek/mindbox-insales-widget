import { describe, expect, it } from 'vitest';

import { baselineMarker } from './smoke.js';

describe('baseline smoke', () => {
  it('returns true marker', () => {
    expect(baselineMarker).toBe(true);
  });
});
