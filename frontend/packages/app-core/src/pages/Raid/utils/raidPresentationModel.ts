import type { PokemonVariant } from '../../../types/pokemonVariants';
import {
  getRaidAttackerIvPercent,
  getRaidAttackerLevelLabel,
} from './raidAttackerModel';
import type { RaidCounterSettings } from './raidTypes';

const RAID_FUSION_NAMES: Readonly<Record<number, string>> = {
  1: 'Dusk Mane Necrozma',
  2: 'Dawn Wings Necrozma',
  3: 'White Kyurem',
  4: 'Black Kyurem',
};

const getFusionId = (variant: PokemonVariant): number | null => {
  const explicitId = Number(variant.fusion_id);
  if (Number.isInteger(explicitId) && explicitId > 0) return explicitId;

  const match = variant.variantType.toLowerCase().match(/fusion_(\d+)/);
  if (!match) return null;

  const variantTypeId = Number(match[1]);
  return Number.isInteger(variantTypeId) ? variantTypeId : null;
};

export const getRaidVariantDisplayName = (variant: PokemonVariant): string => {
  const variantType = variant.variantType.toLowerCase();
  if (!variantType.includes('fusion')) return variant.name;

  const fusionId = getFusionId(variant);
  const fusionName =
    (fusionId == null ? undefined : RAID_FUSION_NAMES[fusionId]) ||
    variant.fusion?.find((fusion) => fusion.fusion_id === fusionId)?.name ||
    variant.species_name ||
    variant.name;
  const normalizedName = fusionName.replace(/^Shiny\s+/i, '');
  const isShiny =
    variantType.includes('shiny') || /^Shiny\s+/i.test(variant.name);

  return `${isShiny ? 'Shiny ' : ''}${normalizedName}`;
};

export const getRaidVariantBadge = (variant: PokemonVariant): string => {
  const type = variant.variantType.toLowerCase();
  if (type.includes('shadow')) return 'Shadow';
  if (type.includes('primal')) return 'Primal';
  if (type.includes('mega')) return 'Mega';
  if (type.includes('fusion')) return 'Fusion';
  if (type.includes('dynamax')) return 'Dynamax';
  if (type.includes('gigantamax')) return 'Gigantamax';
  return 'Pokemon';
};

export const getRaidRosterDetail = (
  variant: PokemonVariant,
  fallbackLevel: RaidCounterSettings['attackerLevel'],
): string | null => {
  if (!variant.raidRoster) return null;

  const details: string[] = [];
  const nickname = variant.instanceData?.nickname?.trim();
  if (nickname) details.push(nickname);
  details.push(`Level ${getRaidAttackerLevelLabel(variant, fallbackLevel)}`);
  const ivPercent = getRaidAttackerIvPercent(variant);
  if (ivPercent != null) details.push(`${ivPercent}% IV`);
  if (variant.raidRoster.moveSource === 'estimated') {
    details.push('best legal moves estimated');
  } else if (variant.raidRoster.hiddenPowerTypeEstimated) {
    details.push('Hidden Power type estimated');
  }
  if (variant.raidRoster.levelSource === 'estimated') {
    details.push('level estimated');
  }
  if (variant.raidRoster.ivSource === 'estimated') {
    details.push('IVs estimated');
  }

  return details.join(' · ');
};
