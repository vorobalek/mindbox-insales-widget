import { describe, expect, it } from 'vitest';
import { normalizeValue } from './normalizeValue';

describe('normalizeValue', () => {
  it('trims string values', () => {
    expect(normalizeValue('  value  ')).toBe('value');
  });

  it('returns empty string for non-string values', () => {
    expect(normalizeValue(null)).toBe('');
    expect(normalizeValue(undefined)).toBe('');
    expect(normalizeValue(100)).toBe('');
  });
});
