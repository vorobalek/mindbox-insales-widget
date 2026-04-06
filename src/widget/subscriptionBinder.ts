import {
  CART_EVENT,
  FAVORITES_EVENT,
  SYNC_CART_FINGERPRINT_SESSION_KEY,
  SYNC_WISHLIST_FINGERPRINT_SESSION_KEY
} from './constants';
import { extractCartOrderLines, extractFavoritesProducts, mapCartOrderLines, mapFavoritesProducts } from './eventData';
import type { EventBusLike, MindboxInSalesWidgetState, MindboxWidgetConfig } from './contracts';
import type { SendOperation } from './operationSender';
import {
  fingerprintFromCartOrderLines,
  fingerprintFromFavoritesProducts,
  readStoredFingerprint,
  writeStoredFingerprint
} from './syncFingerprint';

export interface SubscriptionBinderDeps {
  stateRef: MindboxInSalesWidgetState;
  eventBus?: EventBusLike;
  getConfig: () => MindboxWidgetConfig | null;
  sendOperation: SendOperation;
  sessionStorageRef?: Storage;
}

export const bindSubscriptions = (deps: SubscriptionBinderDeps): boolean => {
  if (deps.stateRef.eventsBound) {
    return true;
  }

  if (!deps.eventBus || typeof deps.eventBus.subscribe !== 'function') {
    return false;
  }

  deps.eventBus.subscribe(FAVORITES_EVENT, (data: unknown) => {
    const config = deps.getConfig();
    if (!config) {
      return;
    }

    const idKey = config.idKey || 'website';
    const products = extractFavoritesProducts(data);
    const fingerprint = fingerprintFromFavoritesProducts(products);
    const prev = readStoredFingerprint(
      deps.sessionStorageRef,
      SYNC_WISHLIST_FINGERPRINT_SESSION_KEY,
      deps.stateRef,
      'lastWishlistSyncFingerprint'
    );
    if (prev === fingerprint) {
      return;
    }

    const list = mapFavoritesProducts(products, idKey);
    writeStoredFingerprint(
      deps.sessionStorageRef,
      SYNC_WISHLIST_FINGERPRINT_SESSION_KEY,
      deps.stateRef,
      'lastWishlistSyncFingerprint',
      fingerprint
    );
    if (list.length) {
      deps.sendOperation(config.operations && config.operations.setWishList, {
        productList: list
      });
      return;
    }

    if (config.operations && config.operations.clearWishList) {
      deps.sendOperation(config.operations.clearWishList, {});
      return;
    }

    deps.sendOperation(config.operations && config.operations.setWishList, {
      productList: []
    });
  });

  deps.eventBus.subscribe(CART_EVENT, (data: unknown) => {
    const config = deps.getConfig();
    if (!config) {
      return;
    }

    const idKey = config.idKey || 'website';
    const orderLines = extractCartOrderLines(data);
    const fingerprint = fingerprintFromCartOrderLines(orderLines);
    const prev = readStoredFingerprint(
      deps.sessionStorageRef,
      SYNC_CART_FINGERPRINT_SESSION_KEY,
      deps.stateRef,
      'lastCartSyncFingerprint'
    );
    if (prev === fingerprint) {
      return;
    }

    const list = mapCartOrderLines(orderLines, idKey);
    writeStoredFingerprint(
      deps.sessionStorageRef,
      SYNC_CART_FINGERPRINT_SESSION_KEY,
      deps.stateRef,
      'lastCartSyncFingerprint',
      fingerprint
    );
    if (list.length) {
      deps.sendOperation(config.operations && config.operations.setCart, {
        productList: list
      });
      return;
    }

    if (config.operations && config.operations.clearCart) {
      deps.sendOperation(config.operations.clearCart, {});
      return;
    }

    deps.sendOperation(config.operations && config.operations.setCart, {
      productList: []
    });
  });

  deps.stateRef.eventsBound = true;
  return true;
};
