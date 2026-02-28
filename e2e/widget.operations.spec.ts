import { expect, test } from '@playwright/test';

import {
  CART_EVENT,
  FAVORITES_EVENT,
  emitEvent,
  expectAsyncCallsCount,
  getAsyncCalls,
  openWidgetPage
} from './support/widgetHarness';

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
