import type { CartEventData, CartOrderLine, FavoritesEventData, FavoritesProduct } from './contracts';

export const extractFavoritesProducts = (data: unknown): FavoritesProduct[] => {
  const eventData = data && typeof data === 'object' ? (data as FavoritesEventData) : null;
  return eventData && Array.isArray(eventData.products) ? eventData.products : [];
};

export const extractCartOrderLines = (data: unknown): CartOrderLine[] => {
  const eventData = data && typeof data === 'object' ? (data as CartEventData) : null;
  return eventData && Array.isArray(eventData.order_lines) ? eventData.order_lines : [];
};

export const mapFavoritesProducts = (products: FavoritesProduct[], idKey: string) => {
  return products.map((item) => {
    return {
      count: 1,
      pricePerItem: item.price_min,
      productGroup: {
        ids: { [idKey]: String(item.id) }
      }
    };
  });
};

export const mapCartOrderLines = (orderLines: CartOrderLine[], idKey: string) => {
  return orderLines.map((item) => {
    return {
      count: item.quantity,
      pricePerItem: item.sale_price,
      product: {
        ids: { [idKey]: String(item.id) }
      }
    };
  });
};
