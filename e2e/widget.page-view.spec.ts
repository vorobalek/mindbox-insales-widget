import { expect, test } from '@playwright/test';

import { expectAsyncCallsCount, getAsyncCalls, openWidgetPage } from './support/widgetHarness';

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
