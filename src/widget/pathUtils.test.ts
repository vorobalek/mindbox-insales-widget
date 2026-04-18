import { describe, expect, it } from 'vitest';
import { formatAuthorizeSourceValue, getValueByPath, setValueByPath } from './pathUtils';

describe('pathUtils', () => {
  it('getValueByPath reads nested keys', () => {
    const root = { phone: '8', customer: { id: 1 }, a: { b: { c: 'x' } } };
    expect(getValueByPath(root, 'phone')).toBe('8');
    expect(getValueByPath(root, 'customer.id')).toBe(1);
    expect(getValueByPath(root, 'a.b.c')).toBe('x');
    expect(getValueByPath(root, 'missing')).toBeUndefined();
    expect(getValueByPath(root, '')).toBeUndefined();
  });

  it('setValueByPath builds nested objects', () => {
    expect(setValueByPath({}, 'customer.mobilePhone', '+7900')).toEqual({
      customer: { mobilePhone: '+7900' }
    });
    expect(setValueByPath({}, 'customer.ids.websiteID', '42')).toEqual({
      customer: { ids: { websiteID: '42' } }
    });
  });

  it('returns undefined for non-object path segments and leaves root unchanged for empty target path', () => {
    const root = { customer: null, items: [] };
    const target = { customer: { mobilePhone: '+7900' } };

    expect(getValueByPath(root, 'customer.id')).toBeUndefined();
    expect(getValueByPath(root, 'items.id')).toBeUndefined();
    expect(setValueByPath(target, '', 'ignored')).toBe(target);
    expect(target).toEqual({ customer: { mobilePhone: '+7900' } });
  });

  it('formatAuthorizeSourceValue normalizes phone segment', () => {
    expect(formatAuthorizeSourceValue(' +7 (900) 00-00-00 ', 'phone')).toBe('+7900000000');
    expect(formatAuthorizeSourceValue(101, 'id')).toBe('101');
    expect(formatAuthorizeSourceValue(null, 'phone')).toBe('');
  });

  it('trims authorize source values when source path is empty', () => {
    expect(formatAuthorizeSourceValue('  value  ', '')).toBe('value');
  });
});
