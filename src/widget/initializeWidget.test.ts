import { describe, expect, it, vi } from 'vitest';
import { MESSAGE_EVENTBUS_UNAVAILABLE, MESSAGE_MISSING_SETTINGS } from './constants';
import type { EventBusLike, WidgetWindow } from './contracts';
import { initializeWidget, type InitializeWidgetDeps } from './initializeWidget';

const createValidConfig = () => {
  return {
    apiDomain: 'api.mindbox.ru',
    idKey: 'website',
    operations: {
      viewCategory: 'Website.ViewCategory',
      viewProduct: 'Website.ViewProduct',
      setCart: 'Website.SetCart',
      clearCart: 'Website.ClearCart'
    },
    page: {
      template: 'collection',
      collectionId: 10
    }
  };
};

const createAuthorizeConfig = () => {
  return {
    ...createValidConfig(),
    operations: {
      ...createValidConfig().operations,
      authorizeCustomer: 'Website.AuthorizeCustomer'
    },
    authorizeCustomer: {
      enabled: true,
      sourcePath: 'id',
      targetPath: 'customer.ids.websiteID'
    }
  };
};

const createTimerId = (): ReturnType<typeof setInterval> => {
  const timerId = setInterval(() => undefined, 60_000);
  clearInterval(timerId);
  return timerId;
};

type SetIntervalFn = InitializeWidgetDeps['setIntervalFn'];
type ClearIntervalFn = InitializeWidgetDeps['clearIntervalFn'];

const asSetIntervalFn = (fn: unknown): SetIntervalFn => fn as SetIntervalFn;
const asClearIntervalFn = (fn: unknown): ClearIntervalFn => fn as ClearIntervalFn;

describe('initializeWidget', () => {
  it('returns early when config is missing', async () => {
    const setIntervalFn = vi.fn();

    await initializeWidget({
      windowRef: {},
      eventBus: undefined,
      setIntervalFn: asSetIntervalFn(setIntervalFn),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike: { error: vi.fn() }
    });

    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it('logs missing settings once when config is invalid', async () => {
    const consoleLike = { error: vi.fn() };

    await initializeWidget({
      windowRef: {
        __mindboxInSalesWidget: {
          config: {
            apiDomain: ' ',
            idKey: ' ',
            operations: {
              viewCategory: ' ',
              viewProduct: ' ',
              setCart: ' ',
              clearCart: ' '
            }
          }
        }
      },
      eventBus: undefined,
      setIntervalFn: asSetIntervalFn(vi.fn()),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike
    });

    await initializeWidget({
      windowRef: {
        __mindboxInSalesWidget: {
          config: {
            apiDomain: ' ',
            idKey: ' ',
            operations: {
              viewCategory: ' ',
              viewProduct: ' ',
              setCart: ' ',
              clearCart: ' '
            }
          },
          state: {
            missingSettingsLogged: true
          }
        }
      },
      eventBus: undefined,
      setIntervalFn: asSetIntervalFn(vi.fn()),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike
    });

    expect(consoleLike.error).toHaveBeenCalledTimes(1);
    expect(consoleLike.error).toHaveBeenCalledWith(MESSAGE_MISSING_SETTINGS, expect.any(String));
  });

  it('sends page view, binds handlers and processes cart updates', async () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const subscribe = vi.fn((eventName: string, handler: (data: unknown) => void) => {
      handlers.set(eventName, handler);
    });
    const setIntervalFn = vi.fn();
    const consoleLike = { error: vi.fn() };
    const mindbox = vi.fn();
    const windowRef = {
      __mindboxInSalesWidget: {
        config: createValidConfig()
      },
      mindbox
    } as WidgetWindow;

    await initializeWidget({
      windowRef,
      eventBus: { subscribe },
      setIntervalFn: asSetIntervalFn(setIntervalFn),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike
    });

    expect(setIntervalFn).not.toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(windowRef.__mindboxInSalesWidget?.state?.eventsBound).toBe(true);
    expect(mindbox.mock.calls[0][0]).toBe('async');

    handlers.get('update_items:insales:cart:light')!({
      order_lines: [{ id: 100, quantity: 2, sale_price: 999 }]
    });
    expect(mindbox).toHaveBeenCalledWith(
      'async',
      expect.objectContaining({
        operation: 'Website.SetCart'
      })
    );

    if (windowRef.__mindboxInSalesWidget) {
      windowRef.__mindboxInSalesWidget.config = undefined;
    }
    handlers.get('update_items:insales:favorites_products')!({
      products: [{ id: 500, price_min: 800 }]
    });

    expect(mindbox).toHaveBeenCalledTimes(2);
  });

  it('keeps sending anonymous events when the authorize customer getter rejects', async () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const subscribe = vi.fn((eventName: string, handler: (data: unknown) => void) => {
      handlers.set(eventName, handler);
    });
    const mindbox = vi.fn();
    const consoleLike = { error: vi.fn() };
    const setIntervalFn = vi.fn();
    // Mirrors the production inSales client getter for anonymous visitors: a
    // thenable that rejects with the "Not authorized" payload.
    const clientGet = vi.fn(() =>
      Promise.reject({
        message: 'Not authorized',
        url: 'client_account/session/new',
        authorized: false,
        status: 'error'
      })
    );
    const windowRef = {
      __mindboxInSalesWidget: {
        config: createAuthorizeConfig()
      },
      mindbox,
      ajaxAPI: {
        shop: {
          client: {
            get: clientGet
          }
        }
      }
    } as WidgetWindow;

    await initializeWidget({
      windowRef,
      eventBus: { subscribe },
      setIntervalFn: asSetIntervalFn(setIntervalFn),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike
    });

    // Let the rejected authorize promise settle so an unhandled rejection would surface.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clientGet).toHaveBeenCalled();
    // Subscriptions are bound and the anonymous page view is still delivered.
    expect(windowRef.__mindboxInSalesWidget?.state?.eventsBound).toBe(true);
    expect(mindbox).toHaveBeenCalledWith(
      'async',
      expect.objectContaining({
        operation: 'Website.ViewCategory'
      })
    );

    handlers.get('update_items:insales:cart:light')!({
      order_lines: [{ id: 100, quantity: 2, sale_price: 999 }]
    });
    expect(mindbox).toHaveBeenCalledWith(
      'async',
      expect.objectContaining({
        operation: 'Website.SetCart'
      })
    );

    // The authorize operation is never sent for an anonymous visitor, and the
    // failed lookup does not log a config error.
    const authorizeCalls = mindbox.mock.calls.filter(
      (call) => (call[1] as { operation?: string }).operation === 'Website.AuthorizeCustomer'
    );
    expect(authorizeCalls).toHaveLength(0);
    expect(consoleLike.error).not.toHaveBeenCalled();
  });

  it('initializes with empty operations and skips sending events', async () => {
    const handlers = new Map<string, (data: unknown) => void>();
    const subscribe = vi.fn((eventName: string, handler: (data: unknown) => void) => {
      handlers.set(eventName, handler);
    });
    const mindbox = vi.fn();
    const consoleLike = { error: vi.fn() };
    const windowRef = {
      __mindboxInSalesWidget: {
        config: {
          apiDomain: 'api.mindbox.ru',
          idKey: 'website',
          operations: {},
          page: {
            template: 'collection',
            collectionId: 10
          }
        }
      },
      mindbox
    } as WidgetWindow;

    await initializeWidget({
      windowRef,
      eventBus: { subscribe },
      setIntervalFn: asSetIntervalFn(vi.fn()),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike
    });

    handlers.get('update_items:insales:cart:light')!({
      order_lines: [{ id: 100, quantity: 2, sale_price: 999 }]
    });
    handlers.get('update_items:insales:cart:light')!({
      order_lines: []
    });
    handlers.get('update_items:insales:favorites_products')!({
      products: [{ id: 123, price_min: 500 }]
    });
    handlers.get('update_items:insales:favorites_products')!({
      products: []
    });

    expect(windowRef.__mindboxInSalesWidget?.state?.eventsBound).toBe(true);
    expect(mindbox).not.toHaveBeenCalled();
    expect(consoleLike.error).not.toHaveBeenCalled();
  });

  it('returns early when events are already bound after config normalization', async () => {
    const windowRef = {
      __mindboxInSalesWidget: {
        config: createValidConfig(),
        state: {
          eventsBound: true
        }
      },
      mindbox: vi.fn()
    } as WidgetWindow;

    await initializeWidget({
      windowRef,
      eventBus: { subscribe: vi.fn() },
      setIntervalFn: asSetIntervalFn(vi.fn()),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike: { error: vi.fn() }
    });

    expect(windowRef.__mindboxInSalesWidget?.state?.eventsBound).toBe(true);
  });

  it('initializes without document object and keeps working', async () => {
    const windowRef = {
      __mindboxInSalesWidget: {
        config: createValidConfig()
      }
    } as WidgetWindow;

    await initializeWidget({
      windowRef,
      eventBus: { subscribe: vi.fn() },
      setIntervalFn: asSetIntervalFn(vi.fn()),
      clearIntervalFn: asClearIntervalFn(vi.fn()),
      consoleLike: { error: vi.fn() }
    });

    expect(windowRef.__mindboxInSalesWidget?.state?.eventsBound).toBe(true);
  });

  it('uses global sessionStorage when it is available', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn()
    };

    vi.stubGlobal('sessionStorage', storage);

    try {
      const windowRef = {
        __mindboxInSalesWidget: {
          config: createValidConfig()
        }
      } as WidgetWindow;

      await initializeWidget({
        windowRef,
        eventBus: { subscribe: vi.fn() },
        setIntervalFn: asSetIntervalFn(vi.fn()),
        clearIntervalFn: asClearIntervalFn(vi.fn()),
        consoleLike: { error: vi.fn() }
      });

      expect(windowRef.__mindboxInSalesWidget?.state?.eventsBound).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('retries binding and stops timer after successful retry', async () => {
    let intervalCallback: (() => void) | null = null;
    const timerId = createTimerId();
    const setIntervalFn = vi.fn((callback: () => void) => {
      intervalCallback = callback;
      return timerId;
    });
    const clearIntervalFn = vi.fn();
    const eventBus: Partial<EventBusLike> = {};
    const windowRef = {
      __mindboxInSalesWidget: {
        config: createValidConfig()
      }
    } as WidgetWindow;

    const initPromise = initializeWidget({
      windowRef,
      eventBus: eventBus as EventBusLike,
      setIntervalFn,
      clearIntervalFn,
      consoleLike: { error: vi.fn() }
    });

    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(intervalCallback).not.toBeNull();

    eventBus.subscribe = vi.fn();
    intervalCallback!();
    await initPromise;

    expect(clearIntervalFn).toHaveBeenCalledWith(timerId);
    expect(windowRef.__mindboxInSalesWidget?.state?.eventsBound).toBe(true);
  });

  it('logs error when eventBus is unavailable after max retries', async () => {
    let intervalCallback: (() => void) | null = null;
    const timerId = createTimerId();
    const setIntervalFn = vi.fn((callback: () => void) => {
      intervalCallback = callback;
      return timerId;
    });
    const clearIntervalFn = vi.fn();
    const consoleLike = { error: vi.fn() };

    const initPromise = initializeWidget({
      windowRef: {
        __mindboxInSalesWidget: {
          config: createValidConfig()
        },
        mindbox: vi.fn()
      },
      eventBus: undefined,
      setIntervalFn,
      clearIntervalFn,
      consoleLike
    });

    for (let i = 0; i < 50; i += 1) {
      intervalCallback!();
    }
    await initPromise;

    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
    expect(clearIntervalFn).toHaveBeenCalledWith(timerId);
    expect(consoleLike.error).toHaveBeenCalledWith(MESSAGE_EVENTBUS_UNAVAILABLE);
  });
});
