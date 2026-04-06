import type { CartOrderLine, FavoritesProduct, MindboxInSalesWidgetState } from './contracts';

export interface CartLineCanonical {
  extId: string;
  count: number;
  price: string | number | null;
}

export interface WishlistLineCanonical {
  extId: string;
  price: string | number | null;
}

export const canonicalCartOrderLinesForFingerprint = (orderLines: CartOrderLine[]): CartLineCanonical[] => {
  return [...orderLines]
    .map((line) => ({
      extId: String(line.id),
      count: line.quantity,
      price: line.sale_price
    }))
    .sort((a, b) => (a.extId < b.extId ? -1 : a.extId > b.extId ? 1 : 0));
};

export const fingerprintFromCartOrderLines = (orderLines: CartOrderLine[]): string => {
  return JSON.stringify(canonicalCartOrderLinesForFingerprint(orderLines));
};

export const canonicalFavoritesForFingerprint = (products: FavoritesProduct[]): WishlistLineCanonical[] => {
  return [...products]
    .map((p) => ({
      extId: String(p.id),
      price: p.price_min
    }))
    .sort((a, b) => a.extId.localeCompare(b.extId));
};

export const fingerprintFromFavoritesProducts = (products: FavoritesProduct[]): string => {
  return JSON.stringify(canonicalFavoritesForFingerprint(products));
};

export type CartFingerprintStateField = 'lastCartSyncFingerprint';
export type WishlistFingerprintStateField = 'lastWishlistSyncFingerprint';

export const readStoredFingerprint = (
  storage: Storage | undefined,
  sessionKey: string,
  stateRef: MindboxInSalesWidgetState,
  stateField: CartFingerprintStateField | WishlistFingerprintStateField
): string | undefined => {
  try {
    if (storage) {
      const value = storage.getItem(sessionKey);
      if (value !== null) {
        return value;
      }
    }
  } catch {
    // ignore
  }
  return stateRef[stateField];
};

export const writeStoredFingerprint = (
  storage: Storage | undefined,
  sessionKey: string,
  stateRef: MindboxInSalesWidgetState,
  stateField: CartFingerprintStateField | WishlistFingerprintStateField,
  fingerprint: string
): void => {
  try {
    if (storage) {
      storage.setItem(sessionKey, fingerprint);
    }
  } catch {
    // ignore
  }
  stateRef[stateField] = fingerprint;
};
