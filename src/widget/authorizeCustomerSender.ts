import {
  AUTHORIZE_CUSTOMER_OPERATION,
  AUTHORIZE_CUSTOMER_RETRY_ATTEMPTS,
  AUTHORIZE_CUSTOMER_RETRY_DELAY_MS,
  AUTHORIZE_CUSTOMER_SESSION_KEY
} from './constants';
import type { InSalesClient, MindboxInSalesWidgetState, TimerLike, WidgetWindow } from './contracts';
import type { SendOperation } from './operationSender';

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface AuthorizeCustomerSenderDeps extends TimerLike {
  windowRef: WidgetWindow;
  stateRef: MindboxInSalesWidgetState;
  sendOperation: SendOperation;
  storage?: StorageLike;
}

interface DeferredLike {
  done?: (callback: (result: unknown) => void) => unknown;
  fail?: (callback: (error: unknown) => void) => unknown;
}

const normalizePhone = (phone: string): string => {
  return phone.replace(/[^\d+]/g, '');
};

const extractClient = (input: unknown): InSalesClient | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const root = input as Record<string, unknown>;
  if ('id' in root || 'phone' in root) {
    return root as InSalesClient;
  }

  if ('client' in root && root.client && typeof root.client === 'object') {
    return root.client as InSalesClient;
  }

  return null;
};

export const resolveWebsiteId = (client: InSalesClient | null): string => {
  if (!client) {
    return '';
  }

  const normalizedPhone = typeof client.phone === 'string' ? normalizePhone(client.phone.trim()) : '';
  if (normalizedPhone !== '') {
    return normalizedPhone;
  }

  if (client.id !== undefined && client.id !== null) {
    return String(client.id).trim();
  }

  return '';
};

const getStoredWebsiteId = (storage: StorageLike | undefined): string => {
  if (!storage) {
    return '';
  }

  try {
    return storage.getItem(AUTHORIZE_CUSTOMER_SESSION_KEY) || '';
  } catch {
    return '';
  }
};

const saveStoredWebsiteId = (storage: StorageLike | undefined, websiteId: string): void => {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(AUTHORIZE_CUSTOMER_SESSION_KEY, websiteId);
  } catch {
    // ignore
  }
};

const markAsSent = (stateRef: MindboxInSalesWidgetState, storage: StorageLike | undefined, websiteId: string): void => {
  stateRef.authorizeCustomerSent = true;
  stateRef.lastAuthorizedWebsiteId = websiteId;
  saveStoredWebsiteId(storage, websiteId);
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

const getClientFromAjaxApi = async (windowRef: WidgetWindow): Promise<InSalesClient | null> => {
  const getClient = windowRef.ajaxAPI?.shop?.client?.get;
  if (typeof getClient !== 'function') {
    return null;
  }

  const result = getClient();
  if (isPromiseLike(result)) {
    const resolved = await result;
    return extractClient(resolved);
  }

  if (!isDeferredLike(result)) {
    return null;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (value: InSalesClient | null) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    result.done?.((payload) => {
      safeResolve(extractClient(payload));
    });
    result.fail?.(() => {
      safeResolve(null);
    });
  });
};

const sendAuthorizeCustomer = (
  stateRef: MindboxInSalesWidgetState,
  sendOperation: SendOperation,
  storage: StorageLike | undefined,
  websiteId: string
): boolean => {
  if (!websiteId) {
    return false;
  }

  if (stateRef.authorizeCustomerSent && stateRef.lastAuthorizedWebsiteId === websiteId) {
    return true;
  }

  if (getStoredWebsiteId(storage) === websiteId) {
    markAsSent(stateRef, storage, websiteId);
    return true;
  }

  sendOperation(AUTHORIZE_CUSTOMER_OPERATION, {
    customer: {
      ids: {
        websiteID: websiteId
      }
    }
  });

  markAsSent(stateRef, storage, websiteId);
  return true;
};

export const startAuthorizeCustomerFlow = (deps: AuthorizeCustomerSenderDeps): void => {
  const storage = deps.storage;
  const hasClientGetter = typeof deps.windowRef.ajaxAPI?.shop?.client?.get === 'function';

  if (!hasClientGetter) {
    return;
  }

  const trySend = async (): Promise<boolean> => {
    const client = await getClientFromAjaxApi(deps.windowRef);
    const websiteId = resolveWebsiteId(client);
    return sendAuthorizeCustomer(deps.stateRef, deps.sendOperation, storage, websiteId);
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
