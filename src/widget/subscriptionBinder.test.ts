import { describe, expect, it, vi } from 'vitest';
import { CART_EVENT, FAVORITES_EVENT } from './constants';
import type { MindboxWidgetConfig } from './contracts';
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
    const stateRef = {};
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
    expect(stateRef).toEqual({ eventsBound: true });
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
});
