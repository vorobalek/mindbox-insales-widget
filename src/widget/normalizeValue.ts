export const normalizeValue = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};
