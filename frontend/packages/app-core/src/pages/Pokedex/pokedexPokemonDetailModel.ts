import { getDisplayName as getFormattedPokemonDisplayName } from '../../utils/displayName';
import { getTypeIconPath } from '../../utils/imageHelpers';

import type { PokemonVariant } from '../../types/pokemonVariants';

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

export function getDexNumber(pokemon: PokemonVariant): number | null {
  return asNumber(pokemon.pokedex_number);
}

export function formatDexNumber(pokemon: PokemonVariant): string {
  const dexNumber = getDexNumber(pokemon);
  return dexNumber === null ? '----' : String(dexNumber).padStart(4, '0');
}

export function getSpeciesName(pokemon: PokemonVariant): string {
  return pokemon.name || pokemon.species_name;
}

export function normalizeVariantType(pokemon: PokemonVariant): string {
  return String(pokemon.variantType ?? '').toLowerCase();
}

export function getVariantCategory(pokemon: PokemonVariant): string {
  const variantType = normalizeVariantType(pokemon);

  if (variantType === 'shiny') return 'shiny';
  if (variantType.includes('fusion')) return variantType.includes('shiny') ? 'shiny fusion' : 'fusion';
  if (variantType.includes('gigantamax')) {
    return variantType.includes('shiny') ? 'shiny gigantamax' : 'gigantamax';
  }
  if (variantType.includes('dynamax')) {
    return variantType.includes('shiny') ? 'shiny dynamax' : 'dynamax';
  }
  if (variantType.includes('mega') || variantType.includes('primal')) {
    return variantType.includes('shiny') ? 'shiny mega' : 'mega';
  }
  if (variantType.includes('shiny') && variantType.includes('costume')) return 'shiny costume';
  if (variantType.includes('shiny') && variantType.includes('shadow')) return 'shiny shadow';
  if (variantType.includes('shadow') && variantType.includes('costume')) return 'shadow costume';
  if (variantType.includes('costume')) return 'costume';
  if (variantType.includes('shadow')) return 'shadow';

  return 'pokemon';
}

export function getDisplayName(pokemon: PokemonVariant): string {
  if (getVariantCategory(pokemon).includes('fusion')) {
    const fusionName = pokemon.species_name || pokemon.name;
    return isShinyVariant(pokemon) ? `Shiny ${fusionName}` : fusionName;
  }

  return getFormattedPokemonDisplayName(pokemon);
}

export function getVariantFamilyKey(pokemon: PokemonVariant): string {
  const variantType = normalizeVariantType(pokemon)
    .replace(/^shiny_/, '')
    .replace(/_shiny$/, '')
    .replace(/^shiny\s+/, '')
    .replace(/\s+shiny$/, '');

  if (variantType === 'shiny') return 'default';
  return variantType || 'default';
}

export function getFusionId(pokemon: PokemonVariant): number | null {
  const explicitFusionId = asNumber(pokemon.fusion_id);
  if (explicitFusionId !== null) return explicitFusionId;

  const variantType = normalizeVariantType(pokemon);
  const variantFusionMatch = variantType.match(/(?:^|_)fusion_(\d+)$/);
  if (!variantFusionMatch) return null;

  return asNumber(variantFusionMatch[1]);
}

export function isShinyVariant(pokemon: PokemonVariant): boolean {
  return normalizeVariantType(pokemon).includes('shiny');
}

export function isShadowVariant(pokemon: PokemonVariant): boolean {
  return getVariantCategory(pokemon).includes('shadow');
}

export function formatNumber(value: number | string | null | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toPrecision(12)).toString();
  }

  if (typeof value === 'string' && value.trim()) return value;
  return 'Unknown';
}

export function getTypeChips(pokemon: PokemonVariant): { label: string; icon: string }[] {
  return [
    pokemon.type1_name
      ? {
          label: pokemon.type1_name,
          icon: pokemon.type_1_icon || getTypeIconPath(pokemon.type1_name),
        }
      : null,
    pokemon.type2_name
      ? {
          label: pokemon.type2_name,
          icon: pokemon.type_2_icon || getTypeIconPath(pokemon.type2_name),
        }
      : null,
  ].filter((chip): chip is { label: string; icon: string } => Boolean(chip));
}
