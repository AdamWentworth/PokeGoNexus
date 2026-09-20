import type {
  InstancesMap,
  PokemonInstance,
} from '@pokemongonexus/shared-contracts/instances';

export type TradeCandidatePokemon = Record<string, unknown> & {
  key?: string;
  name?: string;
  variantType?: string;
  instanceData?: Partial<PokemonInstance>;
};

export interface TradeCandidateSets {
  selectedBaseKey: string;
  hashedInstances: InstancesMap;
  caughtInstances: PokemonInstance[];
  tradeableInstances: PokemonInstance[];
}

export type MatchedTradeCandidate = TradeCandidatePokemon & {
  instanceData: PokemonInstance;
};

export interface TradeCandidatePayload {
  matchedInstances: MatchedTradeCandidate[];
  [key: string]: unknown;
}

export type TradeCandidateDecision =
  | { kind: 'noCaught' }
  | { kind: 'onlyTradeLocked' }
  | {
      kind: 'needsTradeSelection';
      selectedBaseKey: string;
      caughtInstances: PokemonInstance[];
    }
  | { kind: 'noAvailableTradeable' }
  | { kind: 'proposalReady'; payload: TradeCandidatePayload };

interface ActiveTradeRow {
  trade_status?: string;
  pokemon_instance_id_user_proposed?: string | null;
  pokemon_instance_id_user_accepting?: string | null;
}

const TRAILING_INSTANCE_UUID =
  /_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export const parseTradeVariantReference = (
  input: string,
): { baseKey: string } => ({
  baseKey: input.trim().replace(TRAILING_INSTANCE_UUID, ''),
});

const canonicalizeVariantId = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return '';

  const separatorIndex = raw.indexOf('-');
  if (separatorIndex < 0) return raw;

  return `${raw.slice(0, separatorIndex)}-${raw
    .slice(separatorIndex + 1)
    .replace(/-/g, '_')}`;
};

export const resolveSelectedVariantId = (
  selectedPokemon: TradeCandidatePokemon,
  parseVariantId: (input: string) => { baseKey: string },
): string => {
  const nestedInstance = selectedPokemon.instanceData;
  const directVariant = canonicalizeVariantId(selectedPokemon.variant_id);
  if (directVariant) return directVariant;

  const nestedVariant = canonicalizeVariantId(nestedInstance?.variant_id);
  if (nestedVariant) return nestedVariant;

  const pokemonId = Number(selectedPokemon.pokemon_id);
  const variantType =
    typeof selectedPokemon.variantType === 'string'
      ? selectedPokemon.variantType
      : '';
  if (Number.isFinite(pokemonId) && pokemonId > 0 && variantType) {
    return canonicalizeVariantId(
      `${String(pokemonId).padStart(4, '0')}-${variantType}`,
    );
  }

  return canonicalizeVariantId(
    parseVariantId(String(selectedPokemon.key ?? '')).baseKey,
  );
};

export const toInstanceMap = (
  userInstances: PokemonInstance[],
): InstancesMap =>
  userInstances.reduce((instances, instance) => {
    const instanceId = String(instance.instance_id ?? '');
    instances[instanceId] = instance;
    return instances;
  }, {} as InstancesMap);

export const findCaughtInstancesForBaseKey = (
  userInstances: PokemonInstance[],
  baseKey: string,
  parseVariantId: (input: string) => { baseKey: string },
): PokemonInstance[] =>
  userInstances.filter((instance) => {
    const instanceVariantId = canonicalizeVariantId(instance.variant_id);
    const instanceBaseKey =
      instanceVariantId ||
      canonicalizeVariantId(
        parseVariantId(String(instance.instance_id ?? '')).baseKey,
      );

    return (
      instanceBaseKey === canonicalizeVariantId(baseKey) &&
      instance.is_caught === true
    );
  });

export const findTradeableInstances = (
  caughtInstances: PokemonInstance[],
): PokemonInstance[] =>
  caughtInstances.filter(
    (instance) => instance.is_for_trade === true && instance.lucky !== true,
  );

export const canMarkInstanceForTrade = (
  instance: PokemonInstance,
): boolean => instance.is_caught === true && instance.lucky !== true;

const isActiveTrade = (trade: unknown): trade is ActiveTradeRow => {
  if (!trade || typeof trade !== 'object') return false;

  const row = trade as ActiveTradeRow;
  return row.trade_status === 'proposed' || row.trade_status === 'pending';
};

export const findAvailableTradeInstances = (
  tradeableInstances: PokemonInstance[],
  allTrades: unknown[],
): PokemonInstance[] => {
  const activeTrades = allTrades.filter(isActiveTrade);

  return tradeableInstances.filter((instance) => {
    const instanceId = String(instance.instance_id ?? '');
    return !activeTrades.some(
      (trade) =>
        trade.pokemon_instance_id_user_proposed === instanceId ||
        trade.pokemon_instance_id_user_accepting === instanceId,
    );
  });
};

export const buildMatchedTradeCandidates = (
  selectedPokemon: TradeCandidatePokemon,
  availableInstances: PokemonInstance[],
): TradeCandidatePayload => {
  const baseData = { ...selectedPokemon };
  delete baseData.instanceData;

  return {
    matchedInstances: availableInstances.map((instance) => ({
      ...baseData,
      instanceData: { ...instance },
    })),
  };
};

export const prepareTradeCandidateSets = (
  selectedPokemon: TradeCandidatePokemon,
  userInstances: PokemonInstance[],
  parseVariantId: (input: string) => { baseKey: string },
): TradeCandidateSets => {
  const selectedBaseKey = resolveSelectedVariantId(
    selectedPokemon,
    parseVariantId,
  );
  const hashedInstances = toInstanceMap(userInstances);
  const caughtInstances = findCaughtInstancesForBaseKey(
    userInstances,
    selectedBaseKey,
    parseVariantId,
  );
  const tradeableInstances = findTradeableInstances(caughtInstances);

  return {
    selectedBaseKey,
    hashedInstances,
    caughtInstances,
    tradeableInstances,
  };
};

export const resolveTradeCandidateDecision = (
  selectedPokemon: TradeCandidatePokemon,
  selectedBaseKey: string,
  caughtInstances: PokemonInstance[],
  tradeableInstances: PokemonInstance[],
  allTrades: unknown[],
): TradeCandidateDecision => {
  if (caughtInstances.length === 0) return { kind: 'noCaught' };

  const eligibleCaughtInstances = caughtInstances.filter(
    canMarkInstanceForTrade,
  );
  if (eligibleCaughtInstances.length === 0) {
    return { kind: 'onlyTradeLocked' };
  }

  if (tradeableInstances.length === 0) {
    return {
      kind: 'needsTradeSelection',
      selectedBaseKey,
      caughtInstances: eligibleCaughtInstances,
    };
  }

  const availableInstances = findAvailableTradeInstances(
    tradeableInstances,
    allTrades,
  );
  if (availableInstances.length === 0) {
    return { kind: 'noAvailableTradeable' };
  }

  return {
    kind: 'proposalReady',
    payload: buildMatchedTradeCandidates(selectedPokemon, availableInstances),
  };
};
