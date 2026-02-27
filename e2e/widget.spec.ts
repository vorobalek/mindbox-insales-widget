import { expect, test, type Page } from '@playwright/test';

const CART_EVENT = 'update_items:insales:cart:light';
const FAVORITES_EVENT = 'update_items:insales:favorites_products';
const TRACKER_SCRIPT_URL = 'https://127.0.0.1/scripts/v1/tracker.js';
const ENTRYPOINT_URL = '/e2e/fixtures/blank.html';
const TRACKER_MOCK_SCRIPT_PATH = 'e2e/fixtures/tracker-mock.js';
const ENTRYPOINT_TEMPLATE_NAME = 'entrypoint-template';

interface MindboxCall {
  command: string;
  payload?: {
    operation?: string;
    data?: unknown;
  };
}

interface LiquidPageData {
  template?: 'index' | 'collection' | 'product';
  collectionId?: string | number | null;
  productId?: string | number | null;
  productPrice?: string | number | null;
  endpointId?: string | null;
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

const openWidgetPage = async (page: Page, pageData: LiquidPageData = {}): Promise<void> => {
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

const getCalls = async (page: Page): Promise<MindboxCall[]> => {
  return page.evaluate(() => {
    return (window as Window & { __mindboxCalls?: MindboxCall[] }).__mindboxCalls || [];
  });
};

const getAsyncCalls = async (page: Page): Promise<MindboxCall[]> => {
  const calls = await getCalls(page);
  return calls.filter((call) => call.command === 'async');
};

const expectAsyncCallsCount = async (page: Page, count: number): Promise<void> => {
  await expect
    .poll(async () => {
      return (await getAsyncCalls(page)).length;
    })
    .toBe(count);
};

const emitEvent = async (page: Page, eventName: string, payload: unknown): Promise<void> => {
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

test('injects and executes rendered snippet.liquid in head', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });

  await expect
    .poll(async () => {
      return (await getCalls(page)).map((call) => call.command);
    })
    .toEqual(expect.arrayContaining(['create', 'webpush.create']));
});

test('sends viewCategory operation on collection page', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'collection',
    collectionId: 42
  });

  await expectAsyncCallsCount(page, 1);

  const [call] = await getAsyncCalls(page);
  expect(call.payload && call.payload.operation).toBe('Website.ViewCategory');
  expect(call.payload && call.payload.data).toEqual({
    viewProductCategory: {
      productCategory: {
        ids: {
          website: '42'
        }
      }
    }
  });
});

test('sends viewProduct operation on product page', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'product',
    productId: 123,
    productPrice: 1499
  });

  await expectAsyncCallsCount(page, 1);

  const [call] = await getAsyncCalls(page);
  expect(call.payload && call.payload.operation).toBe('Website.ViewProduct');
  expect(call.payload && call.payload.data).toEqual({
    viewProduct: {
      price: '1499',
      productGroup: {
        ids: {
          website: '123'
        }
      }
    }
  });
});

test('sends setCart and clearCart operations for cart updates', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });
  expect((await getAsyncCalls(page)).length).toBe(0);

  await emitEvent(page, CART_EVENT, {
    order_lines: [
      {
        id: 'SKU-1',
        quantity: 2,
        sale_price: 99
      }
    ]
  });

  await expectAsyncCallsCount(page, 1);

  const [setCartCall] = await getAsyncCalls(page);
  expect(setCartCall.payload && setCartCall.payload.operation).toBe('Website.SetCart');
  expect(setCartCall.payload && setCartCall.payload.data).toEqual({
    productList: [
      {
        count: 2,
        pricePerItem: 99,
        product: {
          ids: {
            website: 'SKU-1'
          }
        }
      }
    ]
  });

  await emitEvent(page, CART_EVENT, { order_lines: [] });
  await expectAsyncCallsCount(page, 2);

  const asyncCalls = await getAsyncCalls(page);
  const clearCartCall = asyncCalls[1];
  expect(clearCartCall.payload && clearCartCall.payload.operation).toBe('Website.ClearCart');
  expect(clearCartCall.payload && clearCartCall.payload.data).toEqual({});
});

test('sends setWishList and clearWishList operations', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });
  expect((await getAsyncCalls(page)).length).toBe(0);

  await emitEvent(page, FAVORITES_EVENT, {
    products: [
      {
        id: 789,
        price_min: 299
      }
    ]
  });

  await expectAsyncCallsCount(page, 1);

  const [setWishListCall] = await getAsyncCalls(page);
  expect(setWishListCall.payload && setWishListCall.payload.operation).toBe('Website.SetWishList');
  expect(setWishListCall.payload && setWishListCall.payload.data).toEqual({
    productList: [
      {
        count: 1,
        pricePerItem: 299,
        productGroup: {
          ids: {
            website: '789'
          }
        }
      }
    ]
  });

  await emitEvent(page, FAVORITES_EVENT, { products: [] });
  await expectAsyncCallsCount(page, 2);

  const asyncCalls = await getAsyncCalls(page);
  const clearWishListCall = asyncCalls[1];
  expect(clearWishListCall.payload && clearWishListCall.payload.operation).toBe('Website.ClearWishList');
  expect(clearWishListCall.payload && clearWishListCall.payload.data).toEqual({});
});

test('falls back to set operations when clear operations are empty', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    operations: {
      clearCart: null,
      clearWishList: null
    }
  });
  expect((await getAsyncCalls(page)).length).toBe(0);

  await emitEvent(page, CART_EVENT, { order_lines: [] });
  await expectAsyncCallsCount(page, 1);

  await emitEvent(page, FAVORITES_EVENT, { products: [] });
  await expectAsyncCallsCount(page, 2);

  const asyncCalls = await getAsyncCalls(page);
  expect(asyncCalls).toHaveLength(2);
  const [setCartFallbackCall, setWishListFallbackCall] = asyncCalls;
  expect(setCartFallbackCall!.payload && setCartFallbackCall!.payload.operation).toBe('Website.SetCart');
  expect(setCartFallbackCall!.payload && setCartFallbackCall!.payload.data).toEqual({
    productList: []
  });

  expect(setWishListFallbackCall!.payload && setWishListFallbackCall!.payload.operation).toBe('Website.SetWishList');
  expect(setWishListFallbackCall!.payload && setWishListFallbackCall!.payload.data).toEqual({
    productList: []
  });
});

test('does not send wishlist operations when wishlist operations are empty', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    operations: {
      setWishList: null,
      clearWishList: null
    }
  });
  expect((await getAsyncCalls(page)).length).toBe(0);

  await emitEvent(page, FAVORITES_EVENT, {
    products: [
      {
        id: 111,
        price_min: 555
      }
    ]
  });

  await page.waitForTimeout(100);
  expect((await getAsyncCalls(page)).length).toBe(0);
});

test('does not send any events when all operations are empty', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'collection',
    collectionId: 42,
    operations: {
      viewCategory: null,
      viewProduct: null,
      setCart: null,
      clearCart: null,
      setWishList: null,
      clearWishList: null
    }
  });

  expect((await getAsyncCalls(page)).length).toBe(0);

  await emitEvent(page, CART_EVENT, {
    order_lines: [
      {
        id: 'SKU-1',
        quantity: 2,
        sale_price: 99
      }
    ]
  });
  await emitEvent(page, CART_EVENT, { order_lines: [] });
  await emitEvent(page, FAVORITES_EVENT, {
    products: [{ id: 123, price_min: 200 }]
  });
  await emitEvent(page, FAVORITES_EVENT, { products: [] });

  await page.waitForTimeout(100);
  expect((await getAsyncCalls(page)).length).toBe(0);
});

test('keeps all scenarios working without endpointId', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'collection',
    collectionId: 42,
    endpointId: null
  });

  const collectionCalls = await getCalls(page);
  const createCall = collectionCalls.find((call) => call.command === 'create');
  expect(createCall && createCall.payload).toEqual({});

  await expectAsyncCallsCount(page, 1);
  const [viewCategoryCall] = await getAsyncCalls(page);
  expect(viewCategoryCall.payload && viewCategoryCall.payload.operation).toBe('Website.ViewCategory');

  await openWidgetPage(page, {
    template: 'product',
    productId: 123,
    productPrice: 1499,
    endpointId: null
  });

  await expectAsyncCallsCount(page, 1);
  const [viewProductCall] = await getAsyncCalls(page);
  expect(viewProductCall.payload && viewProductCall.payload.operation).toBe('Website.ViewProduct');

  await openWidgetPage(page, {
    template: 'index',
    endpointId: null
  });

  expect((await getAsyncCalls(page)).length).toBe(0);

  await emitEvent(page, CART_EVENT, {
    order_lines: [
      {
        id: 'SKU-1',
        quantity: 2,
        sale_price: 99
      }
    ]
  });
  await expectAsyncCallsCount(page, 1);

  await emitEvent(page, CART_EVENT, { order_lines: [] });
  await expectAsyncCallsCount(page, 2);

  await emitEvent(page, FAVORITES_EVENT, {
    products: [
      {
        id: 789,
        price_min: 299
      }
    ]
  });
  await expectAsyncCallsCount(page, 3);

  await emitEvent(page, FAVORITES_EVENT, { products: [] });
  await expectAsyncCallsCount(page, 4);

  const operations = (await getAsyncCalls(page)).map((call) => call.payload && call.payload.operation);
  expect(operations).toEqual(['Website.SetCart', 'Website.ClearCart', 'Website.SetWishList', 'Website.ClearWishList']);
});
