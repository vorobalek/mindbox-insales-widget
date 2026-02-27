import { describe, expect, it, vi } from 'vitest';
import { createConfigErrorLogger } from './logger';

describe('createConfigErrorLogger', () => {
  it('logs message without details once', () => {
    const stateRef = {};
    const consoleLike = { error: vi.fn() };

    const logger = createConfigErrorLogger(stateRef, consoleLike);
    logger('error message');
    logger('another message');

    expect(consoleLike.error).toHaveBeenCalledTimes(1);
    expect(consoleLike.error).toHaveBeenCalledWith('error message');
    expect(stateRef).toEqual({ configErrorLogged: true });
  });

  it('logs message with details', () => {
    const stateRef = {};
    const consoleLike = { error: vi.fn() };

    const logger = createConfigErrorLogger(stateRef, consoleLike);
    logger('error message', 'details');

    expect(consoleLike.error).toHaveBeenCalledWith('error message', 'details');
  });
});
