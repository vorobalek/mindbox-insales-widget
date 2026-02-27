import type { MindboxWidgetConfig } from './contracts';
import { normalizeValue } from './normalizeValue';

export const normalizeAndValidateConfig = (input: MindboxWidgetConfig | undefined): MindboxWidgetConfig | null => {
  if (!input) {
    return null;
  }

  const operations = {
    viewCategory: normalizeValue(input.operations && input.operations.viewCategory),
    viewProduct: normalizeValue(input.operations && input.operations.viewProduct),
    setCart: normalizeValue(input.operations && input.operations.setCart),
    clearCart: normalizeValue(input.operations && input.operations.clearCart),
    setWishList: normalizeValue(input.operations && input.operations.setWishList),
    clearWishList: normalizeValue(input.operations && input.operations.clearWishList)
  };

  const config: MindboxWidgetConfig = {
    ...input,
    apiDomain: normalizeValue(input.apiDomain)
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, ''),
    idKey: normalizeValue(input.idKey),
    operations
  };

  const requiredKeys: Array<{ name: string; value: string }> = [
    { name: 'apiDomain', value: config.apiDomain || '' },
    { name: 'idKey', value: config.idKey || '' }
  ];

  const missingSettings = requiredKeys.filter((item) => item.value === '').map((item) => item.name);

  config.missingSettings = missingSettings;
  config.isValid = missingSettings.length === 0;
  return config;
};

export const createIds = (idKey: string, idValue: string | number) => {
  return {
    [idKey]: String(idValue)
  };
};
