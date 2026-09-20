import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

export {
  buildMatchedInstancesPayload,
  canMarkInstanceForTrade,
  findAvailableTradeInstances,
  findCaughtInstancesForBaseKey,
  findTradeableInstances,
  prepareTradeCandidateSets,
  resolveTradeProposalDecision,
  toInstanceMap,
} from '@/features/trades/proposal/proposalCandidateHelpers';
export type {
  MatchedInstancePokemon,
  SelectedPokemon,
  TradeCandidateSets,
  TradeProposalDecision,
  TradeProposalPayload,
} from '@/features/trades/proposal/proposalCandidateHelpers';

export type WantedOverlayPokemon = PokemonVariant & {
  instanceData: PokemonInstance;
};

export type BuildWantedOverlayPokemonResult =
  | { ok: true; pokemon: WantedOverlayPokemon }
  | { ok: false; error: 'variantNotFound' | 'instanceNotFound'; baseKey: string };

export const initializeSelection = (
  filterNames: string[],
  filters: Record<string, unknown>,
): boolean[] => filterNames.map((name) => !!filters[name]);

export const countVisibleWantedItems = (
  filteredWantedList: Record<string, unknown>,
  localNotWantedList: Record<string, boolean>,
  options: {
    editMode?: boolean;
    isMirror?: boolean;
    mirrorKey?: string | null;
  } = {},
): number =>
  Object.keys(filteredWantedList).filter((key) => {
    const isVisibleByFilter = options.editMode || !localNotWantedList[key];
    const isVisibleByMirror = !options.isMirror || key === options.mirrorKey;
    return isVisibleByFilter && isVisibleByMirror;
  }).length;

export const extractBaseKey = (instanceId: string): string => {
  const keyParts = String(instanceId).split('_');
  keyParts.pop();
  return keyParts.join('_');
};

export const buildWantedOverlayPokemon = (
  instanceId: string,
  variants: PokemonVariant[],
  instancesMap: Record<string, PokemonInstance>,
): BuildWantedOverlayPokemonResult => {
  const instanceEntry = instancesMap[instanceId];
  const baseKey = instanceEntry?.variant_id ?? extractBaseKey(instanceId);

  const variantData = variants.find((variant) => variant.variant_id === baseKey);
  if (!variantData) {
    return { ok: false, error: 'variantNotFound', baseKey };
  }

  if (!instanceEntry) {
    return { ok: false, error: 'instanceNotFound', baseKey };
  }

  return {
    ok: true,
    pokemon: {
      ...variantData,
      variant_id: variantData.variant_id ?? baseKey,
      instanceData: {
        ...variantData.instanceData,
        ...instanceEntry,
      },
    },
  };
};
