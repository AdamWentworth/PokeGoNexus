export const CUSTOM_TAG_FILTER_PREFIX = 'custom:';

export const toCustomTagFilter = (tagId: string): string =>
  `${CUSTOM_TAG_FILTER_PREFIX}${tagId}`;

export const fromCustomTagFilter = (filter: string): string | null => {
  const normalized = filter.trim();
  if (!normalized.toLowerCase().startsWith(CUSTOM_TAG_FILTER_PREFIX)) return null;
  const tagId = normalized.slice(CUSTOM_TAG_FILTER_PREFIX.length).trim();
  return tagId || null;
};
