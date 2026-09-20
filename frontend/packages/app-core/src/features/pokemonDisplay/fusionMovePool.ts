import type { PokemonVariant } from '../../types/pokemonVariants';
import type { Move } from '../../types/pokemonSubTypes';

type FusionMoveState = {
  is_fused?: boolean;
  fusion_form?: string | null;
  storedFusionObject?: unknown;
};

type ResolveFusionMovePoolParams = {
  pokemon: Pick<PokemonVariant, 'moves' | 'fusion'> &
    Partial<Pick<PokemonVariant, 'fusion_id' | 'variantType'>>;
  fusion: FusionMoveState;
};

export type FusionMoveSource = 'base' | 'fusion' | 'fusion_missing';

export type ResolveFusionMovePoolResult = {
  moves: Move[];
  source: FusionMoveSource;
  fusionId: number | null;
};

// This resolver is shared by Vite and native Metro bundles. Keep diagnostics
// dependency-free so importing roster logic does not pull Vite's import.meta
// environment into React Native.
const log = {
  debug: (..._args: unknown[]) => undefined,
  warn: (..._args: unknown[]) => undefined,
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeFusionToken = (value: unknown): string =>
  normalizeText(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const parseFusionId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const directMatch = trimmed.match(/^\d+$/);
  if (directMatch) {
    const parsed = Number(directMatch[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const legacyPrefixedMatch = trimmed.match(/^(?:shiny[_\s-]?)?fusion[_\s-]?(\d+)$/i);
  if (!legacyPrefixedMatch) return null;

  const parsed = Number(legacyPrefixedMatch[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseFusionIdFromVariantType = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/(?:^|_)fusion_(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseFusionIdsFromStoredObject = (value: unknown): number[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const fusionIds: number[] = [];
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!rawValue) continue;
    const parsed = parseFusionId(rawKey);
    if (parsed != null) fusionIds.push(parsed);
  }

  return fusionIds;
};

const dedupeByMoveId = (moves: Move[]): Move[] => {
  const seen = new Set<number>();
  const deduped: Move[] = [];
  for (const move of moves) {
    if (typeof move?.move_id !== 'number') continue;
    if (seen.has(move.move_id)) continue;
    seen.add(move.move_id);
    deduped.push(move);
  }
  return deduped;
};

const findFusionEntry = (
  fusionEntries: Array<{ fusion_id?: number | null; name?: string; moves?: Move[] }>,
  fusionState: FusionMoveState,
): { fusion_id?: number | null; name?: string; moves?: Move[] } | undefined => {
  const explicitFusionId = parseFusionId(fusionState.fusion_form);
  if (explicitFusionId != null) {
    const match = fusionEntries.find((entry) => entry.fusion_id === explicitFusionId);
    if (match) return match;
  }

  const normalizedName = normalizeFusionToken(fusionState.fusion_form);
  if (normalizedName) {
    const match = fusionEntries.find(
      (entry) => normalizeFusionToken(entry.name) === normalizedName,
    );
    if (match) return match;
  }

  const storedFusionIds = parseFusionIdsFromStoredObject(fusionState.storedFusionObject);
  for (const candidateId of storedFusionIds) {
    const match = fusionEntries.find((entry) => entry.fusion_id === candidateId);
    if (match) return match;
  }

  if (fusionState.is_fused && fusionEntries.length === 1) {
    return fusionEntries[0];
  }

  return undefined;
};

export const resolveFusionMovePool = ({
  pokemon,
  fusion,
}: ResolveFusionMovePoolParams): ResolveFusionMovePoolResult => {
  const baseMoves = Array.isArray(pokemon.moves) ? pokemon.moves : [];

  if (!fusion.is_fused) {
    log.debug('not fused; returning base move pool', {
      baseMoveCount: baseMoves.length,
    });
    return {
      moves: dedupeByMoveId(baseMoves),
      source: 'base',
      fusionId: null,
    };
  }

  const fusionEntries = Array.isArray(pokemon.fusion) ? pokemon.fusion : [];
  const fusionFormId = parseFusionId(fusion.fusion_form);
  const storedFusionIds = parseFusionIdsFromStoredObject(fusion.storedFusionObject);
  const idCandidates = Array.from(
    new Set(
      [
        fusionFormId,
        ...storedFusionIds,
        typeof pokemon.fusion_id === 'number' ? pokemon.fusion_id : null,
        parseFusionIdFromVariantType(pokemon.variantType),
      ].filter((id): id is number => id != null),
    ),
  );
  const selectedFusionByState = findFusionEntry(
    fusionEntries as Array<{ fusion_id?: number | null; name?: string; moves?: Move[] }>,
    fusion,
  );
  const selectedFusion =
    selectedFusionByState ??
    idCandidates
      .map((candidateId) =>
        fusionEntries.find((entry) => entry.fusion_id === candidateId),
      )
      .find((entry) => entry != null);
  const selectedFusionId =
    typeof selectedFusion?.fusion_id === 'number'
      ? selectedFusion.fusion_id
      : idCandidates[0] ?? null;
  const selectedFusionMoves = Array.isArray(selectedFusion?.moves) ? selectedFusion.moves : [];

  if (selectedFusionMoves.length > 0) {
    const hasFusionFastMoves = selectedFusionMoves.some((move) => move.is_fast === 1);
    const baseUnscopedMoves = baseMoves.filter((move) => move?.fusion_id == null);
    const resolvedMoves = hasFusionFastMoves
      ? selectedFusionMoves
      : [...baseUnscopedMoves, ...selectedFusionMoves];

    log.debug('resolved fusion move pool', {
      fusionFormRaw: fusion.fusion_form ?? null,
      fusionFormId,
      storedFusionIds,
      variantType: pokemon.variantType ?? null,
      variantFusionId: typeof pokemon.fusion_id === 'number' ? pokemon.fusion_id : null,
      idCandidates,
      selectedFusionId: selectedFusionId ?? null,
      selectedFusionName: selectedFusion?.name ?? null,
      selectedFusionMoveCount: selectedFusionMoves.length,
      selectedFusionHasFast: hasFusionFastMoves,
      selectedFusionMode: hasFusionFastMoves ? 'strict_fusion_only' : 'base_plus_fusion',
      fusionEntries: fusionEntries.map((entry) => ({
        fusion_id: entry?.fusion_id ?? null,
        name: entry?.name ?? null,
        moveCount: Array.isArray(entry?.moves) ? entry.moves.length : 0,
      })),
    });
    return {
      moves: dedupeByMoveId(resolvedMoves),
      source: 'fusion',
      fusionId: selectedFusionId ?? null,
    };
  }

  // Back-compat fallback:
  // Some payloads carry fusion-specific learnsets only in top-level `moves`
  // via move.fusion_id (without fusion[].moves populated).
  const taggedFusionMoves =
    selectedFusionId == null
      ? []
      : baseMoves.filter((move) => move?.fusion_id === selectedFusionId);

  if (taggedFusionMoves.length > 0) {
    const fallbackMoves = [...taggedFusionMoves];

    log.debug('resolved fusion move pool from top-level fusion-tagged moves', {
      fusionFormRaw: fusion.fusion_form ?? null,
      fusionFormId,
      storedFusionIds,
      variantType: pokemon.variantType ?? null,
      variantFusionId: typeof pokemon.fusion_id === 'number' ? pokemon.fusion_id : null,
      idCandidates,
      selectedFusionId: selectedFusionId ?? null,
      selectedFusionName: selectedFusion?.name ?? null,
      selectedFusionMoveCount: selectedFusionMoves.length,
      taggedFusionMoveCount: taggedFusionMoves.length,
      fallbackMode: 'strict_tagged_only',
    });
    return {
      moves: dedupeByMoveId(fallbackMoves),
      source: 'fusion',
      fusionId: selectedFusionId ?? null,
    };
  }

  log.warn('fusion move pool missing for fused instance', {
    fusionFormRaw: fusion.fusion_form ?? null,
    fusionFormId,
    storedFusionIds,
    variantType: pokemon.variantType ?? null,
    variantFusionId: typeof pokemon.fusion_id === 'number' ? pokemon.fusion_id : null,
    idCandidates,
    selectedFusionId: selectedFusionId ?? null,
    selectedFusionName: selectedFusion?.name ?? null,
    selectedFusionMoveCount: selectedFusionMoves.length,
    fusionEntries: fusionEntries.map((entry) => ({
      fusion_id: entry?.fusion_id ?? null,
      name: entry?.name ?? null,
      moveCount: Array.isArray(entry?.moves) ? entry.moves.length : 0,
    })),
  });

  return {
    moves: [],
    source: 'fusion_missing',
    fusionId: selectedFusionId ?? null,
  };
};
