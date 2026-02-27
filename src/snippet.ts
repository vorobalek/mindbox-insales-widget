import type { EventBusLike } from './widget/contracts';
import { initializeWidget } from './widget/initializeWidget';
import { ensureWidgetGlobal } from './widget/widgetGlobal';

declare const EventBus: EventBusLike | undefined;

const MESSAGE_INIT_IN_PROGRESS =
  '[mindbox] Обнаружен повторный запуск инициализации. Ожидаем завершения первого запуска.';

const start = (): Promise<void> => {
  const widgetGlobal = ensureWidgetGlobal(window);
  if (widgetGlobal.initPromise) {
    console.warn(MESSAGE_INIT_IN_PROGRESS);
    return widgetGlobal.initPromise;
  }

  const initPromise = initializeWidget({
    windowRef: window,
    eventBus: typeof EventBus === 'undefined' ? undefined : EventBus,
    setIntervalFn: (callback, delayMs) => {
      return setInterval(callback, delayMs);
    },
    clearIntervalFn: (timerId) => {
      clearInterval(timerId);
    },
    consoleLike: console
  });

  const trackedPromise = initPromise.finally(() => {
    if (widgetGlobal.initPromise === trackedPromise) {
      widgetGlobal.initPromise = undefined;
    }
  });

  widgetGlobal.initPromise = trackedPromise;
  return trackedPromise;
};

const widgetGlobal = ensureWidgetGlobal(window);
widgetGlobal.init = start;
void start();
