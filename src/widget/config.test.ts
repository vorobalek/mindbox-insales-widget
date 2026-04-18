import { describe, expect, it } from 'vitest';
import { createIds, normalizeAndValidateConfig, resolveAuthorizePathPairs } from './config';

describe('config', () => {
  it('returns empty authorize path pairs when authorize config is missing', () => {
    expect(resolveAuthorizePathPairs(undefined)).toEqual([]);
  });

  it('returns predefined authorize path pairs without recomputing them', () => {
    const pathPairs = [{ sourcePath: 'id', targetPath: 'customer.ids.websiteID' }];

    expect(
      resolveAuthorizePathPairs({
        enabled: true,
        sourcePath: 'ignored',
        targetPath: 'ignored',
        pathPairs
      })
    ).toBe(pathPairs);
  });

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
      clearWishList: '',
      authorizeCustomer: ''
    });
    expect(config.authorizeCustomer).toEqual({
      enabled: false,
      sourcePath: '',
      targetPath: '',
      sourcePath2: '',
      targetPath2: '',
      sourcePath3: '',
      targetPath3: '',
      pathPairs: []
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

  it('parses authorize customer checkbox and paths', () => {
    const config = normalizeAndValidateConfig({
      apiDomain: 'api.mindbox.ru',
      idKey: 'website',
      operations: {
        viewCategory: '',
        viewProduct: '',
        setCart: '',
        clearCart: '',
        setWishList: '',
        clearWishList: '',
        authorizeCustomer: 'Website.AuthorizeCustomer'
      },
      authorizeCustomer: {
        enabled: 'true',
        sourcePath: ' phone ',
        targetPath: ' customer.mobilePhone '
      }
    })!;

    expect(config.authorizeCustomer).toEqual({
      enabled: true,
      sourcePath: 'phone',
      targetPath: 'customer.mobilePhone',
      sourcePath2: '',
      targetPath2: '',
      sourcePath3: '',
      targetPath3: '',
      pathPairs: [{ sourcePath: 'phone', targetPath: 'customer.mobilePhone' }]
    });
    expect(config.operations!.authorizeCustomer).toBe('Website.AuthorizeCustomer');
  });

  it('treats alternate checkbox truthy values as enabled', () => {
    expect(
      normalizeAndValidateConfig({
        apiDomain: 'api.mindbox.ru',
        idKey: 'website',
        authorizeCustomer: { enabled: '1' }
      })!.authorizeCustomer!.enabled
    ).toBe(true);

    expect(
      normalizeAndValidateConfig({
        apiDomain: 'api.mindbox.ru',
        idKey: 'website',
        authorizeCustomer: { enabled: 'yes' }
      })!.authorizeCustomer!.enabled
    ).toBe(true);

    expect(
      normalizeAndValidateConfig({
        apiDomain: 'api.mindbox.ru',
        idKey: 'website',
        authorizeCustomer: { enabled: 'on' }
      })!.authorizeCustomer!.enabled
    ).toBe(true);
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

  it('collects multiple authorize path pairs and skips incomplete rows', () => {
    const config = normalizeAndValidateConfig({
      apiDomain: 'api.mindbox.ru',
      idKey: 'website',
      operations: {
        viewCategory: '',
        viewProduct: '',
        setCart: '',
        clearCart: '',
        setWishList: '',
        clearWishList: '',
        authorizeCustomer: 'Auth'
      },
      authorizeCustomer: {
        enabled: true,
        sourcePath: 'id',
        targetPath: 'customer.ids.websiteID',
        sourcePath2: 'phone',
        targetPath2: 'customer.mobilePhone',
        sourcePath3: 'missing',
        targetPath3: ''
      }
    })!;

    expect(config.authorizeCustomer!.pathPairs).toEqual([
      { sourcePath: 'id', targetPath: 'customer.ids.websiteID' },
      { sourcePath: 'phone', targetPath: 'customer.mobilePhone' }
    ]);
  });

  it('creates ids object with dynamic key', () => {
    expect(createIds('website', 10)).toEqual({ website: '10' });
    expect(createIds('externalId', 'abc')).toEqual({ externalId: 'abc' });
  });
});
