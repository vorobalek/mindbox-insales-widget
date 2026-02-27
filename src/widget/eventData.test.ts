import { describe, expect, it } from 'vitest';
import { extractCartOrderLines, extractFavoritesProducts, mapCartOrderLines, mapFavoritesProducts } from './eventData';

describe('eventData', () => {
  it('extracts favorites products from valid payload', () => {
    const products = extractFavoritesProducts({
      products: [{ id: 10, price_min: 150 }]
    });

    expect(products).toEqual([{ id: 10, price_min: 150 }]);
  });

  it('returns empty favorites products for invalid payload', () => {
    expect(extractFavoritesProducts(null)).toEqual([]);
    expect(extractFavoritesProducts({ products: 'invalid' })).toEqual([]);
  });

  it('extracts cart order lines from valid payload', () => {
    const orderLines = extractCartOrderLines({
      order_lines: [{ id: 20, quantity: 2, sale_price: 300 }]
    });

    expect(orderLines).toEqual([{ id: 20, quantity: 2, sale_price: 300 }]);
  });

  it('returns empty cart order lines for invalid payload', () => {
    expect(extractCartOrderLines(undefined)).toEqual([]);
    expect(extractCartOrderLines({ order_lines: 'invalid' })).toEqual([]);
  });

  it('maps favorites products to mindbox payload lines', () => {
    const list = mapFavoritesProducts(
      [
        { id: 1, price_min: 90 },
        { id: '2', price_min: null }
      ],
      'externalId'
    );

    expect(list).toEqual([
      {
        count: 1,
        pricePerItem: 90,
        productGroup: {
          ids: { externalId: '1' }
        }
      },
      {
        count: 1,
        pricePerItem: null,
        productGroup: {
          ids: { externalId: '2' }
        }
      }
    ]);
  });

  it('maps cart order lines to mindbox payload lines', () => {
    const list = mapCartOrderLines(
      [
        { id: 5, quantity: 3, sale_price: 120 },
        { id: '6', quantity: 1, sale_price: null }
      ],
      'website'
    );

    expect(list).toEqual([
      {
        count: 3,
        pricePerItem: 120,
        product: {
          ids: { website: '5' }
        }
      },
      {
        count: 1,
        pricePerItem: null,
        product: {
          ids: { website: '6' }
        }
      }
    ]);
  });
});
