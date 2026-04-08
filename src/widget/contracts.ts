export interface MindboxOperations {
  viewCategory?: string;
  viewProduct?: string;
  setWishList?: string;
  clearWishList?: string;
  setCart?: string;
  clearCart?: string;
  authorizeCustomer?: string;
}

export interface MindboxWidgetPage {
  template?: string;
  collectionId?: string | number | null;
  productId?: string | number | null;
  productPrice?: string | number | null;
}

export interface AuthorizeCustomerPathPair {
  sourcePath: string;
  targetPath: string;
}

export interface MindboxWidgetAuthorizeCustomer {
  enabled?: boolean | string | number;
  sourcePath?: string;
  targetPath?: string;
  sourcePath2?: string;
  targetPath2?: string;
  sourcePath3?: string;
  targetPath3?: string;
  pathPairs?: AuthorizeCustomerPathPair[];
}

export interface MindboxWidgetConfig {
  apiDomain?: string;
  isValid?: boolean;
  missingSettings?: string[];
  idKey?: string;
  operations?: MindboxOperations;
  authorizeCustomer?: MindboxWidgetAuthorizeCustomer;
  page?: MindboxWidgetPage;
}
export interface MindboxFunction {
  (command: string, payload: unknown): void;
}

export interface EventBusLike {
  subscribe: (eventName: string, handler: (data: unknown) => void) => void;
}

export interface FavoritesProduct {
  id: string | number;
  price_min: string | number | null;
}

export interface FavoritesEventData {
  products?: FavoritesProduct[];
}

export interface CartOrderLine {
  id: string | number;
  quantity: number;
  sale_price: string | number | null;
}

export interface CartEventData {
  order_lines?: CartOrderLine[];
}

export interface ConsoleLike {
  error: (...args: unknown[]) => void;
}

export interface MindboxInSalesWidgetState {
  eventsBound?: boolean;
  configErrorLogged?: boolean;
  missingSettingsLogged?: boolean;
  collectionViewSent?: boolean;
  productViewSent?: boolean;
  authorizeCustomerSent?: boolean;
  lastAuthorizedWebsiteId?: string;
  lastCartSyncFingerprint?: string;
  lastWishlistSyncFingerprint?: string;
}

export interface MindboxInSalesWidgetGlobal {
  config?: MindboxWidgetConfig;
  state?: MindboxInSalesWidgetState;
  init?: () => Promise<void>;
  initPromise?: Promise<void>;
}

export interface WidgetWindow {
  __mindboxInSalesWidget?: MindboxInSalesWidgetGlobal;
  mindbox?: MindboxFunction;
  ajaxAPI?: InSalesAjaxApi;
}

export interface TimerLike {
  setIntervalFn: (callback: () => void, delayMs: number) => ReturnType<typeof setInterval>;
  clearIntervalFn: (timerId: ReturnType<typeof setInterval>) => void;
}

export type ConfigErrorLogger = (message: string, details?: string) => void;

export interface InSalesClient {
  id?: string | number | null;
  phone?: string | null;
}

export interface JQueryDeferredLike<T> {
  done: (callback: (result: T) => void) => JQueryDeferredLike<T>;
  fail: (callback: (error: unknown) => void) => JQueryDeferredLike<T>;
}

export interface InSalesAjaxApi {
  shop?: {
    client?: {
      get?: () => JQueryDeferredLike<unknown> | Promise<unknown>;
    };
  };
}

declare global {
  interface Window extends WidgetWindow {}
}
