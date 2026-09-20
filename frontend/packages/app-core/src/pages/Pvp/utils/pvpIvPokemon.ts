import type { PokemonVariant } from '../../../types/pokemonVariants';
import { getCrownFormLabel } from '../../../utils/crownHelpers';

export type PvPIvPokemonOption = {
  id: string;
  pokemonId: number;
  pokedexNumber: number;
  name: string;
  imageUrl: string;
  types: string[];
  attack: number;
  defense: number;
  stamina: number;
};

const validStats = (
  attack: unknown,
  defense: unknown,
  stamina: unknown,
): boolean =>
  Number(attack) > 0 &&
  Number(defense) > 0 &&
  Number(stamina) > 0;

const pokemonTypes = (
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string[] =>
  [primary, secondary]
    .map((type) => String(type ?? '').trim().toLowerCase())
    .filter(Boolean);

const isIvRankForm = (variant: PokemonVariant): boolean =>
  variant.variantType === 'default' ||
  variant.variantType.startsWith('fusion_');

export const buildPvPIvPokemonOptions = (
  variants: PokemonVariant[],
): PvPIvPokemonOption[] => {
  const options = new Map<string, PvPIvPokemonOption>();

  variants.forEach((variant) => {
    if (!isIvRankForm(variant)) return;
    if (!validStats(variant.attack, variant.defense, variant.stamina)) return;

    const name = String(variant.species_name || variant.name).trim();
    const key = [
      variant.pokemon_id,
      name.toLowerCase(),
      variant.attack,
      variant.defense,
      variant.stamina,
    ].join(':');

    if (!options.has(key)) {
      options.set(key, {
        id: variant.variant_id || key,
        pokemonId: variant.pokemon_id,
        pokedexNumber: variant.pokedex_number,
        name,
        imageUrl: variant.currentImage || variant.image_url || '',
        types: pokemonTypes(variant.type1_name, variant.type2_name),
        attack: Number(variant.attack),
        defense: Number(variant.defense),
        stamina: Number(variant.stamina),
      });
    }

    if (variant.variantType !== 'default') return;
    variant.crownForms?.forEach((crown) => {
      if (!validStats(crown.attack, crown.defense, crown.stamina)) return;
      const crownLabel = getCrownFormLabel(crown);
      const crownSpecies = String(crown.name || name).trim();
      const crownName =
        crownLabel &&
        !crownSpecies.toLowerCase().includes(crownLabel.toLowerCase())
          ? `${crownLabel} ${crownSpecies}`
          : crownSpecies || crownLabel || name;
      const crownKey = [
        variant.pokemon_id,
        'crown',
        crown.id,
        crown.attack,
        crown.defense,
        crown.stamina,
      ].join(':');

      options.set(crownKey, {
        id: `${variant.variant_id}:crown:${crown.id}`,
        pokemonId: variant.pokemon_id,
        pokedexNumber: variant.pokedex_number,
        name: crownName,
        imageUrl: crown.image_url || variant.currentImage || variant.image_url || '',
        types: pokemonTypes(
          crown.type1_name || variant.type1_name,
          crown.type2_name || variant.type2_name,
        ),
        attack: Number(crown.attack),
        defense: Number(crown.defense),
        stamina: Number(crown.stamina),
      });
    });
  });

  return Array.from(options.values()).sort((left, right) => (
    left.pokedexNumber - right.pokedexNumber ||
    left.name.localeCompare(right.name)
  ));
};
