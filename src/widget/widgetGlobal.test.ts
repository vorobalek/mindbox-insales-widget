import { describe, expect, it } from 'vitest';
import type { WidgetWindow } from './contracts';
import { ensureWidgetGlobal } from './widgetGlobal';

describe('ensureWidgetGlobal', () => {
  it('creates widget global with state when missing', () => {
    const windowRef = {} as WidgetWindow;
    const globalRef = ensureWidgetGlobal(windowRef);

    expect(globalRef).toEqual({ state: {} });
    expect(windowRef.__mindboxInSalesWidget).toEqual({ state: {} });
  });

  it('reuses existing widget global object', () => {
    const windowRef = {
      __mindboxInSalesWidget: {
        config: { apiDomain: 'api.mindbox.ru' },
        state: { eventsBound: true }
      }
    } as WidgetWindow;
    const globalRef = ensureWidgetGlobal(windowRef);

    expect(globalRef).toBe(windowRef.__mindboxInSalesWidget);
    expect(globalRef.config).toEqual({ apiDomain: 'api.mindbox.ru' });
    expect(globalRef.state).toEqual({ eventsBound: true });
  });
});
