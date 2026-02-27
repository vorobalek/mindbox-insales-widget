import type { MindboxInSalesWidgetGlobal, WidgetWindow } from './contracts';

export const ensureWidgetGlobal = (windowRef: WidgetWindow): MindboxInSalesWidgetGlobal => {
  const widgetGlobal = windowRef.__mindboxInSalesWidget || {};
  if (!widgetGlobal.state) {
    widgetGlobal.state = {};
  }

  windowRef.__mindboxInSalesWidget = widgetGlobal;
  return widgetGlobal;
};
