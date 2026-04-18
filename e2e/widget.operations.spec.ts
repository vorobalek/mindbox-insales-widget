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

test('does not send duplicate setCart when cart payload is unchanged', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });
  const cartPayload = {
    order_lines: [
      {
        id: 'SKU-1',
        quantity: 2,
        sale_price: 99
      }
    ]
  };

  await emitEvent(page, CART_EVENT, cartPayload);
  await expectAsyncCallsCount(page, 1);

  await emitEvent(page, CART_EVENT, cartPayload);
  await expectAsyncCallsCount(page, 1);
});

test('does not send duplicate clearCart when cart stays empty', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });

  await emitEvent(page, CART_EVENT, { order_lines: [] });
  await expectAsyncCallsCount(page, 1);

  await emitEvent(page, CART_EVENT, { order_lines: [] });
  await expectAsyncCallsCount(page, 1);
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

test('does not send duplicate setWishList when favorites payload is unchanged', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });
  const favoritesPayload = {
    products: [
      {
        id: 789,
        price_min: 299
      }
    ]
  };

  await emitEvent(page, FAVORITES_EVENT, favoritesPayload);
  await expectAsyncCallsCount(page, 1);

  await emitEvent(page, FAVORITES_EVENT, favoritesPayload);
  await expectAsyncCallsCount(page, 1);
});

test('does not send duplicate clearWishList when favorites payload is unchanged', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index'
  });

  await emitEvent(page, FAVORITES_EVENT, { products: [] });
  await expectAsyncCallsCount(page, 1);

  await emitEvent(page, FAVORITES_EVENT, { products: [] });
  await expectAsyncCallsCount(page, 1);
});

test('sends Website.AuthorizeCustomer with phone mapped to customer.mobilePhone', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    customer: {
      id: 501,
      phone: '+7 (999) 111-22-33',
      authorized: true
    },
    authorizeCustomer: {
      enabled: true,
      sourcePath: 'phone',
      targetPath: 'customer.mobilePhone'
    }
  });

  await expectAsyncCallsCount(page, 1);
  const [authorizeCall] = await getAsyncCalls(page);
  expect(authorizeCall.payload && authorizeCall.payload.operation).toBe('Website.AuthorizeCustomer');
  expect(authorizeCall.payload && authorizeCall.payload.data).toEqual({
    customer: {
      mobilePhone: '+79991112233'
    }
  });
});

test('maps client id to customer.ids.websiteID when configured', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    customer: {
      id: 777,
      phone: '',
      authorized: true
    },
    authorizeCustomer: {
      enabled: true,
      sourcePath: 'id',
      targetPath: 'customer.ids.websiteID'
    }
  });

  await expectAsyncCallsCount(page, 1);
  const [authorizeCall] = await getAsyncCalls(page);
  expect(authorizeCall.payload && authorizeCall.payload.operation).toBe('Website.AuthorizeCustomer');
  expect(authorizeCall.payload && authorizeCall.payload.data).toEqual({
    customer: {
      ids: {
        websiteID: '777'
      }
    }
  });
});

test('maps multiple authorize path pairs into one operation payload', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    customer: {
      id: 888,
      phone: '+79990001122',
      authorized: true
    },
    authorizeCustomer: {
      enabled: true,
      sourcePath: 'id',
      targetPath: 'customer.ids.websiteID',
      sourcePath2: 'phone',
      targetPath2: 'customer.mobilePhone'
    }
  });

  await expectAsyncCallsCount(page, 1);
  const [authorizeCall] = await getAsyncCalls(page);
  expect(authorizeCall.payload && authorizeCall.payload.operation).toBe('Website.AuthorizeCustomer');
  expect(authorizeCall.payload && authorizeCall.payload.data).toEqual({
    customer: {
      ids: {
        websiteID: '888'
      },
      mobilePhone: '+79990001122'
    }
  });
});
