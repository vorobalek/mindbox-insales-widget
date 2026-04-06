import { describe, expect, it, vi } from 'vitest';
import { CART_EVENT, FAVORITES_EVENT } from './constants';
import type { MindboxInSalesWidgetState, MindboxWidgetConfig } from './contracts';
import { bindSubscriptions } from './subscriptionBinder';

describe('bindSubscriptions', () => {
  it('returns true when subscriptions are already bound', () => {
    const result = bindSubscriptions({
      stateRef: { eventsBound: true },
      eventBus: { subscribe: vi.fn() },
      getConfig: () => null,
      sendOperation: vi.fn()
    });

    expect(result).toBe(true);
  });

  it('returns false when eventBus is not available', () => {
    const result = bindSubscriptions({
      stateRef: {},
      eventBus: undefined,
      getConfig: () => null,
      sendOperation: vi.fn()
    });

    expect(result).toBe(false);
  });

  it('binds favorites and cart subscriptions and sends proper operations', () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const sendOperation = vi.fn();
    const stateRef: MindboxInSalesWidgetState = {};
    let config: MindboxWidgetConfig = {
      idKey: 'externalId',
      operations: {
        setWishList: 'Website.SetWishList',
        clearWishList: 'Website.ClearWishList',
        setCart: 'Website.SetCart',
        clearCart: 'Website.ClearCart'
      }
    };

    const result = bindSubscriptions({
      stateRef,
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers.set(eventName, handler);
        }
      },
      getConfig: () => config,
      sendOperation
    });

    expect(result).toBe(true);
    expect(stateRef.eventsBound).toBe(true);
    expect(handlers.has(FAVORITES_EVENT)).toBe(true);
    expect(handlers.has(CART_EVENT)).toBe(true);

    handlers.get(FAVORITES_EVENT)!({
      products: [{ id: 11, price_min: 400 }]
    });
    expect(sendOperation).toHaveBeenCalledWith('Website.SetWishList', {
      productList: [
        {
          count: 1,
          pricePerItem: 400,
          productGroup: { ids: { externalId: '11' } }
        }
      ]
    });

    handlers.get(FAVORITES_EVENT)!({ products: [] });
    expect(sendOperation).toHaveBeenLastCalledWith('Website.ClearWishList', {});

    config = { ...config, idKey: undefined };
    handlers.get(FAVORITES_EVENT)!({
      products: [{ id: 21, price_min: 800 }]
    });
    expect(sendOperation).toHaveBeenLastCalledWith('Website.SetWishList', {
      productList: [
        {
          count: 1,
          pricePerItem: 800,
          productGroup: { ids: { website: '21' } }
        }
      ]
    });

    config = { ...config, idKey: undefined };
    handlers.get(CART_EVENT)!({
      order_lines: [{ id: 12, quantity: 2, sale_price: 500 }]
    });
    expect(sendOperation).toHaveBeenCalledWith('Website.SetCart', {
      productList: [
        {
          count: 2,
          pricePerItem: 500,
          product: { ids: { website: '12' } }
        }
      ]
    });

    handlers.get(CART_EVENT)!({ order_lines: [] });
    expect(sendOperation).toHaveBeenLastCalledWith('Website.ClearCart', {});
  });

  it('passes undefined operation when operations are missing', () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const sendOperation = vi.fn();

    bindSubscriptions({
      stateRef: {},
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers.set(eventName, handler);
        }
      },
      getConfig: () => ({}),
      sendOperation
    });

    handlers.get(CART_EVENT)!({ order_lines: [{ id: 1, quantity: 1, sale_price: 10 }] });

    expect(sendOperation).toHaveBeenCalledWith(undefined, {
      productList: [
        {
          count: 1,
          pricePerItem: 10,
          product: { ids: { website: '1' } }
        }
      ]
    });
  });

  it('falls back to set operations with empty list when clear operations are missing', () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const sendOperation = vi.fn();

    bindSubscriptions({
      stateRef: {},
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers.set(eventName, handler);
        }
      },
      getConfig: () => ({
        idKey: 'website',
        operations: {
          setWishList: 'Website.SetWishList',
          setCart: 'Website.SetCart'
        }
      }),
      sendOperation
    });

    handlers.get(FAVORITES_EVENT)!({ products: [] });
    expect(sendOperation).toHaveBeenCalledWith('Website.SetWishList', {
      productList: []
    });

    handlers.get(CART_EVENT)!({ order_lines: [] });
    expect(sendOperation).toHaveBeenCalledWith('Website.SetCart', {
      productList: []
    });
  });

  it('skips cart event when config is missing', () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const sendOperation = vi.fn();

    bindSubscriptions({
      stateRef: {},
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers.set(eventName, handler);
        }
      },
      getConfig: () => null,
      sendOperation
    });

    handlers.get(CART_EVENT)!({ order_lines: [{ id: 1, quantity: 1, sale_price: 10 }] });

    expect(sendOperation).not.toHaveBeenCalled();
  });

  it('skips favorites event when config is missing', () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const sendOperation = vi.fn();

    bindSubscriptions({
      stateRef: {},
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers.set(eventName, handler);
        }
      },
      getConfig: () => null,
      sendOperation
    });

    handlers.get(FAVORITES_EVENT)!({ products: [{ id: 1, price_min: 10 }] });

    expect(sendOperation).not.toHaveBeenCalled();
  });

  it('does not send duplicate cart operations when payload fingerprint unchanged', () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const sendOperation = vi.fn();
    const stateRef = {};
    const cartPayload = {
      order_lines: [{ id: 1, quantity: 1, sale_price: 10 }]
    };

    bindSubscriptions({
      stateRef,
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers.set(eventName, handler);
        }
      },
      getConfig: () => ({
        idKey: 'website',
        operations: {
          setCart: 'Website.SetCart',
          clearCart: 'Website.ClearCart'
        }
      }),
      sendOperation
    });

    handlers.get(CART_EVENT)!(cartPayload);
    handlers.get(CART_EVENT)!(cartPayload);
    handlers.get(CART_EVENT)!(cartPayload);

    expect(sendOperation).toHaveBeenCalledTimes(1);
    expect(sendOperation).toHaveBeenCalledWith('Website.SetCart', {
      productList: [
        {
          count: 1,
          pricePerItem: 10,
          product: { ids: { website: '1' } }
        }
      ]
    });
  });

  it('does not send duplicate wishlist operations when payload fingerprint unchanged', () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const sendOperation = vi.fn();
    const stateRef = {};
    const favPayload = { products: [{ id: 5, price_min: 100 }] };

    bindSubscriptions({
      stateRef,
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers.set(eventName, handler);
        }
      },
      getConfig: () => ({
        idKey: 'website',
        operations: {
          setWishList: 'Website.SetWishList',
          clearWishList: 'Website.ClearWishList'
        }
      }),
      sendOperation
    });

    handlers.get(FAVORITES_EVENT)!(favPayload);
    handlers.get(FAVORITES_EVENT)!(favPayload);

    expect(sendOperation).toHaveBeenCalledTimes(1);
  });

  it('dedupes using sessionStorage when widget state is fresh but tab storage retains fingerprint', () => {
    const store = new Map<string, string>();
    const sessionStorageRef = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      }
    } as Storage;

    const handlers1 = new Map<string, (data: unknown) => void>();
    const sendOperation1 = vi.fn();
    const stateRef1 = {};

    bindSubscriptions({
      stateRef: stateRef1,
      sessionStorageRef,
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers1.set(eventName, handler);
        }
      },
      getConfig: () => ({
        idKey: 'website',
        operations: {
          setCart: 'Website.SetCart',
          clearCart: 'Website.ClearCart'
        }
      }),
      sendOperation: sendOperation1
    });

    const cartPayload = { order_lines: [{ id: 9, quantity: 1, sale_price: 5 }] };
    handlers1.get(CART_EVENT)!(cartPayload);
    expect(sendOperation1).toHaveBeenCalledTimes(1);

    const handlers2 = new Map<string, (data: unknown) => void>();
    const sendOperation2 = vi.fn();
    const stateRef2 = {};

    bindSubscriptions({
      stateRef: stateRef2,
      sessionStorageRef,
      eventBus: {
        subscribe: (eventName, handler) => {
          handlers2.set(eventName, handler);
        }
      },
      getConfig: () => ({
        idKey: 'website',
        operations: {
          setCart: 'Website.SetCart',
          clearCart: 'Website.ClearCart'
        }
      }),
      sendOperation: sendOperation2
    });

    handlers2.get(CART_EVENT)!(cartPayload);
    expect(sendOperation2).toHaveBeenCalledTimes(0);
  });
});
