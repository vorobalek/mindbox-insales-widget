import { expect, type Page } from '@playwright/test';

export const CART_EVENT = 'update_items:insales:cart:light';
export const FAVORITES_EVENT = 'update_items:insales:favorites_products';

const TRACKER_SCRIPT_URL = 'https://127.0.0.1/scripts/v1/tracker.js';
const ENTRYPOINT_URL = '/e2e/fixtures/blank.html';
const TRACKER_MOCK_SCRIPT_PATH = 'e2e/fixtures/tracker-mock.js';
const ENTRYPOINT_TEMPLATE_NAME = 'entrypoint-template';

export interface MindboxCall {
  command: string;
  payload?: {
    endpointId?: string;
    serviceWorkerPath?: string;
    serviceWorkerScope?: string;
    operation?: string;
    data?: unknown;
  };
}

export interface LiquidPageData {
  template?: 'index' | 'collection' | 'product';
  collectionId?: string | number | null;
  productId?: string | number | null;
  productPrice?: string | number | null;
  endpointId?: string | null;
  enableWebPush?: boolean | string | number | null;
  serviceWorkerPath?: string | null;
  serviceWorkerScope?: string | null;
  operations?: {
    viewCategory?: string | null;
    viewProduct?: string | null;
    setCart?: string | null;
    clearCart?: string | null;
    setWishList?: string | null;
    clearWishList?: string | null;
  };
}

interface LiquidRuntime {
  renderFile: (templateFile: string, scope: object) => Promise<string>;
}

let trackerMockScriptPromise: Promise<string> | null = null;
let liquidRuntimePromise: Promise<LiquidRuntime> | null = null;

const getTrackerMockScript = async (): Promise<string> => {
  if (!trackerMockScriptPromise) {
    trackerMockScriptPromise = (async () => {
      const [{ readFile }, { resolve }] = await Promise.all([import('node:fs/promises'), import('node:path')]);
      return readFile(resolve(process.cwd(), TRACKER_MOCK_SCRIPT_PATH), 'utf-8');
    })();
  }

  return trackerMockScriptPromise;
};

const getLiquidRuntime = async (): Promise<LiquidRuntime> => {
  if (!liquidRuntimePromise) {
    liquidRuntimePromise = (async () => {
      const [{ Liquid }, { resolve }] = await Promise.all([import('liquidjs'), import('node:path')]);
      const engine = new Liquid({
        root: [resolve(process.cwd(), 'e2e/fixtures'), resolve(process.cwd(), 'src/resources')],
        extname: '.liquid'
      });

      return {
        renderFile: (templateFile: string, scope: object) => {
          return engine.renderFile(templateFile, scope);
        }
      };
    })();
  }

  return liquidRuntimePromise;
};

const getLiquidScope = (pageData: LiquidPageData = {}) => {
  const template = pageData.template || 'index';
  const endpointId = pageData.endpointId === undefined ? 'test-endpoint-id' : pageData.endpointId;
  const enableWebPush = pageData.enableWebPush === undefined ? false : pageData.enableWebPush;
  const serviceWorkerPath =
    pageData.serviceWorkerPath === undefined ? '/mindbox-services-worker.js' : pageData.serviceWorkerPath;
  const serviceWorkerScope = pageData.serviceWorkerScope === undefined ? '/' : pageData.serviceWorkerScope;
  const operations = {
    viewCategory:
      pageData.operations && pageData.operations.viewCategory !== undefined
        ? pageData.operations.viewCategory
        : 'Website.ViewCategory',
    viewProduct:
      pageData.operations && pageData.operations.viewProduct !== undefined
        ? pageData.operations.viewProduct
        : 'Website.ViewProduct',
    setCart:
      pageData.operations && pageData.operations.setCart !== undefined
        ? pageData.operations.setCart
        : 'Website.SetCart',
    clearCart:
      pageData.operations && pageData.operations.clearCart !== undefined
        ? pageData.operations.clearCart
        : 'Website.ClearCart',
    setWishList:
      pageData.operations && pageData.operations.setWishList !== undefined
        ? pageData.operations.setWishList
        : 'Website.SetWishList',
    clearWishList:
      pageData.operations && pageData.operations.clearWishList !== undefined
        ? pageData.operations.clearWishList
        : 'Website.ClearWishList'
  };

  return {
    widget_settings: {
      api_domain: '127.0.0.1',
      endpoint_id: endpointId,
      external_system_name: 'website',
      enable_webpush_integration: enableWebPush,
      service_worker_path: serviceWorkerPath,
      service_worker_scope: serviceWorkerScope,
      operation_view_category: operations.viewCategory,
      operation_view_product: operations.viewProduct,
      operation_set_cart: operations.setCart,
      operation_clear_cart: operations.clearCart,
      operation_set_wishlist: operations.setWishList,
      operation_clear_wishlist: operations.clearWishList
    },
    template,
    collection:
      pageData.collectionId === undefined || pageData.collectionId === null ? null : { id: pageData.collectionId },
    product:
      pageData.productId === undefined || pageData.productId === null
        ? null
        : {
            id: pageData.productId,
            price: pageData.productPrice === undefined ? null : pageData.productPrice
          }
  };
};

const createEntrypointHtml = async (pageData: LiquidPageData = {}): Promise<string> => {
  const liquidRuntime = await getLiquidRuntime();
  return liquidRuntime.renderFile(ENTRYPOINT_TEMPLATE_NAME, getLiquidScope(pageData));
};

export const openWidgetPage = async (page: Page, pageData: LiquidPageData = {}): Promise<void> => {
  const [entrypointHtml, trackerMockScript] = await Promise.all([
    createEntrypointHtml(pageData),
    getTrackerMockScript()
  ]);

  await page.route(TRACKER_SCRIPT_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: trackerMockScript
    });
  });

  await page.goto(ENTRYPOINT_URL);
  await page.setContent(entrypointHtml, {
    waitUntil: 'domcontentloaded'
  });
};

export const getCalls = async (page: Page): Promise<MindboxCall[]> => {
  return page.evaluate(() => {
    return (window as Window & { __mindboxCalls?: MindboxCall[] }).__mindboxCalls || [];
  });
};

export const getAsyncCalls = async (page: Page): Promise<MindboxCall[]> => {
  const calls = await getCalls(page);
  return calls.filter((call) => call.command === 'async');
};

export const expectAsyncCallsCount = async (page: Page, count: number): Promise<void> => {
  await expect
    .poll(async () => {
      return (await getAsyncCalls(page)).length;
    })
    .toBe(count);
};

export const emitEvent = async (page: Page, eventName: string, payload: unknown): Promise<void> => {
  await page.evaluate(
    ({ name, body }) => {
      const emit = (window as Window & { __emitEventBus?: (eventName: string, payload: unknown) => void })
        .__emitEventBus;
      if (typeof emit === 'function') {
        emit(name, body);
      }
    },
    {
      name: eventName,
      body: payload
    }
  );
};
