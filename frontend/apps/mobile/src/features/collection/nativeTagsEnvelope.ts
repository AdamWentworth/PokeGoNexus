import type {
  CustomTagDefinition,
  CustomTagParent,
  CustomTagsEnvelope,
  PokemonTagOrderKey,
} from '@pokemongonexus/shared-contracts/users';

export const DEFAULT_NATIVE_TAGS_ENVELOPE: CustomTagsEnvelope = {
  tags: [],
  orders: {
    caught: ['system:caught', 'system:favorites', 'system:trade'],
    wanted: ['system:wanted', 'system:most-wanted'],
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isParent = (value: unknown): value is CustomTagParent =>
  value === 'caught' || value === 'wanted';

const isOrderKey = (value: unknown): value is PokemonTagOrderKey =>
  typeof value === 'string'
  && (value.startsWith('system:') || value.startsWith('custom:'));

const normalizeDefinition = (value: unknown): CustomTagDefinition | null => {
  if (!isRecord(value)) return null;
  const tagId = typeof value.tag_id === 'string' ? value.tag_id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const color = typeof value.color === 'string' ? value.color.trim() : '';
  if (!tagId || !name || !color || !isParent(value.parent)) return null;

  return {
    tag_id: tagId,
    parent: value.parent,
    name,
    color,
    sort: typeof value.sort === 'number' && Number.isFinite(value.sort)
      ? value.sort
      : 0,
    created_at: typeof value.created_at === 'string' ? value.created_at : '',
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
  };
};

const normalizeOrder = (
  value: unknown,
  fallback: PokemonTagOrderKey[],
): PokemonTagOrderKey[] => {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter(isOrderKey);
};

export const normalizeNativeTagsEnvelope = (
  value: unknown,
): CustomTagsEnvelope => {
  if (!isRecord(value)) return DEFAULT_NATIVE_TAGS_ENVELOPE;
  const definitions = Array.isArray(value.tags)
    ? value.tags
      .map(normalizeDefinition)
      .filter((tag): tag is CustomTagDefinition => tag !== null)
    : [];
  const orders = isRecord(value.orders) ? value.orders : {};

  return {
    tags: definitions,
    orders: {
      caught: normalizeOrder(
        orders.caught,
        DEFAULT_NATIVE_TAGS_ENVELOPE.orders.caught,
      ),
      wanted: normalizeOrder(
        orders.wanted,
        DEFAULT_NATIVE_TAGS_ENVELOPE.orders.wanted,
      ),
    },
  };
};
