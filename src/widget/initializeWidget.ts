import { MESSAGE_EVENTBUS_UNAVAILABLE, MESSAGE_MISSING_SETTINGS, RETRY_ATTEMPTS, RETRY_DELAY_MS } from './constants';
import type { ConsoleLike, EventBusLike, MindboxWidgetConfig, TimerLike, WidgetWindow } from './contracts';
import { normalizeAndValidateConfig } from './config';
import { createConfigErrorLogger } from './logger';
import { createOperationSender } from './operationSender';
import { sendInitialPageViews } from './pageViewSender';
import { bindSubscriptions } from './subscriptionBinder';
import { ensureWidgetGlobal } from './widgetGlobal';

export interface InitializeWidgetDeps extends TimerLike {
  windowRef: WidgetWindow;
  eventBus?: EventBusLike;
  consoleLike: ConsoleLike;
}

export const initializeWidget = (deps: InitializeWidgetDeps): Promise<void> => {
  const widgetGlobal = ensureWidgetGlobal(deps.windowRef);
  const stateRef = widgetGlobal.state!;
  const normalizedConfig = normalizeAndValidateConfig(widgetGlobal.config);
  if (!normalizedConfig) {
    return Promise.resolve();
  }
  widgetGlobal.config = normalizedConfig;

  const getConfig = (): MindboxWidgetConfig | null => {
    return widgetGlobal.config || null;
  };

  const logConfigError = createConfigErrorLogger(stateRef, deps.consoleLike);
  if (!normalizedConfig.isValid) {
    if (!stateRef.missingSettingsLogged) {
      stateRef.missingSettingsLogged = true;
      deps.consoleLike.error(MESSAGE_MISSING_SETTINGS, normalizedConfig.missingSettings!.join(', '));
    }
    return Promise.resolve();
  }

  const sendOperation = createOperationSender({
    getConfig,
    getMindbox: () => deps.windowRef.mindbox,
    logConfigError,
    consoleLike: deps.consoleLike
  });

  sendInitialPageViews({
    stateRef,
    config: normalizedConfig,
    sendOperation
  });

  if (stateRef.eventsBound) {
    return Promise.resolve();
  }

  const bind = (): boolean => {
    return bindSubscriptions({
      stateRef,
      eventBus: deps.eventBus,
      getConfig,
      sendOperation
    });
  };

  if (bind()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let attemptsLeft = RETRY_ATTEMPTS;
    const timerId = deps.setIntervalFn(() => {
      if (bind()) {
        deps.clearIntervalFn(timerId);
        resolve();
        return;
      }

      attemptsLeft -= 1;
      if (attemptsLeft <= 0) {
        deps.clearIntervalFn(timerId);
        logConfigError(MESSAGE_EVENTBUS_UNAVAILABLE);
        resolve();
      }
    }, RETRY_DELAY_MS);
  });
};
