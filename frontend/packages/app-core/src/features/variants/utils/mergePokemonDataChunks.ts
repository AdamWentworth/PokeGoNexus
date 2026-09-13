import type {
  PokemonMovesChunk,
  PokemonRaidDataChunk,
  RaidBoss,
} from '@shared-contracts/pokemon';

import type { PokemonVariant } from '@/types/pokemonVariants';
import { matchFormsAndVariantType } from '@/utils/formMatcher';
import { mergePokemonMoveData } from '@pokemongonexus/shared-domain/pokemon-data';

export function mergePokemonMovesChunk(
  variants: PokemonVariant[],
  movesChunk: PokemonMovesChunk,
): PokemonVariant[] {
  return mergePokemonMoveData(variants, movesChunk);
}

function matchingRaidEntries(variant: PokemonVariant, raidBosses: RaidBoss[]): RaidBoss[] {
  return raidBosses.filter((raidBoss) =>
    matchFormsAndVariantType(variant.form, raidBoss.form, variant.variantType, {
      raidBossName: raidBoss.name,
      raidBossTier: raidBoss.tier,
      raidBossCostumeId: raidBoss.costume_id,
      variantName: variant.species_name || variant.name,
    }),
  );
}

export function mergePokemonRaidDataChunk(
  variants: PokemonVariant[],
  raidDataChunk: PokemonRaidDataChunk,
): PokemonVariant[] {
  const raidsByPokemonID = new Map(
    raidDataChunk.map((entry) => [Number(entry.pokemon_id), entry.raid_boss ?? []]),
  );

  return variants.map((variant) => {
    const raidBosses = raidsByPokemonID.get(Number(variant.pokemon_id));
    if (!raidBosses) return variant;

    const matchingEntries = matchingRaidEntries(variant, raidBosses);
    if (matchingEntries.length === 0) {
      const variantWithoutRaidData: PokemonVariant = { ...variant };
      delete variantWithoutRaidData.raid_boss;
      return variantWithoutRaidData;
    }

    return { ...variant, raid_boss: matchingEntries };
  });
}
