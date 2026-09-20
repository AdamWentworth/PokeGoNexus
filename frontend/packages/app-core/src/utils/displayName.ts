// src/utils/pokemonDisplayName.ts
import { formatCostumeName } from './formattingHelpers';
import type { PokemonVariant } from '../types/pokemonVariants';

export function getDisplayName(pokemon: PokemonVariant): string {
  // Use the unmodified species name as the base name to avoid duplicating prefixes.
  const baseName = pokemon.species_name || pokemon.name;

  // Special casing for exact variant types
  switch (pokemon.variantType) {
    case 'shiny':
      return `Shiny ${baseName}`;
    case 'shadow':
      return `Shadow ${baseName}`;
    case 'shiny_shadow':
      return `Shiny Shadow ${baseName}`;
    case 'dynamax':
      return `Dynamax ${baseName}`;
    case 'shiny_dynamax':
      return `Shiny Dynamax ${baseName}`;
    case 'gigantamax':
      return `Gigantamax ${baseName}`;
    case 'shiny_gigantamax':
      return `Shiny Gigantamax ${baseName}`;
    case 'primal':
      return `Primal ${baseName}`;
    case 'shiny_primal':
      return `Shiny Primal ${baseName}`;
  }

  // Costume variants: extract and format the costume name
  if (pokemon.variantType.startsWith('costume_')) {
    const parts = pokemon.variantType.split('_');
    const costumeId = parts[1];
    const isShiny = parts.includes('shiny');
    const costume = pokemon.costumes?.find(c => c.costume_id.toString() === costumeId);

    if (costume) {
      const formatted = formatCostumeName(costume.name);
      return isShiny ? `Shiny ${formatted} ${baseName}` : `${formatted} ${baseName}`;
    }
  }

  // Shadow costume variants
  if (
    pokemon.variantType.startsWith('shadow_costume_') ||
    pokemon.variantType.startsWith('shiny_shadow_costume_')
  ) {
    const isShiny = pokemon.variantType.startsWith('shiny_');
    const prefix = isShiny ? 'shiny_shadow_costume_' : 'shadow_costume_';
    const costumeId = pokemon.variantType.slice(prefix.length);
    const costume = pokemon.costumes?.find(c => c.costume_id.toString() === costumeId);
    if (costume) {
      const formatted = formatCostumeName(costume.name);
      return `${isShiny ? 'Shiny ' : ''}Shadow ${formatted} ${baseName}`;
    }
  }

  // Mega variants – note the order is important so that shiny mega is handled separately.
  if (pokemon.variantType.startsWith('shiny_mega')) {
    // Append the mega form suffix, if present (e.g. "X" or "Y").
    const formSuffix = pokemon.megaForm ? ` ${pokemon.megaForm}` : '';
    return `Shiny Mega ${baseName}${formSuffix}`;
  }
  if (pokemon.variantType.startsWith('mega')) {
    // Append the mega form suffix, if present.
    const formSuffix = pokemon.megaForm ? ` ${pokemon.megaForm}` : '';
    return `Mega ${baseName}${formSuffix}`;
  }

  // Fusion variants
  if (pokemon.variantType.startsWith('fusion_')) {
    return pokemon.name;
  }
  if (pokemon.variantType.startsWith('shiny_fusion_')) {
    return `Shiny ${pokemon.name}`;
  }

  // Fallback: use the base name.
  return baseName;
}
