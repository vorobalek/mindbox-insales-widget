import { describe, expect, it, vi } from 'vitest';
import { AUTHORIZE_CUSTOMER_SESSION_KEY } from './constants';
import { startAuthorizeCustomerFlow } from './authorizeCustomerSender';
import type { MindboxWidgetConfig, JQueryDeferredLike, WidgetWindow } from './contracts';

const createDeferred = (payload: unknown, shouldFail = false): JQueryDeferredLike<unknown> => {
  return {
    done: (callback) => {
      if (!shouldFail) {
        callback(payload);
      }
      return createDeferred(payload, shouldFail);
    },
    fail: (callback) => {
      if (shouldFail) {
        callback(new Error('Not authorized'));
      }
      return createDeferred(payload, shouldFail);
    }
  };
};

const baseAuthorizeConfig = (): MindboxWidgetConfig => ({
  apiDomain: 'api.mindbox.ru',
  idKey: 'website',
  operations: {
    authorizeCustomer: 'Website.AuthorizeCustomer'
  },
  authorizeCustomer: {
    enabled: true,
    sourcePath: 'phone',
    targetPath: 'customer.ids.websiteID'
  }
});

const settleAsyncFlow = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe('startAuthorizeCustomerFlow', () => {
  it('sends operation with mapped payload and normalized phone', async () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn(() => setInterval(() => undefined, 60_000));
    const clearIntervalFn = vi.fn();
    const storageMap = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageMap.get(key) || null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value);
      }
    };

    const windowRef = {
      ajaxAPI: {
        shop: {
          client: {
            get: () => createDeferred({ id: 15, phone: ' +7 (900) 000-00-01 ' })
          }
        }
      }
    } as WidgetWindow;

    const stateRef = {};
    const getConfig = vi.fn(() => baseAuthorizeConfig());

    startAuthorizeCustomerFlow({
      windowRef,
      stateRef,
      sendOperation,
      getConfig,
      storage,
      setIntervalFn,
      clearIntervalFn
    });

    await settleAsyncFlow();

    expect(sendOperation).toHaveBeenCalledWith('Website.AuthorizeCustomer', {
      customer: {
        ids: {
          websiteID: '+79000000001'
        }
      }
    });
    expect(stateRef).toEqual({
      authorizeCustomerSent: true,
      lastAuthorizedWebsiteId: '+79000000001'
    });
    expect(storageMap.get(AUTHORIZE_CUSTOMER_SESSION_KEY)).toBe('+79000000001');
    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it('does not send duplicate when session storage matches dedupe key', async () => {
    const sendOperation = vi.fn();
    const storageMap = new Map<string, string>([[AUTHORIZE_CUSTOMER_SESSION_KEY, '+79000000001']]);
    const storage = {
      getItem: (key: string) => storageMap.get(key) || null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value);
      }
    };
    const windowRef = {
      ajaxAPI: {
        shop: {
          client: {
            get: () => createDeferred({ id: 15, phone: '+79000000001' })
          }
        }
      }
    } as WidgetWindow;
    const stateRef = {};
    const getConfig = vi.fn(() => baseAuthorizeConfig());

    startAuthorizeCustomerFlow({
      windowRef,
      stateRef,
      sendOperation,
      getConfig,
      storage,
      setIntervalFn: vi.fn(() => setInterval(() => undefined, 60_000)),
      clearIntervalFn: vi.fn()
    });
    await settleAsyncFlow();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(stateRef).toEqual({
      authorizeCustomerSent: true,
      lastAuthorizedWebsiteId: '+79000000001'
    });
  });

  it('returns early when authorize customer is disabled', () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn();
    const getConfig = vi.fn(() => ({
      ...baseAuthorizeConfig(),
      authorizeCustomer: { enabled: false, sourcePath: 'phone', targetPath: 'customer.mobilePhone' }
    }));

    startAuthorizeCustomerFlow({
      windowRef: {
        ajaxAPI: { shop: { client: { get: () => createDeferred({ phone: '1' }) } } }
      } as WidgetWindow,
      stateRef: {},
      sendOperation,
      getConfig,
      storage: undefined,
      setIntervalFn,
      clearIntervalFn: vi.fn()
    });

    expect(sendOperation).not.toHaveBeenCalled();
    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it('returns early when operation name or paths are missing', () => {
    const sendOperation = vi.fn();
    const getConfig = vi.fn(() => ({
      ...baseAuthorizeConfig(),
      operations: { authorizeCustomer: '' },
      authorizeCustomer: { enabled: true, sourcePath: 'phone', targetPath: 'customer.mobilePhone' }
    }));

    startAuthorizeCustomerFlow({
      windowRef: {
        ajaxAPI: { shop: { client: { get: () => createDeferred({ phone: '1' }) } } }
      } as WidgetWindow,
      stateRef: {},
      sendOperation,
      getConfig,
      storage: undefined,
      setIntervalFn: vi.fn(),
      clearIntervalFn: vi.fn()
    });

    expect(sendOperation).not.toHaveBeenCalled();
  });

  it('does nothing when ajaxAPI is unavailable', () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn();
    startAuthorizeCustomerFlow({
      windowRef: {},
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => baseAuthorizeConfig()),
      storage: undefined,
      setIntervalFn,
      clearIntervalFn: vi.fn()
    });

    expect(sendOperation).not.toHaveBeenCalled();
    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it('retries and sends once customer appears', async () => {
    let callIndex = 0;
    const get = vi.fn(() => {
      callIndex += 1;
      if (callIndex < 2) {
        return createDeferred({}, true);
      }

      return createDeferred({ id: 31 });
    });
    const sendOperation = vi.fn();
    let tick: (() => void) | null = null;
    const setIntervalFn = vi.fn((callback: () => void) => {
      tick = callback;
      return setInterval(() => undefined, 60_000);
    });
    const clearIntervalFn = vi.fn();

    const getConfig = vi.fn(() => ({
      ...baseAuthorizeConfig(),
      authorizeCustomer: {
        enabled: true,
        sourcePath: 'id',
        targetPath: 'customer.ids.websiteID'
      }
    }));

    startAuthorizeCustomerFlow({
      windowRef: {
        ajaxAPI: {
          shop: {
            client: {
              get
            }
          }
        }
      },
      stateRef: {},
      sendOperation,
      getConfig,
      storage: undefined,
      setIntervalFn,
      clearIntervalFn
    });
    await settleAsyncFlow();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(tick).not.toBeNull();
    tick!();
    await settleAsyncFlow();

    expect(sendOperation).toHaveBeenCalledTimes(1);
    expect(sendOperation).toHaveBeenCalledWith('Website.AuthorizeCustomer', {
      customer: {
        ids: {
          websiteID: '31'
        }
      }
    });
    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
  });
});
