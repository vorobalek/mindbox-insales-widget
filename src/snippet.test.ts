import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeWidget } from './widget/initializeWidget';

vi.mock('./widget/initializeWidget', () => {
  return {
    initializeWidget: vi.fn(() => Promise.resolve())
  };
});

describe('snippet entrypoint', () => {
  const initializeWidgetMock = vi.mocked(initializeWidget);
  const getTestGlobal = () => {
    return globalThis as typeof globalThis & {
      EventBus?: unknown;
      window: Window & typeof globalThis;
      setInterval: typeof setInterval;
      clearInterval: typeof clearInterval;
    };
  };

  beforeEach(() => {
    const testGlobal = getTestGlobal();
    vi.resetModules();
    initializeWidgetMock.mockReset();
    testGlobal.window = {} as Window & typeof globalThis;
    delete testGlobal.EventBus;
  });

  it('initializes widget with EventBus when it is defined', async () => {
    const testGlobal = getTestGlobal();
    const eventBus = { subscribe: vi.fn() };
    testGlobal.EventBus = eventBus;
    const originalSetInterval = testGlobal.setInterval;
    const originalClearInterval = testGlobal.clearInterval;
    const timerId = originalSetInterval(() => undefined, 60_000);
    originalClearInterval(timerId);
    const setIntervalMock = vi.fn(() => timerId) as unknown as typeof setInterval;
    const clearIntervalMock = vi.fn() as unknown as typeof clearInterval;
    testGlobal.setInterval = setIntervalMock;
    testGlobal.clearInterval = clearIntervalMock;

    await import('./snippet');

    expect(initializeWidgetMock).toHaveBeenCalledTimes(1);
    expect(initializeWidgetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowRef: testGlobal.window,
        eventBus,
        consoleLike: console
      })
    );
    const deps = initializeWidgetMock.mock.calls[0][0];
    expect(typeof deps.setIntervalFn).toBe('function');
    expect(typeof deps.clearIntervalFn).toBe('function');
    expect(deps.setIntervalFn(() => undefined, 100)).toBe(timerId);
    deps.clearIntervalFn(timerId);
    expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(clearIntervalMock).toHaveBeenCalledWith(timerId);

    testGlobal.setInterval = originalSetInterval;
    testGlobal.clearInterval = originalClearInterval;
  });

  it('initializes widget without EventBus when it is undefined', async () => {
    const testGlobal = getTestGlobal();
    await import('./snippet');

    expect(initializeWidgetMock).toHaveBeenCalledTimes(1);
    expect(initializeWidgetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowRef: testGlobal.window,
        eventBus: undefined,
        consoleLike: console
      })
    );
  });

  it('reuses pending initialization and warns on duplicate init call', async () => {
    const testGlobal = getTestGlobal();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let resolveInit: (() => void) | null = null;
    const pendingInitPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    initializeWidgetMock.mockReturnValueOnce(pendingInitPromise);

    await import('./snippet');

    expect(initializeWidgetMock).toHaveBeenCalledTimes(1);
    const widgetGlobal = (
      testGlobal.window as Window & typeof globalThis & { __mindboxInSalesWidget?: { init?: () => Promise<void> } }
    ).__mindboxInSalesWidget;
    expect(widgetGlobal && typeof widgetGlobal.init).toBe('function');

    const duplicateCallPromise = widgetGlobal!.init!();
    expect(initializeWidgetMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[mindbox] Обнаружен повторный запуск инициализации. Ожидаем завершения первого запуска.'
    );

    resolveInit!();
    await duplicateCallPromise;
    warnSpy.mockRestore();
  });

  it('keeps replaced initPromise when previous initialization settles', async () => {
    const testGlobal = getTestGlobal();
    let resolveInit: (() => void) | null = null;
    const pendingInitPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    initializeWidgetMock.mockReturnValueOnce(pendingInitPromise);

    await import('./snippet');

    const widgetGlobal = (
      testGlobal.window as Window &
        typeof globalThis & {
          __mindboxInSalesWidget?: { initPromise?: Promise<void> };
        }
    ).__mindboxInSalesWidget;
    const replacementPromise = Promise.resolve();
    widgetGlobal!.initPromise = replacementPromise;

    resolveInit!();
    await pendingInitPromise;
    await Promise.resolve();

    expect(widgetGlobal!.initPromise).toBe(replacementPromise);
  });
});
