import { determineImageUrl } from '@/utils/imageHelpers';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonDisplayAttributes } from './pokemonDisplayModel';
import { resolvePokemonInstanceImagePath } from '@pokemongonexus/shared-domain/pokemon-display';

export type PokemonDisplayAttributeSource = PokemonVariant & {
  instanceData?: Partial<PokemonInstance>;
};

export const resolvePokemonDisplayAttributes = (
  pokemon: PokemonDisplayAttributeSource,
): PokemonDisplayAttributes => {
  const ownership = pokemon.instanceData;
  const variantType = pokemon.variantType || '';

  return {
    isDisabled: ownership?.disabled === true,
    isFemale: ownership?.gender === 'Female',
    isMega: ownership?.is_mega === true,
    megaForm: ownership?.mega_form ?? undefined,
    isFused: ownership?.is_fused ?? undefined,
    fusionForm: ownership?.fusion_form ?? undefined,
    isCrown: ownership?.crown === true,
    isPurified: ownership?.purified === true,
    isDynamax:
      ownership?.dynamax === true ||
      ownership?.gigantamax === true ||
      variantType.includes('dynamax') ||
      variantType.includes('gigantamax'),
    isGigantamax: ownership?.gigantamax === true || variantType.includes('gigantamax'),
  };
};

export const resolvePokemonDisplayImageUrl = ({
  pokemon,
  attributes,
  crownForm,
}: {
  pokemon: PokemonVariant;
  attributes: PokemonDisplayAttributes;
  crownForm?: string | null;
}): string => {
  if (attributes.isDisabled) {
    return `/images/disabled/disabled_${pokemon.pokemon_id}.png`;
  }

  if (pokemon.instanceData) {
    // Instance editors keep draft form/gender state outside instanceData until
    // the user saves. Apply that draft state before asking the shared artwork
    // resolver so changing a control updates the preview immediately.
    const draftInstance: Partial<PokemonInstance> = {
      ...pokemon.instanceData,
      disabled: Boolean(attributes.isDisabled),
      gender: attributes.isFemale
        ? 'Female'
        : pokemon.instanceData.gender === 'Female' ? 'Male' : pokemon.instanceData.gender,
      is_mega: Boolean(attributes.isMega),
      mega: Boolean(attributes.isMega),
      mega_form: attributes.megaForm ?? null,
      is_fused: Boolean(attributes.isFused),
      fusion_form: attributes.isCrown
        ? (crownForm ?? attributes.crownForm ?? pokemon.instanceData.fusion_form ?? null)
        : (attributes.fusionForm ?? null),
      purified: Boolean(attributes.isPurified),
      gigantamax: Boolean(attributes.isGigantamax),
      crown: Boolean(attributes.isCrown),
    };
    return resolvePokemonInstanceImagePath(
      draftInstance,
      pokemon,
      pokemon.currentImage,
    );
  }

  return determineImageUrl(
    Boolean(attributes.isFemale),
    pokemon,
    Boolean(attributes.isMega),
    attributes.megaForm ?? undefined,
    Boolean(attributes.isFused),
    attributes.fusionForm ?? undefined,
    Boolean(attributes.isPurified),
    Boolean(attributes.isGigantamax),
    Boolean(attributes.isCrown),
    crownForm ?? attributes.crownForm ?? undefined,
  );
};
