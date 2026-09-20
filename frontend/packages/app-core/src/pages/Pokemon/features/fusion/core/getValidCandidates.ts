// src/pages/Pokemon/features/fusion/core/getValidCandidates.ts
import { getAllInstances }           from '@/db/instancesDB';
import { initVariantsDB, VARIANTS_STORE } from '@/db/indexedDB';

import type { PokemonInstance }      from '@/types/pokemonInstance';
import { parseVariantId }            from '@/utils/PokemonIDUtils';
import type { PokemonVariant }       from '@/types/pokemonVariants';
import { normalizeInstanceToken } from '@pokemongonexus/shared-domain/instances';

const parseBasePokemonId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractBaseFromKey = (key: string | null | undefined): number | null => {
  if (!key) return null;
  const match = key.match(/^(\d{1,4})[-_]/);
  if (!match) return null;
  return parseBasePokemonId(match[1] ?? '');
};

const buildVariantKeyCandidates = (key: string): string[] => {
  const keys = [key];
  const match = key.match(/^(\d{1,4})(-.+)$/);
  if (!match) return keys;

  const idPart = match[1] ?? '';
  const rest = match[2] ?? '';
  const padded = `${idPart.padStart(4, '0')}${rest}`;
  if (padded !== key) {
    keys.push(padded);
  }
  return keys;
};

const buildFallbackVariantKey = (row: PokemonInstance): string | null => {
  if (typeof row.pokemon_id !== 'number' || !Number.isFinite(row.pokemon_id)) {
    return null;
  }
  const base = String(row.pokemon_id).padStart(4, '0');
  return `${base}-${row.shiny ? 'shiny' : 'default'}`;
};

export async function getValidCandidates(
  baseId: string,
  isShiny: boolean,
  ignoreShiny = false,
  includeInstanceIds: string[] = [],
  includeLinkedToInstanceId: string | null = null,
) {
  /* ----------------------------- instances ----------------------------- */
  const ownership =
    (await getAllInstances<PokemonInstance>()) ?? [];
  const targetBaseId = parseBasePokemonId(baseId);
  const forcedIncludeRaw = new Set(
    includeInstanceIds.filter((id) => id.length > 0).map((id) => id.trim().toLowerCase()),
  );
  const forcedIncludeNormalized = new Set(
    includeInstanceIds
      .map((id) => normalizeInstanceToken(id))
      .filter((id): id is string => Boolean(id)),
  );
  const linkedTargetRaw =
    typeof includeLinkedToInstanceId === 'string' && includeLinkedToInstanceId.length > 0
      ? includeLinkedToInstanceId.trim().toLowerCase()
      : null;
  const linkedTargetNormalized = normalizeInstanceToken(includeLinkedToInstanceId);
  const filtered = ownership.filter((o) => {
    if (targetBaseId == null) return false;

    const entryBaseId = typeof o.pokemon_id === 'number'
      ? o.pokemon_id
      : extractBaseFromKey(o.variant_id) ?? extractBaseFromKey(o.instance_id);
    if (entryBaseId !== targetBaseId) return false;

    const candidateInstanceRaw =
      typeof o.instance_id === 'string' && o.instance_id.length > 0
        ? o.instance_id.trim().toLowerCase()
        : null;
    const candidateInstanceNormalized = normalizeInstanceToken(o.instance_id);
    const isForcedById =
      (candidateInstanceRaw != null && forcedIncludeRaw.has(candidateInstanceRaw)) ||
      (candidateInstanceNormalized != null && forcedIncludeNormalized.has(candidateInstanceNormalized));
    const isForcedByLink =
      typeof o.fused_with === 'string' &&
      (
        (linkedTargetRaw != null && o.fused_with.trim().toLowerCase() === linkedTargetRaw) ||
        (() => {
          const fusedWithNormalized = normalizeInstanceToken(o.fused_with);
          return (
            linkedTargetNormalized != null &&
            fusedWithNormalized != null &&
            fusedWithNormalized === linkedTargetNormalized
          );
        })()
      );
    const isForced = isForcedById || isForcedByLink;
    if (!o.is_caught) return false;
    if (!isForced && o.is_for_trade) return false;
    if (!isForced && o.is_fused) return false;
    if (!isForced && o.disabled) return false;
    if (!ignoreShiny && (!!o.shiny) !== isShiny) return false;
    return true;
  });

  /* ------------------------------ variants ----------------------------- */
  const db = await initVariantsDB();
  const enriched: (PokemonVariant & { instanceData: PokemonInstance })[] = [];

  if (!db) return enriched; // IndexedDB unavailable (private-mode etc.)

  for (const cand of filtered) {
    const parsedFromInstance = cand.instance_id ? parseVariantId(cand.instance_id) : null;
    const preferredKey =
      (typeof cand.variant_id === 'string' && cand.variant_id.length > 0
        ? cand.variant_id
        : parsedFromInstance?.baseKey) ??
      buildFallbackVariantKey(cand) ??
      '';
    if (!preferredKey) continue;

    let variant: PokemonVariant | undefined;
    for (const key of buildVariantKeyCandidates(preferredKey)) {
      variant = await db.get(
        VARIANTS_STORE,
        key,
      ) as PokemonVariant | undefined;
      if (variant) break;
    }

    if (!variant) {
      const fallbackKey = buildFallbackVariantKey(cand);
      if (fallbackKey) {
        for (const key of buildVariantKeyCandidates(fallbackKey)) {
          variant = await db.get(
            VARIANTS_STORE,
            key,
          ) as PokemonVariant | undefined;
          if (variant) break;
        }
      }
    }

    if (variant) {
      enriched.push({ ...variant, instanceData: cand });
    }
  }

  return enriched;
}
