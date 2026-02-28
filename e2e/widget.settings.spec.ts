import { expect, test } from '@playwright/test';

import {
  CART_EVENT,
  FAVORITES_EVENT,
  emitEvent,
  expectAsyncCallsCount,
  getAsyncCalls,
  getCalls,
  openWidgetPage
} from './support/widgetHarness';

test('injects and executes rendered snippet.liquid in head', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });

  await expect
    .poll(async () => {
      return (await getCalls(page)).map((call) => call.command);
    })
    .toEqual(expect.arrayContaining(['create']));
  expect((await getCalls(page)).map((call) => call.command)).not.toContain('webpush.create');
});

test('runs webpush.create when web-push integration is enabled', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    enableWebPush: true
  });

  await expect
    .poll(async () => {
      return (await getCalls(page)).map((call) => call.command);
    })
    .toEqual(expect.arrayContaining(['create', 'webpush.create']));
});

test('maps service worker options into create only when they are not empty', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    serviceWorkerPath: '/custom-sw.js',
    serviceWorkerScope: '/custom/'
  });

  let createCall = (await getCalls(page)).find((call) => call.command === 'create');
  expect(createCall && createCall.payload).toEqual({
    endpointId: 'test-endpoint-id',
    serviceWorkerPath: '/custom-sw.js',
    serviceWorkerScope: '/custom/'
  });

  await openWidgetPage(page, {
    template: 'index',
    serviceWorkerPath: '',
    serviceWorkerScope: '   '
  });

  createCall = (await getCalls(page)).find((call) => call.command === 'create');
  expect(createCall && createCall.payload).toEqual({
    endpointId: 'test-endpoint-id'
  });

  await openWidgetPage(page, {
    template: 'index',
    serviceWorkerPath: '/custom-sw.js',
    serviceWorkerScope: ''
  });

  createCall = (await getCalls(page)).find((call) => call.command === 'create');
  expect(createCall && createCall.payload).toEqual({
    endpointId: 'test-endpoint-id',
    serviceWorkerPath: '/custom-sw.js'
  });

  await openWidgetPage(page, {
    template: 'index',
    serviceWorkerPath: '',
    serviceWorkerScope: '/custom/'
  });

  createCall = (await getCalls(page)).find((call) => call.command === 'create');
  expect(createCall && createCall.payload).toEqual({
    endpointId: 'test-endpoint-id',
    serviceWorkerScope: '/custom/'
  });
});

test('keeps all scenarios working without endpointId', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'collection',
    collectionId: 42,
    endpointId: null,
    serviceWorkerPath: null,
    serviceWorkerScope: null
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
