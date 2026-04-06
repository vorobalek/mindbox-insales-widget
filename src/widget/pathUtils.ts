const pathSegments = (path: string): string[] => {
  return path.split('.').filter((segment) => segment !== '');
};

export const getValueByPath = (root: unknown, path: string): unknown => {
  const segments = pathSegments(path);
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return undefined;
    }
    current = record[segment];
  }
  return current;
};

export const setValueByPath = (root: Record<string, unknown>, path: string, value: string): Record<string, unknown> => {
  const segments = pathSegments(path);
  if (segments.length === 0) {
    return root;
  }

  let current: Record<string, unknown> = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i]!;
    const next = current[key];
    if (next === undefined || next === null || typeof next !== 'object' || Array.isArray(next)) {
      const nested: Record<string, unknown> = {};
      current[key] = nested;
      current = nested;
    } else {
      current = next as Record<string, unknown>;
    }
  }
  current[segments[segments.length - 1]!] = value;
  return root;
};

const normalizePhone = (phone: string): string => {
  return phone.replace(/[^\d+]/g, '');
};

export const formatAuthorizeSourceValue = (raw: unknown, sourcePath: string): string => {
  if (raw === null || raw === undefined) {
    return '';
  }

  const segments = pathSegments(sourcePath);
  const last = segments.length ? segments[segments.length - 1]! : '';

  if (last === 'phone') {
    return normalizePhone(String(raw).trim());
  }

  return String(raw).trim();
};
