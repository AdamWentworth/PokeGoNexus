import type { PokemonVariant } from "../../../types/pokemonVariants";
import { getPrimaryRaidMetadataForVariant } from "./raidCatalog";
import type { RaidTierPreset, SuperMegaShieldRules } from "./raidTypes";

const CURATED_SHIELD_COUNTS: Readonly<Record<number, number>> = {
  71: 8,
  149: 10,
  150: 10,
  227: 7,
  687: 8,
  870: 8,
};

export const SUPER_MEGA_TRIGGER_HP_FRACTION = 0.8;
export const SUPER_MEGA_SHIELDED_DEFENSE_MULTIPLIER = 4;
export const SUPER_MEGA_ENRAGED_ATTACK_MULTIPLIER = 1.8;
export const SUPER_MEGA_FALLBACK_SHIELD_COUNT = 8;

export const isSuperMegaRaid = (tier: RaidTierPreset): boolean =>
  tier.key === "super-mega";

export const canBreakSuperMegaShield = (variant: PokemonVariant): boolean => {
  const variantType = (variant.variantType ?? "").toLowerCase();
  return (
    !variant.primal &&
    !variantType.includes("primal") &&
    (variantType.includes("mega") ||
      (variant.raidRoster?.formSource === "mega" &&
        !variantType.includes("primal")))
  );
};

export const getSuperMegaShieldRules = (
  boss: PokemonVariant,
  tier: RaidTierPreset,
): SuperMegaShieldRules | null => {
  if (!isSuperMegaRaid(tier)) return null;

  const metadataCount = Number(
    getPrimaryRaidMetadataForVariant(boss)?.shield_count ?? 0,
  );
  const curatedCount = CURATED_SHIELD_COUNTS[boss.pokemon_id];
  const shieldCount =
    metadataCount > 0
      ? metadataCount
      : (curatedCount ?? SUPER_MEGA_FALLBACK_SHIELD_COUNT);

  return {
    shieldCount,
    shieldCountSource:
      metadataCount > 0 ? "catalog" : curatedCount ? "curated" : "fallback",
    triggerHpFraction: SUPER_MEGA_TRIGGER_HP_FRACTION,
    shieldedDefenseMultiplier: SUPER_MEGA_SHIELDED_DEFENSE_MULTIPLIER,
    enragedAttackMultiplier: SUPER_MEGA_ENRAGED_ATTACK_MULTIPLIER,
  };
};
