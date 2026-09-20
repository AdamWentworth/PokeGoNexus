import type { PokemonVariant } from '../types/pokemonVariants';

/**
 * Pure catalog variant identifier builder. Kept separate from UUID utilities
 * so non-web hosts can reuse catalog projection without loading browser/ESM
 * UUID machinery.
 */
export const determineVariantId = (pokemon: PokemonVariant): string => {
  const paddedId = pokemon.pokemon_id.toString().padStart(4, '0');
  const variantType = pokemon.variantType;

  if (Array.isArray(pokemon.costumes)) {
    for (const costume of pokemon.costumes) {
      const { name, image_url: imageUrl, image_url_shiny: shinyImageUrl, shadow_costume: shadowCostume } = costume;
      if (pokemon.currentImage === imageUrl) return `${paddedId}-${name}_default`;
      if (pokemon.currentImage === shinyImageUrl) return `${paddedId}-${name}_shiny`;
      if (shadowCostume) {
        if (pokemon.currentImage === shadowCostume.image_url_shadow_costume) {
          return `${paddedId}-shadow_${name}_default`;
        }
        if (pokemon.currentImage === shadowCostume.image_url_shiny_shadow_costume) {
          return `${paddedId}-shadow_${name}_shiny`;
        }
      }
    }
  }

  const explicitSuffixTypes = new Set([
    'gigantamax',
    'shiny_gigantamax',
    'dynamax',
    'shiny_dynamax',
    'primal',
    'shiny_primal',
  ]);
  if (
    variantType.startsWith('mega')
    || variantType.startsWith('shiny_mega')
    || variantType.startsWith('fusion_')
    || variantType.startsWith('shiny_fusion_')
    || explicitSuffixTypes.has(variantType)
  ) {
    return `${paddedId}-${variantType}`;
  }

  if (pokemon.currentImage === pokemon.image_url) return `${paddedId}-default`;
  if (pokemon.currentImage === pokemon.image_url_shadow) return `${paddedId}-shadow`;
  if (pokemon.currentImage === pokemon.image_url_shiny) return `${paddedId}-shiny`;
  if (pokemon.currentImage === pokemon.image_url_shiny_shadow) return `${paddedId}-shiny_shadow`;
  return paddedId;
};
