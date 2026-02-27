import { describe, expect, it, vi } from 'vitest';
import { sendInitialPageViews } from './pageViewSender';

describe('sendInitialPageViews', () => {
  it('sends collection page view with custom id key once', () => {
    const sendOperation = vi.fn();
    const stateRef: { collectionViewSent?: boolean } = {};

    sendInitialPageViews({
      stateRef,
      config: {
        idKey: 'externalId',
        operations: {
          viewCategory: 'Website.ViewCategory'
        },
        page: {
          template: 'collection',
          collectionId: 123
        }
      },
      sendOperation
    });

    expect(sendOperation).toHaveBeenCalledWith('Website.ViewCategory', {
      viewProductCategory: {
        productCategory: {
          ids: { externalId: '123' }
        }
      }
    });
    expect(stateRef.collectionViewSent).toBe(true);

    sendInitialPageViews({
      stateRef,
      config: {
        idKey: 'externalId',
        operations: {
          viewCategory: 'Website.ViewCategory'
        },
        page: {
          template: 'collection',
          collectionId: 123
        }
      },
      sendOperation
    });
    expect(sendOperation).toHaveBeenCalledTimes(1);
  });

  it('sends product page view with default id key', () => {
    const sendOperation = vi.fn();
    const stateRef: { productViewSent?: boolean } = {};

    sendInitialPageViews({
      stateRef,
      config: {
        operations: {
          viewProduct: 'Website.ViewProduct'
        },
        page: {
          template: 'product',
          productId: 42,
          productPrice: 999
        }
      },
      sendOperation
    });

    expect(sendOperation).toHaveBeenCalledWith('Website.ViewProduct', {
      viewProduct: {
        price: '999',
        productGroup: {
          ids: { website: '42' }
        }
      }
    });
    expect(stateRef.productViewSent).toBe(true);
  });

  it('does nothing when page data is incomplete', () => {
    const sendOperation = vi.fn();

    sendInitialPageViews({
      stateRef: {},
      config: {
        operations: {
          viewCategory: 'a',
          viewProduct: 'b'
        },
        page: {
          template: 'other'
        }
      },
      sendOperation
    });

    expect(sendOperation).not.toHaveBeenCalled();
  });
});
