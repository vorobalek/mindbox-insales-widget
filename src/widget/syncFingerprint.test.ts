import { describe, expect, it, vi } from 'vitest';
import {
  fingerprintFromCartOrderLines,
  fingerprintFromFavoritesProducts,
  readStoredFingerprint,
  writeStoredFingerprint
} from './syncFingerprint';

describe('syncFingerprint', () => {
  it('keeps duplicate cart ids stable when fingerprint sorting compares equal ids', () => {
    expect(
      fingerprintFromCartOrderLines([
        { id: 1, quantity: 1, sale_price: 10 },
        { id: '1', quantity: 2, sale_price: 20 }
      ])
    ).toBe('[{"extId":"1","count":1,"price":10},{"extId":"1","count":2,"price":20}]');
  });

  it('builds stable cart fingerprint regardless of order_lines order', () => {
    const a = fingerprintFromCartOrderLines([
      { id: 2, quantity: 1, sale_price: 10 },
      { id: 1, quantity: 3, sale_price: null }
    ]);
    const b = fingerprintFromCartOrderLines([
      { id: 1, quantity: 3, sale_price: null },
      { id: 2, quantity: 1, sale_price: 10 }
    ]);
    expect(a).toBe(b);
    expect(a).toBe('[{"extId":"1","count":3,"price":null},{"extId":"2","count":1,"price":10}]');
  });

  it('builds stable wishlist fingerprint regardless of products order', () => {
    const a = fingerprintFromFavoritesProducts([
      { id: 'b', price_min: 1 },
      { id: 'a', price_min: 2 }
    ]);
    const b = fingerprintFromFavoritesProducts([
      { id: 'a', price_min: 2 },
      { id: 'b', price_min: 1 }
    ]);
    expect(a).toBe(b);
  });

  it('treats empty cart and wishlist as fixed fingerprints', () => {
    expect(fingerprintFromCartOrderLines([])).toBe('[]');
    expect(fingerprintFromFavoritesProducts([])).toBe('[]');
  });

  it('readStoredFingerprint prefers sessionStorage when present', () => {
    const storage = {
      getItem: vi.fn(() => 'from-session'),
      setItem: vi.fn()
    } as unknown as Storage;
    const stateRef = { lastCartSyncFingerprint: 'from-state' };
    expect(readStoredFingerprint(storage, 'k', stateRef, 'lastCartSyncFingerprint')).toBe('from-session');
  });

  it('readStoredFingerprint falls back to state when storage missing key', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    } as unknown as Storage;
    const stateRef = { lastCartSyncFingerprint: 'from-state' };
    expect(readStoredFingerprint(storage, 'k', stateRef, 'lastCartSyncFingerprint')).toBe('from-state');
  });

  it('writeStoredFingerprint updates state and session when storage works', () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    } as unknown as Storage;
    const stateRef: { lastWishlistSyncFingerprint?: string } = {};
    writeStoredFingerprint(storage, 'k', stateRef, 'lastWishlistSyncFingerprint', 'fp1');
    expect(storage.setItem).toHaveBeenCalledWith('k', 'fp1');
    expect(stateRef.lastWishlistSyncFingerprint).toBe('fp1');
  });

  it('writeStoredFingerprint still updates state when setItem throws', () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new Error('quota');
      })
    } as unknown as Storage;
    const stateRef: { lastCartSyncFingerprint?: string } = {};
    writeStoredFingerprint(storage, 'k', stateRef, 'lastCartSyncFingerprint', 'fp2');
    expect(stateRef.lastCartSyncFingerprint).toBe('fp2');
  });

  it('writeStoredFingerprint updates state when storage is unavailable', () => {
    const stateRef: { lastWishlistSyncFingerprint?: string } = {};
    writeStoredFingerprint(undefined, 'k', stateRef, 'lastWishlistSyncFingerprint', 'fp3');
    expect(stateRef.lastWishlistSyncFingerprint).toBe('fp3');
  });
});
