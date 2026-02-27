import type { ConfigErrorLogger, ConsoleLike, MindboxInSalesWidgetState } from './contracts';

export const createConfigErrorLogger = (
  stateRef: MindboxInSalesWidgetState,
  consoleLike: ConsoleLike
): ConfigErrorLogger => {
  return (message, details) => {
    if (stateRef.configErrorLogged) {
      return;
    }

    stateRef.configErrorLogged = true;
    if (typeof details !== 'undefined') {
      consoleLike.error(message, details);
      return;
    }

    consoleLike.error(message);
  };
};
