import type {
  InstancesMap,
  PokemonInstance,
} from '@pokemongonexus/shared-contracts/instances';

const REGISTERED_REGULAR_COST = 100;
const MAX_COST = 1_000_000;

const UNREGISTERED_REGULAR_COST: Record<number, number> = {
  1: 20_000,
  2: 16_000,
  3: 1_600,
  4: 800,
  5: 800,
};

const UNREGISTERED_SPECIAL_COST: Record<number, number> = {
  1: 1_000_000,
  2: 800_000,
  3: 80_000,
  4: 40_000,
  5: 40_000,
};

const REGISTERED_SPECIAL_COST: Record<number, number> = {
  1: 20_000,
  2: 16_000,
  3: 1_600,
  4: 800,
  5: 800,
};

export type TradeCostPokemon = {
  variant_id?: string;
  rarity?: string | null;
  instanceData?: Partial<PokemonInstance> | null;
};

export type TradeCostResult = {
  stardustCost: number;
  isSpecialTrade: boolean;
  isRegisteredTrade: boolean;
};

export type CalculateTradeCostInput = {
  friendshipLevel: number;
  /** The Pokémon the current trainer will receive. */
  receivedPokemon: TradeCostPokemon | null;
  /** The current trainer's exact offered instance. */
  offeredInstance: Partial<PokemonInstance> | null;
  /** Used to determine whether the received species is registered. */
  currentTrainerInstances: InstancesMap;
  /** Used to determine whether the offered species is registered for the partner. */
  partnerInstances: InstancesMap;
  parseVariantId: (input: string) => { baseKey: string };
};

export const isTradePokemonRegistered = (
  instanceReference: string,
  instances: InstancesMap,
  parseVariantId: (input: string) => { baseKey: string },
): boolean => {
  if (!instanceReference || !instances) return false;

  const { baseKey } = parseVariantId(instanceReference);
  return Object.entries(instances).some(([key, instance]) => {
    const candidateReference = instance.variant_id?.trim() || key;
    return (
      parseVariantId(candidateReference).baseKey === baseKey
      && Boolean(instance.registered)
    );
  });
};

export const calculateTradeCost = ({
  friendshipLevel,
  receivedPokemon,
  offeredInstance,
  currentTrainerInstances,
  partnerInstances,
  parseVariantId,
}: CalculateTradeCostInput): TradeCostResult => {
  if (!receivedPokemon || !offeredInstance) {
    return {
      stardustCost: 0,
      isSpecialTrade: false,
      isRegisteredTrade: false,
    };
  }

  const isSpecialTrade = Boolean(
    receivedPokemon.instanceData?.shiny
      || receivedPokemon.rarity === 'Legendary'
      || offeredInstance.shiny
      || offeredInstance.rarity === 'Legendary',
  );
  const receivedInstanceReference =
    receivedPokemon.instanceData?.variant_id
      ?? receivedPokemon.variant_id
      ?? receivedPokemon.instanceData?.instance_id
      ?? '';
  const offeredInstanceReference = offeredInstance.variant_id
    ?? offeredInstance.instance_id
    ?? '';
  const receivedIsRegistered = isTradePokemonRegistered(
    receivedInstanceReference,
    currentTrainerInstances,
    parseVariantId,
  );
  const offeredIsRegistered = isTradePokemonRegistered(
    offeredInstanceReference,
    partnerInstances,
    parseVariantId,
  );
  const isRegisteredTrade = receivedIsRegistered && offeredIsRegistered;

  if (isSpecialTrade) {
    return {
      stardustCost: isRegisteredTrade
        ? REGISTERED_SPECIAL_COST[friendshipLevel] ?? MAX_COST
        : UNREGISTERED_SPECIAL_COST[friendshipLevel] ?? MAX_COST,
      isSpecialTrade,
      isRegisteredTrade,
    };
  }

  return {
    stardustCost: isRegisteredTrade
      ? REGISTERED_REGULAR_COST
      : UNREGISTERED_REGULAR_COST[friendshipLevel] ?? REGISTERED_REGULAR_COST,
    isSpecialTrade,
    isRegisteredTrade,
  };
};
