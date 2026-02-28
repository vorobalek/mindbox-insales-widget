import { expect, test } from '@playwright/test';

import {
  CART_EVENT,
  FAVORITES_EVENT,
  emitEvent,
  expectAsyncCallsCount,
  getAsyncCalls,
  openWidgetPage
} from './support/widgetHarness';

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
