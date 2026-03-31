import { describe, expect, it, vi } from 'vitest';
import { AUTHORIZE_CUSTOMER_OPERATION, AUTHORIZE_CUSTOMER_SESSION_KEY } from './constants';
import { resolveWebsiteId, startAuthorizeCustomerFlow } from './authorizeCustomerSender';
import type { JQueryDeferredLike, WidgetWindow } from './contracts';

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

describe('resolveWebsiteId', () => {
  it('uses phone first and then falls back to id', () => {
    expect(resolveWebsiteId({ phone: ' +7 (999) 111-22-33 ', id: 101 })).toBe('+79991112233');
    expect(resolveWebsiteId({ phone: ' ', id: 101 })).toBe('101');
    expect(resolveWebsiteId({ id: 202 })).toBe('202');
    expect(resolveWebsiteId(null)).toBe('');
  });
});

describe('startAuthorizeCustomerFlow', () => {
  it('sends authorize operation with normalized phone', async () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn(() => {
      return setInterval(() => undefined, 60_000);
    });
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
    startAuthorizeCustomerFlow({
      windowRef,
      stateRef,
      sendOperation,
      storage,
      setIntervalFn,
      clearIntervalFn
    });

    await Promise.resolve();

    expect(sendOperation).toHaveBeenCalledWith(AUTHORIZE_CUSTOMER_OPERATION, {
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

  it('falls back to id and does not send duplicate in session', async () => {
    const sendOperation = vi.fn();
    const storageMap = new Map<string, string>([[AUTHORIZE_CUSTOMER_SESSION_KEY, '88']]);
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
            get: () => createDeferred({ id: 88, phone: '' })
          }
        }
      }
    } as WidgetWindow;
    const stateRef = {};

    startAuthorizeCustomerFlow({
      windowRef,
      stateRef,
      sendOperation,
      storage,
      setIntervalFn: vi.fn(() => setInterval(() => undefined, 60_000)),
      clearIntervalFn: vi.fn()
    });
    await Promise.resolve();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(stateRef).toEqual({
      authorizeCustomerSent: true,
      lastAuthorizedWebsiteId: '88'
    });
  });

  it('does nothing when ajaxAPI is unavailable', () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn();
    startAuthorizeCustomerFlow({
      windowRef: {},
      stateRef: {},
      sendOperation,
      storage: undefined,
      setIntervalFn,
      clearIntervalFn: vi.fn()
    });

    expect(sendOperation).not.toHaveBeenCalled();
    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it('retries and eventually sends once customer appears', async () => {
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
      storage: undefined,
      setIntervalFn,
      clearIntervalFn
    });
    await Promise.resolve();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(tick).not.toBeNull();
    tick!();
    await Promise.resolve();

    expect(sendOperation).toHaveBeenCalledTimes(1);
    expect(sendOperation).toHaveBeenCalledWith(AUTHORIZE_CUSTOMER_OPERATION, {
      customer: {
        ids: {
          websiteID: '31'
        }
      }
    });
    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
  });
});
