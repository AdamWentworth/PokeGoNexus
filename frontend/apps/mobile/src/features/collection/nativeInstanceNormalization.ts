import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeNativeTagIds = (value: unknown): string[] => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return normalizeNativeTagIds(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }
  if (!Array.isArray(value)) return [];

  const ids = new Set<string>();
  for (const entry of value) {
    const candidate = typeof entry === 'string'
      ? entry
      : isRecord(entry)
        ? entry.tag_id ?? entry.id ?? entry.value
        : null;
    if (typeof candidate === 'string' && candidate.trim()) {
      ids.add(candidate.trim());
    }
  }
  return [...ids];
};

export const normalizeNativeInstance = (
  instance: PokemonInstance,
): PokemonInstance => ({
  ...instance,
  caught_tags: normalizeNativeTagIds(instance.caught_tags),
  trade_tags: normalizeNativeTagIds(instance.trade_tags),
  wanted_tags: normalizeNativeTagIds(instance.wanted_tags),
});

export const normalizeNativeInstances = (
  value: unknown,
): Record<string, PokemonInstance> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, instance]) => {
      if (!isRecord(instance)) return [];
      return [[key, normalizeNativeInstance(instance as unknown as PokemonInstance)]];
    }),
  );
};
