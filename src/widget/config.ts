import type { AuthorizeCustomerPathPair, MindboxWidgetConfig } from './contracts';
import { normalizeValue } from './normalizeValue';

const parseCheckbox = (value: unknown): boolean => {
  if (value === true) {
    return true;
  }
  if (value === false || value === null || value === undefined) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

export const resolveAuthorizePathPairs = (
  raw: MindboxWidgetConfig['authorizeCustomer'] | undefined
): AuthorizeCustomerPathPair[] => {
  if (!raw) {
    return [];
  }
  if (raw.pathPairs !== undefined) {
    return raw.pathPairs;
  }
  return collectAuthorizePathPairs(raw);
};

const collectAuthorizePathPairs = (raw: MindboxWidgetConfig['authorizeCustomer']): AuthorizeCustomerPathPair[] => {
  const candidates: Array<{ sourcePath: string; targetPath: string }> = [
    {
      sourcePath: normalizeValue(raw && raw.sourcePath),
      targetPath: normalizeValue(raw && raw.targetPath)
    },
    {
      sourcePath: normalizeValue(raw && raw.sourcePath2),
      targetPath: normalizeValue(raw && raw.targetPath2)
    },
    {
      sourcePath: normalizeValue(raw && raw.sourcePath3),
      targetPath: normalizeValue(raw && raw.targetPath3)
    }
  ];

  return candidates.filter((pair) => pair.sourcePath !== '' && pair.targetPath !== '');
};

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
    clearWishList: normalizeValue(input.operations && input.operations.clearWishList),
    authorizeCustomer: normalizeValue(input.operations && input.operations.authorizeCustomer)
  };

  const authorizeCustomer: MindboxWidgetConfig['authorizeCustomer'] = {
    enabled: parseCheckbox(input.authorizeCustomer && input.authorizeCustomer.enabled),
    sourcePath: normalizeValue(input.authorizeCustomer && input.authorizeCustomer.sourcePath),
    targetPath: normalizeValue(input.authorizeCustomer && input.authorizeCustomer.targetPath),
    sourcePath2: normalizeValue(input.authorizeCustomer && input.authorizeCustomer.sourcePath2),
    targetPath2: normalizeValue(input.authorizeCustomer && input.authorizeCustomer.targetPath2),
    sourcePath3: normalizeValue(input.authorizeCustomer && input.authorizeCustomer.sourcePath3),
    targetPath3: normalizeValue(input.authorizeCustomer && input.authorizeCustomer.targetPath3)
  };
  authorizeCustomer.pathPairs = collectAuthorizePathPairs(authorizeCustomer);

  const config: MindboxWidgetConfig = {
    ...input,
    apiDomain: normalizeValue(input.apiDomain)
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, ''),
    idKey: normalizeValue(input.idKey),
    operations,
    authorizeCustomer
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
