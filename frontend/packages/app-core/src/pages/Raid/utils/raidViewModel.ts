import type { PokemonVariant } from "@/types/pokemonVariants";
import { resolveAssetUrl } from "@/utils/assetUrl";
import { getTypeIconPath } from "@/utils/imageHelpers";
import { getVariantTypeNames } from "./raidCalculations";
import type {
  FriendshipKey,
  MegaAllyBonusKey,
  PartyPowerKey,
  PartyPowerStrategy,
  RaidCounterScore,
  RaidCounterSettings,
  RaidDodgeStrategy,
  RaidOverallScore,
  RaidTypeDpsScore,
} from "./raidCalculations";
import {
  getRaidVariantBadge,
  getRaidVariantDisplayName,
} from "./raidPresentationModel";
export { getRaidRosterDetail, getRaidVariantBadge, getRaidVariantDisplayName } from "./raidPresentationModel";

export type RaidViewMode = "rankings" | "boss";
export type RaidMetricSortKey = "eDps" | "dps" | "tdo" | "er" | "cp";
export type RaidMetricSortDirection = "ascending" | "descending";

type RaidMetricScore = Pick<RaidOverallScore, RaidMetricSortKey | "variant">;

export type SearchableCounterScore = {
  variant: PokemonVariant;
  fastMove: RaidCounterScore["fastMove"];
  chargedMove: RaidCounterScore["chargedMove"];
};

export const DEFAULT_RAID_RANKING_TYPE = "";
export const DEFAULT_METRIC_SORT: RaidMetricSortKey = "eDps";

export type RaidOutcomePresentation = {
  label: "Clear" | "Likely clear" | "Risky" | "Time expired";
  className: "won" | "likely" | "risky" | "lost";
};

export const getRaidOutcomePresentation = (
  winRate: number,
): RaidOutcomePresentation => {
  if (winRate >= 1) return { label: "Clear", className: "won" };
  if (winRate <= 0) return { label: "Time expired", className: "lost" };
  if (winRate >= 0.5) {
    return { label: "Likely clear", className: "likely" };
  }
  return { label: "Risky", className: "risky" };
};

export const FRIENDSHIP_OPTIONS: Array<{
  key: FriendshipKey;
  label: string;
}> = [
  { key: "none", label: "No friendship" },
  { key: "good", label: "Good" },
  { key: "great", label: "Great" },
  { key: "ultra", label: "Ultra" },
  { key: "best", label: "Best" },
];

export const MEGA_OPTIONS: Array<{
  key: MegaAllyBonusKey;
  label: string;
}> = [
  { key: "none", label: "No Mega ally" },
  { key: "general", label: "Mega ally" },
  { key: "matching", label: "Matching Mega" },
];

export const PARTY_POWER_OPTIONS: Array<{
  key: PartyPowerKey;
  label: string;
}> = [
  { key: "none", label: "No Party Power" },
  { key: "party2", label: "Party of 2" },
  { key: "party3", label: "Party of 3" },
  { key: "party4", label: "Party of 4" },
];

export const PARTY_POWER_STRATEGY_OPTIONS: Array<{
  key: PartyPowerStrategy;
  label: string;
}> = [
  { key: "immediate", label: "Activate as soon as ready" },
  { key: "next-charged", label: "Use on next Charged Attack" },
  { key: "strongest-charged", label: "Save for strongest Charged Attack" },
  { key: "manual", label: "Manual timing (no automatic use)" },
];

export const ATTACKER_LEVEL_OPTIONS: RaidCounterSettings["attackerLevel"][] = [
  "40.0",
  "50.0",
  "51.0",
];

export const RELOBBY_DELAY_OPTIONS = [0, 5, 10, 15, 20];

export const DODGE_OPTIONS: Array<{
  key: RaidDodgeStrategy;
  label: string;
}> = [
  { key: "none", label: "No dodging" },
  { key: "charged", label: "Dodge Charged Attacks" },
];

export const capitalize = (value: string): string =>
  value.length === 0
    ? value
    : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export const formatTypeList = (types: string[]): string =>
  types.map(capitalize).join(" / ");

export const getPokemonImage = (variant: PokemonVariant): string =>
  resolveAssetUrl(
    variant.currentImage || variant.image_url || variant.sprite_url || "",
  );

export const isMegaMewtwoY = (variant: PokemonVariant): boolean => {
  const megaForm = (variant.megaForm || variant.form || "")
    .trim()
    .toUpperCase();
  return (
    variant.pokemon_id === 150 &&
    variant.variantType.toLowerCase().includes("mega") &&
    megaForm === "Y"
  );
};

export const getVariantBadge = getRaidVariantBadge;

export const formatDps = (value: number): string => value.toFixed(1);
export const formatEr = (value: number): string => value.toFixed(2);
export const formatWholeNumber = (value: number): string =>
  Math.round(value).toLocaleString();

export const getMoveTypeName = (move: RaidTypeDpsScore["fastMove"]): string =>
  capitalize(move.type_name || move.type || "unknown");

export const getMoveTypeIcon = (
  move: SearchableCounterScore["fastMove"],
): string => getTypeIconPath(move.type_name || move.type || "unknown");

export const getTypeClassName = (typeName?: string): string =>
  `type-${(typeName || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")}`;

export const getUniqueByVariant = (
  variants: PokemonVariant[],
): PokemonVariant[] => {
  const seen = new Set<string>();
  return variants.filter((variant) => {
    const key =
      variant.variant_id || `${variant.pokemon_id}-${variant.variantType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const sortRaidMetricScores = <Score extends RaidMetricScore>(
  scores: Score[],
  metric: RaidMetricSortKey,
  direction: RaidMetricSortDirection,
): Score[] =>
  [...scores].sort((a, b) => {
    const difference = a[metric] - b[metric];
    if (difference !== 0) {
      return direction === "descending" ? -difference : difference;
    }

    return getRaidVariantDisplayName(a.variant).localeCompare(
      getRaidVariantDisplayName(b.variant),
    );
  });

export const matchesCounterSearch = (
  score: SearchableCounterScore,
  query: string,
): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const types = getVariantTypeNames(score.variant);

  return (
    getRaidVariantDisplayName(score.variant)
      .toLowerCase()
      .includes(normalized) ||
    score.fastMove.name.toLowerCase().includes(normalized) ||
    score.chargedMove.name.toLowerCase().includes(normalized) ||
    types.some((type) => type.includes(normalized))
  );
};
