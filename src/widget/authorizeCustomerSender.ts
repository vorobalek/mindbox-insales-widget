import {
  AUTHORIZE_CUSTOMER_RETRY_ATTEMPTS,
  AUTHORIZE_CUSTOMER_RETRY_DELAY_MS,
  AUTHORIZE_CUSTOMER_SESSION_KEY
} from './constants';
import type { MindboxWidgetConfig, MindboxInSalesWidgetState, TimerLike, WidgetWindow } from './contracts';
import { formatAuthorizeSourceValue, getValueByPath, setValueByPath } from './pathUtils';
import type { SendOperation } from './operationSender';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface AuthorizeCustomerSenderDeps extends TimerLike {
  windowRef: WidgetWindow;
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

const getRawClientPayload = async (windowRef: WidgetWindow): Promise<unknown | null> => {
  const getClient = windowRef.ajaxAPI?.shop?.client?.get;
  if (typeof getClient !== 'function') {
    return null;
  }

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
  if (!dedupeKey) {
    return false;
  }

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
  const sourcePath = config.authorizeCustomer.sourcePath || '';
  const targetPath = config.authorizeCustomer.targetPath || '';

  return Boolean(operationName && sourcePath && targetPath);
};

export const startAuthorizeCustomerFlow = (deps: AuthorizeCustomerSenderDeps): void => {
  const storage = deps.storage;
  const config = deps.getConfig();

  if (!isAuthorizeConfigReady(config)) {
    return;
  }

  const hasClientGetter = typeof deps.windowRef.ajaxAPI?.shop?.client?.get === 'function';
  if (!hasClientGetter) {
    return;
  }

  const operationName = config!.operations!.authorizeCustomer!;
  const sourcePath = config!.authorizeCustomer!.sourcePath!;
  const targetPath = config!.authorizeCustomer!.targetPath!;

  const trySend = async (): Promise<boolean> => {
    const raw = await getRawClientPayload(deps.windowRef);
    if (raw === null || raw === undefined) {
      return false;
    }

    const extracted = getValueByPath(raw, sourcePath);
    const stringValue = formatAuthorizeSourceValue(extracted, sourcePath);
    if (!stringValue) {
      return false;
    }

    const data = setValueByPath({}, targetPath, stringValue);
    return sendAuthorizeCustomer(deps.stateRef, deps.sendOperation, storage, operationName, data, stringValue);
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
