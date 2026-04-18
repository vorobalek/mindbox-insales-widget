import {
  AUTHORIZE_CUSTOMER_RETRY_ATTEMPTS,
  AUTHORIZE_CUSTOMER_RETRY_DELAY_MS,
  AUTHORIZE_CUSTOMER_SESSION_KEY
} from './constants';
import { resolveAuthorizePathPairs } from './config';
import type { MindboxWidgetConfig, MindboxInSalesWidgetState, TimerLike } from './contracts';
import { formatAuthorizeSourceValue, getValueByPath, setValueByPath } from './pathUtils';
import type { SendOperation } from './operationSender';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

type InSalesClientGetter = () => unknown;

export interface AuthorizeCustomerSenderDeps extends TimerLike {
  getClient?: InSalesClientGetter;
  stateRef: MindboxInSalesWidgetState;
  sendOperation: SendOperation;
  getConfig: () => MindboxWidgetConfig | null;
  storage?: StorageLike;
}

interface DeferredLike {
  done?: (callback: (result: unknown) => void) => unknown;
  fail?: (callback: (error: unknown) => void) => unknown;
}

const getStoredDedupeValue = (storage: StorageLike | undefined): string => {
  if (!storage) {
    return '';
  }

  try {
    return storage.getItem(AUTHORIZE_CUSTOMER_SESSION_KEY) || '';
  } catch {
    return '';
  }
};

const saveStoredDedupeValue = (storage: StorageLike | undefined, value: string): void => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(AUTHORIZE_CUSTOMER_SESSION_KEY, value);
  } catch {
    // ignore
  }
};

const markAsSent = (stateRef: MindboxInSalesWidgetState, storage: StorageLike | undefined, dedupeKey: string): void => {
  stateRef.authorizeCustomerSent = true;
  stateRef.lastAuthorizedWebsiteId = dedupeKey;
  saveStoredDedupeValue(storage, dedupeKey);
};

const isDeferredLike = (input: unknown): input is DeferredLike => {
  if (!input || typeof input !== 'object') {
    return false;
  }

  const value = input as DeferredLike;
  return typeof value.done === 'function' || typeof value.fail === 'function';
};

const isPromiseLike = (input: unknown): input is Promise<unknown> => {
  if (!input || typeof input !== 'object') {
    return false;
  }

  return typeof (input as Promise<unknown>).then === 'function';
};

const getRawClientPayload = async (getClient: () => unknown): Promise<unknown | null> => {
  const result = getClient();
  if (isPromiseLike(result)) {
    return result;
  }

  if (!isDeferredLike(result)) {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (payload: unknown | null) => {
      if (!settled) {
        settled = true;
        resolve(payload);
      }
    };

    result.done?.((payload) => {
      finish(payload);
    });
    result.fail?.(() => {
      finish(null);
    });
  });
};

const sendAuthorizeCustomer = (
  stateRef: MindboxInSalesWidgetState,
  sendOperation: SendOperation,
  storage: StorageLike | undefined,
  operationName: string,
  data: Record<string, unknown>,
  dedupeKey: string
): boolean => {
  if (stateRef.authorizeCustomerSent && stateRef.lastAuthorizedWebsiteId === dedupeKey) {
    return true;
  }

  if (getStoredDedupeValue(storage) === dedupeKey) {
    markAsSent(stateRef, storage, dedupeKey);
    return true;
  }

  sendOperation(operationName, data);

  markAsSent(stateRef, storage, dedupeKey);
  return true;
};

const isAuthorizeConfigReady = (config: MindboxWidgetConfig | null): boolean => {
  if (!config || !config.authorizeCustomer?.enabled) {
    return false;
  }

  const operationName = config.operations && config.operations.authorizeCustomer;
  const pathPairs = resolveAuthorizePathPairs(config.authorizeCustomer);

  return Boolean(operationName && pathPairs.length > 0);
};

export const startAuthorizeCustomerFlow = (deps: AuthorizeCustomerSenderDeps): void => {
  const storage = deps.storage;
  const config = deps.getConfig();

  if (!isAuthorizeConfigReady(config)) {
    return;
  }

  const getClient = deps.getClient;
  if (typeof getClient !== 'function') {
    return;
  }

  const operationName = config!.operations!.authorizeCustomer!;
  const pathPairs = resolveAuthorizePathPairs(config!.authorizeCustomer);

  const trySend = async (): Promise<boolean> => {
    const raw = await getRawClientPayload(getClient);
    if (raw === null || raw === undefined) {
      return false;
    }

    const data: Record<string, unknown> = {};
    const dedupeParts: string[] = [];

    for (const pair of pathPairs) {
      const extracted = getValueByPath(raw, pair.sourcePath);
      const stringValue = formatAuthorizeSourceValue(extracted, pair.sourcePath);
      if (!stringValue) {
        continue;
      }
      setValueByPath(data, pair.targetPath, stringValue);
      dedupeParts.push(`${pair.targetPath}=${stringValue}`);
    }

    if (dedupeParts.length === 0) {
      return false;
    }

    const dedupeKey = dedupeParts.join('\u001e');
    return sendAuthorizeCustomer(deps.stateRef, deps.sendOperation, storage, operationName, data, dedupeKey);
  };

  void trySend().then((isSent) => {
    if (isSent) {
      return;
    }

    let attemptsLeft = AUTHORIZE_CUSTOMER_RETRY_ATTEMPTS;
    const timerId = deps.setIntervalFn(() => {
      attemptsLeft -= 1;
      void trySend().then((isSentOnRetry) => {
        if (isSentOnRetry || attemptsLeft <= 0) {
          deps.clearIntervalFn(timerId);
        }
      });
    }, AUTHORIZE_CUSTOMER_RETRY_DELAY_MS);
  });
};
