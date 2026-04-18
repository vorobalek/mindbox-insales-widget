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

export interface MindboxConsoleLog {
  level: string;
  args: unknown[];
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
    authorizeCustomer?: string | null;
  };
  authorizeCustomer?: {
    enabled?: boolean;
    sourcePath?: string;
    targetPath?: string;
    sourcePath2?: string;
    targetPath2?: string;
    sourcePath3?: string;
    targetPath3?: string;
    operationName?: string | null;
  };
  customer?: WidgetCustomerData;
}

export interface WidgetCustomerData {
  id?: string | number | null;
  phone?: string | null;
  authorized?: boolean;
}

interface E2eDebugWindow extends Window {
  __emitEventBus?: (eventName: string, payload: unknown) => void;
  __mindboxCalls?: MindboxCall[];
  __mindboxConsoleLogs?: MindboxConsoleLog[];
  __setCustomerData?: (customerData: WidgetCustomerData) => void;
  __updateE2eDebugBlocks?: () => void;
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
        : 'Website.ClearWishList',
    authorizeCustomer:
      pageData.operations && pageData.operations.authorizeCustomer !== undefined
        ? pageData.operations.authorizeCustomer
        : 'Website.AuthorizeCustomer'
  };

  const authorizeEnabled = pageData.authorizeCustomer && pageData.authorizeCustomer.enabled === true;
  const authorizeSourcePath =
    pageData.authorizeCustomer && pageData.authorizeCustomer.sourcePath !== undefined
      ? pageData.authorizeCustomer.sourcePath
      : '';
  const authorizeTargetPath =
    pageData.authorizeCustomer && pageData.authorizeCustomer.targetPath !== undefined
      ? pageData.authorizeCustomer.targetPath
      : '';
  const authorizeSourcePath2 =
    pageData.authorizeCustomer && pageData.authorizeCustomer.sourcePath2 !== undefined
      ? pageData.authorizeCustomer.sourcePath2
      : '';
  const authorizeTargetPath2 =
    pageData.authorizeCustomer && pageData.authorizeCustomer.targetPath2 !== undefined
      ? pageData.authorizeCustomer.targetPath2
      : '';
  const authorizeSourcePath3 =
    pageData.authorizeCustomer && pageData.authorizeCustomer.sourcePath3 !== undefined
      ? pageData.authorizeCustomer.sourcePath3
      : '';
  const authorizeTargetPath3 =
    pageData.authorizeCustomer && pageData.authorizeCustomer.targetPath3 !== undefined
      ? pageData.authorizeCustomer.targetPath3
      : '';
  const operationAuthorizeCustomer = pageData.authorizeCustomer?.operationName ?? operations.authorizeCustomer;

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
      operation_clear_wishlist: operations.clearWishList,
      operation_authorize_customer: operationAuthorizeCustomer,
      enable_authorize_customer: authorizeEnabled,
      authorize_customer_source_path: authorizeSourcePath,
      authorize_customer_target_path: authorizeTargetPath,
      authorize_customer_source_path_2: authorizeSourcePath2,
      authorize_customer_target_path_2: authorizeTargetPath2,
      authorize_customer_source_path_3: authorizeSourcePath3,
      authorize_customer_target_path_3: authorizeTargetPath3
    },
    customer_data: {
      id: pageData.customer && pageData.customer.id !== undefined ? pageData.customer.id : null,
      phone: pageData.customer && pageData.customer.phone !== undefined ? pageData.customer.phone : null,
      authorized: pageData.customer && pageData.customer.authorized !== undefined ? pageData.customer.authorized : false
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

const attachDebugDashboard = async (page: Page, renderedHtml: string): Promise<void> => {
  await page.evaluate((html) => {
    const dashboardId = '__e2e-debug-dashboard';
    const body = document.body || document.documentElement;
    const debugWindow = window as E2eDebugWindow;

    const stringifyDebugData = (value: unknown): string => {
      const seenObjects: unknown[] = [];
      return JSON.stringify(
        value,
        (_key, currentValue) => {
          if (typeof currentValue === 'undefined') {
            return '[undefined]';
          }

          if (typeof currentValue === 'function') {
            return `[function ${currentValue.name || 'anonymous'}]`;
          }

          if (typeof currentValue === 'symbol') {
            return currentValue.toString();
          }

          if (currentValue instanceof Error) {
            return {
              name: currentValue.name,
              message: currentValue.message,
              stack: currentValue.stack
            };
          }

          if (currentValue && typeof currentValue === 'object') {
            if (seenObjects.includes(currentValue)) {
              return '[Circular]';
            }
            seenObjects.push(currentValue);
          }

          return currentValue;
        },
        2
      );
    };

    const createDebugSection = (
      root: HTMLElement,
      sectionId: string,
      title: string,
      initialContent: string
    ): HTMLCodeElement => {
      let section = document.getElementById(sectionId) as HTMLDetailsElement | null;
      if (!section) {
        section = document.createElement('details');
        section.id = sectionId;
        section.open = true;
        section.style.border = '1px solid #d1d5db';
        section.style.borderRadius = '8px';
        section.style.background = '#f8fafc';
        section.style.boxSizing = 'border-box';
        section.style.overflow = 'hidden';

        const summary = document.createElement('summary');
        summary.textContent = title;
        summary.style.cursor = 'pointer';
        summary.style.fontWeight = '600';
        summary.style.padding = '8px 10px';
        summary.style.background = '#e5eefb';

        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.padding = '10px';
        pre.style.maxHeight = '24vh';
        pre.style.overflow = 'auto';
        pre.style.background = '#ffffff';
        pre.style.borderTop = '1px solid #d1d5db';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.wordBreak = 'break-word';

        const code = document.createElement('code');
        code.dataset.debugCode = 'true';
        pre.append(code);
        section.append(summary, pre);
        root.append(section);
      }

      const codeElement = section.querySelector('[data-debug-code="true"]') as HTMLCodeElement | null;
      if (!codeElement) {
        throw new Error(`Missing debug code element for ${sectionId}`);
      }

      codeElement.textContent = initialContent;
      return codeElement;
    };

    let dashboard = document.getElementById(dashboardId) as HTMLElement | null;
    if (!dashboard) {
      dashboard = document.createElement('aside');
      dashboard.id = dashboardId;
      dashboard.style.position = 'fixed';
      dashboard.style.inset = '0';
      dashboard.style.padding = '12px';
      dashboard.style.display = 'flex';
      dashboard.style.flexDirection = 'column';
      dashboard.style.gap = '8px';
      dashboard.style.overflow = 'auto';
      dashboard.style.maxHeight = '100vh';
      dashboard.style.zIndex = '2147483647';
      dashboard.style.boxSizing = 'border-box';
      dashboard.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      dashboard.style.background = 'rgba(248, 250, 252, 0.96)';
      dashboard.style.border = '0';
      dashboard.style.borderRadius = '0';
      dashboard.style.boxShadow = '0 12px 32px rgba(15, 23, 42, 0.18)';
      body.prepend(dashboard);
    }

    const renderedHtmlCode = createDebugSection(dashboard, '__e2e-rendered-html-debug', 'Rendered Page HTML', html);
    const mindboxCallsCode = createDebugSection(
      dashboard,
      '__e2e-mindbox-calls-debug',
      'Mocked Mindbox Calls',
      stringifyDebugData(debugWindow.__mindboxCalls || [])
    );
    const consoleLogsCode = createDebugSection(
      dashboard,
      '__e2e-console-logs-debug',
      'Widget Console Logs',
      stringifyDebugData(debugWindow.__mindboxConsoleLogs || [])
    );

    renderedHtmlCode.textContent = html;
    debugWindow.__updateE2eDebugBlocks = () => {
      mindboxCallsCode.textContent = stringifyDebugData(debugWindow.__mindboxCalls || []);
      consoleLogsCode.textContent = stringifyDebugData(debugWindow.__mindboxConsoleLogs || []);
    };

    debugWindow.__updateE2eDebugBlocks();
  }, renderedHtml);
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
  await attachDebugDashboard(page, entrypointHtml);
};

export const getCalls = async (page: Page): Promise<MindboxCall[]> => {
  return page.evaluate(() => {
    return (window as E2eDebugWindow).__mindboxCalls || [];
  });
};

export const getConsoleLogs = async (page: Page): Promise<MindboxConsoleLog[]> => {
  return page.evaluate(() => {
    return (window as E2eDebugWindow).__mindboxConsoleLogs || [];
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
      const emit = (window as E2eDebugWindow).__emitEventBus;
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

export const setCustomerData = async (page: Page, customerData: WidgetCustomerData): Promise<void> => {
  await page.evaluate((nextCustomerData) => {
    const setCustomer = (window as E2eDebugWindow).__setCustomerData;

    if (typeof setCustomer === 'function') {
      setCustomer(nextCustomerData);
    }
  }, customerData);
};
