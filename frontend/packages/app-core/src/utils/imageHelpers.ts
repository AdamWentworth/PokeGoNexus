// imageHelpers.ts

import type { PokemonVariant } from '../types/pokemonVariants';
import type { Costume, CrownForm, FemaleVariantData, MegaEvolution } from '../types/pokemonSubTypes';
import { resolveActiveCrownForm } from './crownHelpers';

const DEFAULT_IMAGE_URL = '/images/default_pokemon.png';
// Image selection is consumed by both Vite and React Native. Keep this pure so
// Metro does not pull the Vite-only import.meta logger into its bundle.
const log = { warn: (..._args: unknown[]) => undefined };
type VariantImageData = Partial<PokemonVariant> & Partial<FemaleVariantData>;

export function determineImageUrl(
  isFemale: boolean,
  pokemon: PokemonVariant,
  isMega: boolean = false,
  megaForm?: string,
  isFused: boolean = false,
  fusionForm?: string,
  isPurified: boolean = false,
  gigantamax: boolean = false,
  isCrown: boolean = false,
  crownForm?: string,
): string {
  if (!pokemon) {
    log.warn('determineImageUrl called without a valid pokemon object.');
    return DEFAULT_IMAGE_URL;
  }

  if (pokemon.pokemon_id === 2301 || pokemon.pokemon_id === 2302) {
    if (!isPurified) {
      return pokemon.image_url_shadow || DEFAULT_IMAGE_URL;
    }
  }

  const isPurifiedShiny = isPurified && pokemon.variantType.includes('shiny');
  const isShiny = isPurifiedShiny || pokemon.variantType.includes('shiny');
  const variantType = (pokemon.variantType || '').toLowerCase();

  const firstImage = (...urls: Array<string | null | undefined>): string | null =>
    urls.find((url): url is string => Boolean(url)) ?? null;

  const getCostumeImage = (
    costumes: Costume[] | undefined,
    variantType: string,
    isFemale: boolean,
    isShiny: boolean
  ): string | null => {
    const costumeIdMatch = variantType.match(/_(\d+)/);
    if (!costumeIdMatch || !costumes) return null;

    const costumeId = costumeIdMatch[1];
    const costume = costumes.find(c => c.costume_id.toString() === costumeId);
    if (!costume) return null;

    if (variantType.includes('shadow_') && costume.shadow_costume) {
      const shadow = costume.shadow_costume;
      if (isShiny) {
        return firstImage(
          isFemale ? shadow.image_url_female_shiny_shadow_costume : null,
          shadow.image_url_shiny_shadow_costume,
          DEFAULT_IMAGE_URL,
        );
      }
      return firstImage(
        isFemale ? shadow.image_url_female_shadow_costume : null,
        shadow.image_url_shadow_costume,
        DEFAULT_IMAGE_URL,
      );
    }

    if (variantType.includes('costume')) {
      if (isShiny) {
        return firstImage(
          isFemale ? costume.image_url_shiny_female : null,
          costume.image_url_shiny,
          DEFAULT_IMAGE_URL,
        );
      }
      return firstImage(
        isFemale ? costume.image_url_female : null,
        costume.image_url,
        DEFAULT_IMAGE_URL,
      );
    }

    return null;
  };

  const getVariantImage = (
    data: VariantImageData,
    variantType: string,
    isShiny: boolean,
    defaultUrl: string
  ): string => {
    if (variantType.includes('shadow')) {
      return (
        firstImage(
          isShiny
            ? data.image_url_shiny_shadow || data.shiny_shadow_image_url
            : data.image_url_shadow || data.shadow_image_url,
          defaultUrl
        ) ?? defaultUrl
      );
    }

    return (
      firstImage(isShiny ? data.image_url_shiny || data.shiny_image_url : data.image_url, defaultUrl) ??
      defaultUrl
    );
  };

  const handleMegaEvolution = (): string | null => {
    if (!isMega || !Array.isArray(pokemon.megaEvolutions) || pokemon.megaEvolutions.length === 0) {
      return null;
    }

    let megaEvolution: MegaEvolution;

    if (pokemon.megaEvolutions.length === 1 || !megaForm) {
      megaEvolution = pokemon.megaEvolutions[0];
    } else {
      megaEvolution =
        pokemon.megaEvolutions.find(me => me.form?.toLowerCase() === megaForm.toLowerCase()) ||
        pokemon.megaEvolutions[0];
    }

    const megaVariantType = (megaEvolution?.variantType || '').toLowerCase();

    if (megaVariantType.includes('costume')) {
      const costumeImage = getCostumeImage(
        megaEvolution?.costumes,
        megaVariantType,
        isFemale,
        isShiny
      );
      if (costumeImage) return costumeImage;
    }

    if (isFemale && megaEvolution?.female_data) {
      const baseMegaImage = getVariantImage(
        megaEvolution as VariantImageData,
        megaVariantType,
        isShiny,
        megaEvolution.image_url || DEFAULT_IMAGE_URL
      );

      return getVariantImage(
        megaEvolution.female_data,
        megaVariantType,
        isShiny,
        baseMegaImage
      );
    }

    return isShiny
      ? megaEvolution?.image_url_shiny || megaEvolution?.image_url || DEFAULT_IMAGE_URL
      : megaEvolution?.image_url || DEFAULT_IMAGE_URL;
  };

  const megaImage = handleMegaEvolution();
  if (megaImage) return megaImage;

  const handleCrownForm = (): string | null => {
    if (!isCrown || !Array.isArray(pokemon.crownForms) || pokemon.crownForms.length === 0) {
      return null;
    }
    const selected = resolveActiveCrownForm(
      pokemon.crownForms as CrownForm[] | undefined,
      crownForm,
    );
    if (!selected) return null;
    return isShiny
      ? selected.image_url_shiny || selected.image_url || DEFAULT_IMAGE_URL
      : selected.image_url || DEFAULT_IMAGE_URL;
  };

  const crownImage = handleCrownForm();
  if (crownImage) return crownImage;

  if (isPurified) {
    if (isPurifiedShiny && pokemon.image_url_shiny) {
      return pokemon.image_url_shiny;
    } else if (pokemon.image_url) {
      return pokemon.image_url;
    }
  }

  if (variantType.includes('fusion')) {
    return pokemon.currentImage || DEFAULT_IMAGE_URL
  }

  if (isFused && fusionForm && Array.isArray(pokemon.fusion)) {
    const fusionEntry = pokemon.fusion.find(f => f.name === fusionForm);
    if (fusionEntry) {
      return (
        (isShiny ? fusionEntry.image_url_shiny : fusionEntry.image_url) || DEFAULT_IMAGE_URL
      );
    }
  }

  if (variantType === 'gigantamax' || variantType === 'shiny_gigantamax') {
    return pokemon.currentImage || DEFAULT_IMAGE_URL;
  }

  if (gigantamax && Array.isArray(pokemon.max) && pokemon.max.length > 0) {
    const maxEntry = pokemon.max[0];
    return (
      (isShiny
        ? maxEntry.shiny_gigantamax_image_url
        : maxEntry.gigantamax_image_url) || DEFAULT_IMAGE_URL
    );
  }

  const handleNonMegaEvolution = (): string => {
    if (isFemale && pokemon.female_data) {
      const costumeImage = getCostumeImage(pokemon.costumes, variantType, isFemale, isShiny);
      if (costumeImage) return costumeImage;

      const baseVariantImage = getVariantImage(
        pokemon,
        variantType,
        isShiny,
        pokemon.currentImage || pokemon.image_url || DEFAULT_IMAGE_URL
      );

      return getVariantImage(
        pokemon.female_data,
        variantType,
        isShiny,
        baseVariantImage
      );
    }

    const costumeImage = getCostumeImage(pokemon.costumes, variantType, isFemale, isShiny);
    if (costumeImage) return costumeImage;

    return getVariantImage(
      pokemon,
      variantType,
      isShiny,
      pokemon.image_url || DEFAULT_IMAGE_URL
    );
  };

  return handleNonMegaEvolution();
}

export function getTypeIconPath(typeName?: string | null): string {
  const normalizedType = typeName?.trim().toLowerCase() || 'normal';
  return `/images/types/${normalizedType}.png`;
}
