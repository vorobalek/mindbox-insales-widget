import { describe, expect, it, vi } from 'vitest';
import { AUTHORIZE_CUSTOMER_SESSION_KEY } from './constants';
import { startAuthorizeCustomerFlow } from './authorizeCustomerSender';
import type { MindboxWidgetConfig, JQueryDeferredLike } from './contracts';

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

const createGetClient = (result: unknown): (() => unknown) => {
  return () => result;
};

const settleAsyncFlow = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
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

    const getClient = createGetClient(createDeferred({ id: 15, phone: ' +7 (900) 000-00-01 ' }));

    const stateRef = {};
    const getConfig = vi.fn(() => baseAuthorizeConfig());

    startAuthorizeCustomerFlow({
      getClient,
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
      lastAuthorizedWebsiteId: 'customer.ids.websiteID=+79000000001'
    });
    expect(storageMap.get(AUTHORIZE_CUSTOMER_SESSION_KEY)).toBe('customer.ids.websiteID=+79000000001');
    expect(setIntervalFn).not.toHaveBeenCalled();
  });

  it('does not send duplicate when session storage matches dedupe key', async () => {
    const sendOperation = vi.fn();
    const storageMap = new Map<string, string>([
      [AUTHORIZE_CUSTOMER_SESSION_KEY, 'customer.ids.websiteID=+79000000001']
    ]);
    const storage = {
      getItem: (key: string) => storageMap.get(key) || null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value);
      }
    };
    const getClient = createGetClient(createDeferred({ id: 15, phone: '+79000000001' }));
    const stateRef = {};
    const getConfig = vi.fn(() => baseAuthorizeConfig());

    startAuthorizeCustomerFlow({
      getClient,
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
      lastAuthorizedWebsiteId: 'customer.ids.websiteID=+79000000001'
    });
  });

  it('does not send duplicate when state already contains matching dedupe key', async () => {
    const sendOperation = vi.fn();
    const stateRef = {
      authorizeCustomerSent: true,
      lastAuthorizedWebsiteId: 'customer.ids.websiteID=+79000000001'
    };

    startAuthorizeCustomerFlow({
      getClient: createGetClient(createDeferred({ id: 15, phone: '+79000000001' })),
      stateRef,
      sendOperation,
      getConfig: vi.fn(() => baseAuthorizeConfig()),
      storage: undefined,
      setIntervalFn: vi.fn(() => setInterval(() => undefined, 60_000)),
      clearIntervalFn: vi.fn()
    });

    await settleAsyncFlow();

    expect(sendOperation).not.toHaveBeenCalled();
  });

  it('sends authorize operation when reading dedupe key from storage throws', async () => {
    const sendOperation = vi.fn();
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('storage read failed');
      }),
      setItem: vi.fn()
    };

    startAuthorizeCustomerFlow({
      getClient: createGetClient(createDeferred({ id: 15, phone: '+79000000001' })),
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => baseAuthorizeConfig()),
      storage,
      setIntervalFn: vi.fn(() => setInterval(() => undefined, 60_000)),
      clearIntervalFn: vi.fn()
    });

    await settleAsyncFlow();

    expect(sendOperation).toHaveBeenCalledWith('Website.AuthorizeCustomer', {
      customer: {
        ids: {
          websiteID: '+79000000001'
        }
      }
    });
  });

  it('starts retry flow when customer getter returns a non-async primitive value', async () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn(() => setInterval(() => undefined, 60_000));

    startAuthorizeCustomerFlow({
      getClient: createGetClient(0),
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => baseAuthorizeConfig()),
      storage: undefined,
      setIntervalFn,
      clearIntervalFn: vi.fn()
    });

    await settleAsyncFlow();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(setIntervalFn).toHaveBeenCalledTimes(1);
  });

  it('accepts promise-like customer payloads', async () => {
    const sendOperation = vi.fn();

    startAuthorizeCustomerFlow({
      getClient: createGetClient(Promise.resolve({ id: 31 })),
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => ({
        ...baseAuthorizeConfig(),
        authorizeCustomer: {
          enabled: true,
          sourcePath: 'id',
          targetPath: 'customer.ids.websiteID'
        }
      })),
      storage: undefined,
      setIntervalFn: vi.fn(() => setInterval(() => undefined, 60_000)),
      clearIntervalFn: vi.fn()
    });

    await settleAsyncFlow();

    expect(sendOperation).toHaveBeenCalledWith('Website.AuthorizeCustomer', {
      customer: {
        ids: {
          websiteID: '31'
        }
      }
    });
  });

  it('starts retry flow when all extracted authorize values are empty after normalization', async () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn(() => setInterval(() => undefined, 60_000));

    startAuthorizeCustomerFlow({
      getClient: createGetClient(createDeferred({ phone: '   ' })),
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => baseAuthorizeConfig()),
      storage: undefined,
      setIntervalFn,
      clearIntervalFn: vi.fn()
    });

    await settleAsyncFlow();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(setIntervalFn).toHaveBeenCalledTimes(1);
  });

  it('keeps retry timer running while authorize payload is still unavailable', async () => {
    const sendOperation = vi.fn();
    let tick: (() => void) | null = null;
    const setIntervalFn = vi.fn((callback: () => void) => {
      tick = callback;
      return setInterval(() => undefined, 60_000);
    });
    const clearIntervalFn = vi.fn();

    startAuthorizeCustomerFlow({
      getClient: createGetClient(createDeferred({}, true)),
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => ({
        ...baseAuthorizeConfig(),
        authorizeCustomer: {
          enabled: true,
          sourcePath: 'id',
          targetPath: 'customer.ids.websiteID'
        }
      })),
      storage: undefined,
      setIntervalFn,
      clearIntervalFn
    });

    await settleAsyncFlow();
    expect(tick).not.toBeNull();

    tick!();
    await settleAsyncFlow();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(clearIntervalFn).not.toHaveBeenCalled();
  });

  it('treats fail-only deferred payloads as retryable misses', async () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn(() => setInterval(() => undefined, 60_000));

    startAuthorizeCustomerFlow({
      getClient: () => ({
        fail: (callback: (error: unknown) => void) => {
          callback(new Error('Not authorized'));
          return {};
        }
      }),
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => baseAuthorizeConfig()),
      storage: undefined,
      setIntervalFn,
      clearIntervalFn: vi.fn()
    });

    await settleAsyncFlow();

    expect(sendOperation).not.toHaveBeenCalled();
    expect(setIntervalFn).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated deferred completion after payload has already settled', async () => {
    const sendOperation = vi.fn();

    startAuthorizeCustomerFlow({
      getClient: () => ({
        done: (callback: (result: unknown) => void) => {
          callback({ id: 31 });
          return {
            fail: (failCallback: (error: unknown) => void) => {
              failCallback(new Error('late failure'));
              return {};
            }
          };
        },
        fail: (callback: (error: unknown) => void) => {
          callback(new Error('late failure'));
          return {};
        }
      }),
      stateRef: {},
      sendOperation,
      getConfig: vi.fn(() => ({
        ...baseAuthorizeConfig(),
        authorizeCustomer: {
          enabled: true,
          sourcePath: 'id',
          targetPath: 'customer.ids.websiteID'
        }
      })),
      storage: undefined,
      setIntervalFn: vi.fn(() => setInterval(() => undefined, 60_000)),
      clearIntervalFn: vi.fn()
    });

    await settleAsyncFlow();

    expect(sendOperation).toHaveBeenCalledWith('Website.AuthorizeCustomer', {
      customer: {
        ids: {
          websiteID: '31'
        }
      }
    });
  });

  it('merges multiple path pairs and uses composite dedupe key', async () => {
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

    const getClient = createGetClient(createDeferred({ id: 42, phone: ' +7 (900) 000-00-02 ' }));

    const stateRef = {};
    const getConfig = vi.fn(() => ({
      apiDomain: 'api.mindbox.ru',
      idKey: 'website',
      operations: { authorizeCustomer: 'Website.AuthorizeCustomer' },
      authorizeCustomer: {
        enabled: true,
        sourcePath: 'id',
        targetPath: 'customer.ids.websiteID',
        sourcePath2: 'phone',
        targetPath2: 'customer.mobilePhone'
      }
    }));

    startAuthorizeCustomerFlow({
      getClient,
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
        ids: { websiteID: '42' },
        mobilePhone: '+79000000002'
      }
    });
    expect(stateRef).toMatchObject({
      authorizeCustomerSent: true,
      lastAuthorizedWebsiteId: 'customer.ids.websiteID=42\u001ecustomer.mobilePhone=+79000000002'
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
      getClient: createGetClient(createDeferred({ phone: '1' })),
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
      getClient: createGetClient(createDeferred({ phone: '1' })),
      stateRef: {},
      sendOperation,
      getConfig,
      storage: undefined,
      setIntervalFn: vi.fn(),
      clearIntervalFn: vi.fn()
    });

    expect(sendOperation).not.toHaveBeenCalled();
  });

  it('does nothing when customer getter is unavailable', () => {
    const sendOperation = vi.fn();
    const setIntervalFn = vi.fn();
    startAuthorizeCustomerFlow({
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
      getClient: get,
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
