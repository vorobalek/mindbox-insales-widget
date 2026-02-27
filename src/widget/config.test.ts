import { describe, expect, it } from 'vitest';
import { createIds, normalizeAndValidateConfig } from './config';

describe('config', () => {
  it('returns null when config is missing', () => {
    expect(normalizeAndValidateConfig(undefined)).toBeNull();
  });

  it('normalizes and validates required settings', () => {
    const config = normalizeAndValidateConfig({
      apiDomain: ' https://api.mindbox.ru/ ',
      idKey: ' externalId ',
      operations: {
        viewCategory: ' ViewCategory ',
        viewProduct: ' ViewProduct ',
        setCart: ' SetCart ',
        clearCart: ' ClearCart '
      }
    })!;

    expect(config.apiDomain).toBe('api.mindbox.ru');
    expect(config.idKey).toBe('externalId');
    expect(config.operations).toEqual({
      viewCategory: 'ViewCategory',
      viewProduct: 'ViewProduct',
      setCart: 'SetCart',
      clearCart: 'ClearCart',
      setWishList: '',
      clearWishList: ''
    });
    expect(config.isValid).toBe(true);
    expect(config.missingSettings).toEqual([]);
  });

  it('keeps config valid without endpointId', () => {
    const config = normalizeAndValidateConfig({
      apiDomain: 'api.mindbox.ru',
      idKey: 'website',
      operations: {
        viewCategory: 'view',
        viewProduct: 'product',
        setCart: 'set',
        clearCart: 'clear'
      }
    })!;

    expect(config.isValid).toBe(true);
    expect(config.missingSettings).toEqual([]);
  });

  it('treats all operations as optional, including wishlist operations', () => {
    const config = normalizeAndValidateConfig({
      apiDomain: 'api.mindbox.ru',
      idKey: 'website',
      operations: {
        viewCategory: '',
        viewProduct: '',
        setCart: '',
        clearCart: '',
        setWishList: '',
        clearWishList: ''
      }
    })!;

    expect(config.isValid).toBe(true);
    expect(config.missingSettings).toEqual([]);
  });

  it('creates ids object with dynamic key', () => {
    expect(createIds('website', 10)).toEqual({ website: '10' });
    expect(createIds('externalId', 'abc')).toEqual({ externalId: 'abc' });
  });
});
