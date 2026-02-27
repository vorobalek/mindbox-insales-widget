import { MESSAGE_TRACKER_NOT_INITIALIZED, MESSAGE_WIDGET_NOT_CONFIGURED } from './constants';
import type { ConfigErrorLogger, ConsoleLike, MindboxFunction, MindboxWidgetConfig } from './contracts';
import { normalizeValue } from './normalizeValue';

export interface OperationSenderDeps {
  getConfig: () => MindboxWidgetConfig | null;
  getMindbox: () => MindboxFunction | undefined;
  logConfigError: ConfigErrorLogger;
  consoleLike: ConsoleLike;
}

export type SendOperation = (operationName: unknown, payload: unknown) => void;

export const createOperationSender = (deps: OperationSenderDeps): SendOperation => {
  return (operationName, payload) => {
    const config = deps.getConfig();
    const normalizedOperation = normalizeValue(operationName);

    if (!config || !config.isValid) {
      const missing = config && Array.isArray(config.missingSettings) ? config.missingSettings.join(', ') : 'unknown';
      deps.logConfigError(MESSAGE_WIDGET_NOT_CONFIGURED, missing);
      return;
    }

    if (!normalizedOperation) {
      return;
    }

    const mindbox = deps.getMindbox();
    if (typeof mindbox !== 'function') {
      deps.logConfigError(MESSAGE_TRACKER_NOT_INITIALIZED);
      return;
    }

    mindbox('async', {
      operation: normalizedOperation,
      data: payload,
      onSuccess: () => {
        // ignore
      },
      onError: (error: unknown) => {
        deps.consoleLike.error('[mindbox]', error);
      }
    });
  };
};
