import { expect, test } from '@playwright/test';

import { expectAsyncCallsCount, getAsyncCalls, openWidgetPage, setCustomerData } from './support/widgetHarness';

test('does not send authorize operation when authorize customer is disabled by default', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    customer: {
      id: 501,
      phone: '+7 (999) 111-22-33',
      authorized: true
    }
  });

  await page.waitForTimeout(100);
  expect((await getAsyncCalls(page)).length).toBe(0);
});

test('does not send authorize operation when authorize operation name is empty', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    operations: {
      authorizeCustomer: null
    },
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

  await page.waitForTimeout(100);
  expect((await getAsyncCalls(page)).length).toBe(0);
});

test('does not send authorize operation when required authorize paths are empty', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    customer: {
      id: 501,
      phone: '+7 (999) 111-22-33',
      authorized: true
    },
    authorizeCustomer: {
      enabled: true
    }
  });

  await page.waitForTimeout(100);
  expect((await getAsyncCalls(page)).length).toBe(0);
});

test('retries until customer data becomes available after page load and stops after sending', async ({ page }) => {
  await openWidgetPage(page, {
    template: 'index',
    customer: {
      id: null,
      phone: null,
      authorized: false
    },
    authorizeCustomer: {
      enabled: true,
      sourcePath: 'phone',
      targetPath: 'customer.mobilePhone'
    }
  });

  await page.waitForTimeout(150);
  expect((await getAsyncCalls(page)).length).toBe(0);

  await setCustomerData(page, {
    id: 501,
    phone: '+7 (999) 111-22-33',
    authorized: true
  });

  await expectAsyncCallsCount(page, 1);

  const [authorizeCall] = await getAsyncCalls(page);
  expect(authorizeCall.payload && authorizeCall.payload.operation).toBe('Website.AuthorizeCustomer');
  expect(authorizeCall.payload && authorizeCall.payload.data).toEqual({
    customer: {
      mobilePhone: '+79991112233'
    }
  });

  await page.waitForTimeout(500);
  expect((await getAsyncCalls(page)).length).toBe(1);
});

test('does not send duplicate authorize operation for the same customer value within one browser session', async ({
  page
}) => {
  const pageData = {
    template: 'index' as const,
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
  };

  await openWidgetPage(page, pageData);
  await expectAsyncCallsCount(page, 1);

  await openWidgetPage(page, pageData);
  await page.waitForTimeout(100);
  expect((await getAsyncCalls(page)).length).toBe(0);
});

test('sends authorize operation again when customer value changes within one browser session', async ({ page }) => {
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

  await openWidgetPage(page, {
    template: 'index',
    customer: {
      id: 501,
      phone: '+7 (999) 111-22-44',
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
      mobilePhone: '+79991112244'
    }
  });
});
