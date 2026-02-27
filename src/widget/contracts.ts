export interface MindboxOperations {
  viewCategory?: string;
  viewProduct?: string;
  setWishList?: string;
  clearWishList?: string;
  setCart?: string;
  clearCart?: string;
}

export interface MindboxWidgetPage {
  template?: string;
  collectionId?: string | number | null;
  productId?: string | number | null;
  productPrice?: string | number | null;
}

export interface MindboxWidgetConfig {
  apiDomain?: string;
  isValid?: boolean;
  missingSettings?: string[];
  idKey?: string;
  operations?: MindboxOperations;
  page?: MindboxWidgetPage;
}

export interface MindboxCommandPayload {
  operation: string;
  data: unknown;
  onSuccess: () => void;
  onError: (error: unknown) => void;
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
}

export interface TimerLike {
  setIntervalFn: (callback: () => void, delayMs: number) => ReturnType<typeof setInterval>;
  clearIntervalFn: (timerId: ReturnType<typeof setInterval>) => void;
}

export type ConfigErrorLogger = (message: string, details?: string) => void;

declare global {
  interface Window extends WidgetWindow {}
}
