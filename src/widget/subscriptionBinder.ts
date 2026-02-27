import { CART_EVENT, FAVORITES_EVENT } from './constants';
import { extractCartOrderLines, extractFavoritesProducts, mapCartOrderLines, mapFavoritesProducts } from './eventData';
import type { EventBusLike, MindboxInSalesWidgetState, MindboxWidgetConfig } from './contracts';
import type { SendOperation } from './operationSender';

export interface SubscriptionBinderDeps {
  stateRef: MindboxInSalesWidgetState;
  eventBus?: EventBusLike;
  getConfig: () => MindboxWidgetConfig | null;
  sendOperation: SendOperation;
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
    const list = mapFavoritesProducts(products, idKey);
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
    const list = mapCartOrderLines(orderLines, idKey);
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
