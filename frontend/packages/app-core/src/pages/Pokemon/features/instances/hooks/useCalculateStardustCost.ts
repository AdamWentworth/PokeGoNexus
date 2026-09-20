// src/hooks/useCalculateStardustCost.ts

import { useEffect, useState } from 'react';
import { parseVariantId } from '@/utils/PokemonIDUtils';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import { calculateTradeCost } from '@pokemongonexus/shared-domain/trade-cost';

interface UseCalculateStardustCostResult {
  stardustCost: number;
  isSpecialTrade: boolean;
  isRegisteredTrade: boolean;
}

export const useCalculateStardustCost = (
  friendshipLevel: number,
  passedInPokemon: PokemonVariant | null,
  selectedMatchedInstance: PokemonInstance | null,
  myInstances: Instances,
  instances: Instances
): UseCalculateStardustCostResult => {
  const [stardustCost, setStardustCost] = useState(0);
  const [isSpecialTrade, setIsSpecialTrade] = useState(false);
  const [isRegisteredTrade, setIsRegisteredTrade] = useState(false);

  useEffect(() => {
    const result = calculateTradeCost({
      friendshipLevel,
      receivedPokemon: passedInPokemon,
      offeredInstance: selectedMatchedInstance,
      currentTrainerInstances: myInstances,
      partnerInstances: instances,
      parseVariantId,
    });
    setStardustCost(result.stardustCost);
    setIsSpecialTrade(result.isSpecialTrade);
    setIsRegisteredTrade(result.isRegisteredTrade);
  }, [
    friendshipLevel,
    passedInPokemon,
    selectedMatchedInstance,
    myInstances,
    instances,
  ]);

  return { stardustCost, isSpecialTrade, isRegisteredTrade };
};
export default useCalculateStardustCost;
