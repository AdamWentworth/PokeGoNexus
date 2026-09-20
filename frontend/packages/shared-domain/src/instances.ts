import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';

type InstanceLike = {
  instance_id?: unknown;
};

type InstancePatch = Partial<PokemonInstance>;

export type ActiveCollectionCounts = {
  caught: number;
  favorites: number;
  forTrade: number;
  wanted: number;
  mostWanted: number;
};

export const summarizeActiveCollection = (
  instances: Record<string, PokemonInstance>,
): ActiveCollectionCounts => {
  const summary: ActiveCollectionCounts = { caught: 0, favorites: 0, forTrade: 0, wanted: 0, mostWanted: 0 };
  for (const instance of Object.values(instances)) {
    if (instance.disabled) continue;
    if (instance.is_caught) summary.caught += 1;
    if (instance.is_caught && instance.favorite) summary.favorites += 1;
    if (instance.is_caught && instance.is_for_trade) summary.forTrade += 1;
    if (instance.is_wanted) summary.wanted += 1;
    if (instance.is_wanted && instance.most_wanted) summary.mostWanted += 1;
  }
  return summary;
};

const UUID_AT_END_REGEX =
  /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export const FAVORITE_TO_TRADE_ERROR =
  'Favorite Pokémon cannot be listed For Trade. Remove Favorite first.';

export const TRADE_TO_FAVORITE_ERROR =
  'For Trade Pokémon cannot be marked as Favorite. Remove it from For Trade first.';

export const getFavoriteTradeConflict = (
  current: InstancePatch,
  patch: InstancePatch,
): string | null => {
  if (patch.favorite === undefined && patch.is_for_trade === undefined) return null;
  const nextFavorite = patch.favorite ?? current.favorite ?? false;
  const nextForTrade = patch.is_for_trade ?? current.is_for_trade ?? false;
  if (!nextFavorite || !nextForTrade) return null;

  if (patch.favorite === true && current.is_for_trade && patch.is_for_trade !== false) {
    return TRADE_TO_FAVORITE_ERROR;
  }
  return FAVORITE_TO_TRADE_ERROR;
};

export const enforceFavoriteTradeInvariant = (
  instance: InstancePatch,
  preferredState: 'favorite' | 'trade',
): void => {
  if (!instance.favorite || !instance.is_for_trade) return;
  if (preferredState === 'trade') instance.favorite = false;
  else instance.is_for_trade = false;
};

export const extractLegacyInstanceId = (key: string): string | null => {
  const idx = key.lastIndexOf('_');
  if (idx < 0 || idx >= key.length - 1) return null;
  const suffix = key.slice(idx + 1);
  return suffix || null;
};

export const normalizeInstanceToken = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const uuidMatch = trimmed.match(UUID_AT_END_REGEX);
  if (uuidMatch?.[1]) return uuidMatch[1];
  return trimmed;
};

export const collectInstanceRefCandidates = (
  value: string | null | undefined,
): string[] => {
  if (!value) return [];

  const refs = new Set<string>();
  const raw = value.trim().toLowerCase();
  if (raw) refs.add(raw);

  const legacy = extractLegacyInstanceId(value);
  if (legacy) refs.add(legacy.trim().toLowerCase());

  const normalized = normalizeInstanceToken(value);
  if (normalized) refs.add(normalized);

  return [...refs];
};

export const findInstanceByRefs = <T extends InstanceLike = PokemonInstance>(
  collection: Record<string, T> | null | undefined,
  refs: string[],
): T | null => {
  if (!collection || refs.length === 0) return null;
  const refSet = new Set(refs.map((ref) => ref.toLowerCase()));

  for (const [key, row] of Object.entries(collection)) {
    const keyRefs = collectInstanceRefCandidates(key);
    if (keyRefs.some((ref) => refSet.has(ref))) return row;

    const rowInstanceId =
      typeof row?.instance_id === 'string' && row.instance_id.length > 0
        ? row.instance_id
        : null;
    const rowRefs = collectInstanceRefCandidates(rowInstanceId);
    if (rowRefs.some((ref) => refSet.has(ref))) return row;
  }

  return null;
};

export const resolveInstanceCollectionKey = <T extends InstanceLike>(
  collection: Record<string, T>,
  requestedKey: string,
): string | null => {
  if (collection[requestedKey]) return requestedKey;

  const legacyId = extractLegacyInstanceId(requestedKey);
  if (legacyId && collection[legacyId]) return legacyId;

  const candidateIds = [requestedKey, legacyId].filter(
    (value): value is string => Boolean(value),
  );
  const normalizedCandidateIds = new Set(
    candidateIds
      .map((value) => normalizeInstanceToken(value))
      .filter((value): value is string => Boolean(value)),
  );
  if (candidateIds.length === 0) return null;

  for (const [existingKey, row] of Object.entries(collection)) {
    const normalizedExistingKey = normalizeInstanceToken(existingKey);
    if (
      normalizedExistingKey &&
      normalizedCandidateIds.has(normalizedExistingKey)
    ) {
      return existingKey;
    }

    const rowInstanceId =
      typeof row?.instance_id === 'string' && row.instance_id.length > 0
        ? row.instance_id
        : null;
    if (!rowInstanceId) continue;

    if (candidateIds.includes(rowInstanceId)) {
      return existingKey;
    }

    const normalizedRowInstanceId = normalizeInstanceToken(rowInstanceId);
    if (
      normalizedRowInstanceId &&
      normalizedCandidateIds.has(normalizedRowInstanceId)
    ) {
      return existingKey;
    }
  }

  return null;
};

export const parseBackgroundId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
