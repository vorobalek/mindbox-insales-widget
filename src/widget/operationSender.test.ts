import { describe, expect, it, vi } from 'vitest';
import { MESSAGE_TRACKER_NOT_INITIALIZED, MESSAGE_WIDGET_NOT_CONFIGURED } from './constants';
import { createOperationSender } from './operationSender';

describe('createOperationSender', () => {
  it('logs config error when config is missing', () => {
    const logConfigError = vi.fn();
    const mindbox = vi.fn();
    const sender = createOperationSender({
      getConfig: () => null,
      getMindbox: () => mindbox,
      logConfigError,
      consoleLike: { error: vi.fn() }
    });

    sender('Operation', {});

    expect(logConfigError).toHaveBeenCalledWith(MESSAGE_WIDGET_NOT_CONFIGURED, 'unknown');
    expect(mindbox).not.toHaveBeenCalled();
  });

  it('logs missing settings when config is invalid', () => {
    const logConfigError = vi.fn();
    const sender = createOperationSender({
      getConfig: () => ({ isValid: false, missingSettings: ['apiDomain'] }),
      getMindbox: () => undefined,
      logConfigError,
      consoleLike: { error: vi.fn() }
    });

    sender('Operation', {});

    expect(logConfigError).toHaveBeenCalledWith(MESSAGE_WIDGET_NOT_CONFIGURED, 'apiDomain');
  });

  it('does nothing when operation name is empty after normalization', () => {
    const mindbox = vi.fn();
    const logConfigError = vi.fn();
    const sender = createOperationSender({
      getConfig: () => ({ isValid: true }),
      getMindbox: () => mindbox,
      logConfigError,
      consoleLike: { error: vi.fn() }
    });

    sender('   ', { any: true });

    expect(mindbox).not.toHaveBeenCalled();
    expect(logConfigError).not.toHaveBeenCalled();
  });

  it('logs tracker initialization error when mindbox is missing', () => {
    const logConfigError = vi.fn();
    const sender = createOperationSender({
      getConfig: () => ({ isValid: true }),
      getMindbox: () => undefined,
      logConfigError,
      consoleLike: { error: vi.fn() }
    });

    sender('Operation', {});

    expect(logConfigError).toHaveBeenCalledWith(MESSAGE_TRACKER_NOT_INITIALIZED);
  });

  it('sends operation to mindbox and handles callback errors', () => {
    const logConfigError = vi.fn();
    const consoleError = vi.fn();
    const mindbox = vi.fn();
    const sender = createOperationSender({
      getConfig: () => ({ isValid: true }),
      getMindbox: () => mindbox,
      logConfigError,
      consoleLike: { error: consoleError }
    });

    sender('  Website.SetCart  ', { productList: [1] });

    expect(logConfigError).not.toHaveBeenCalled();
    expect(mindbox).toHaveBeenCalledTimes(1);
    expect(mindbox).toHaveBeenCalledWith(
      'async',
      expect.objectContaining({
        operation: 'Website.SetCart',
        data: { productList: [1] }
      })
    );

    const payload = mindbox.mock.calls[0][1] as { onSuccess: () => void; onError: (error: unknown) => void };
    payload.onSuccess();
    payload.onError('boom');

    expect(consoleError).toHaveBeenCalledWith('[mindbox]', 'boom');
  });
});
