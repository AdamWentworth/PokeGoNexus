type FemaleData = {
  image_url?: string | null;
  shiny_image_url?: string | null;
  shadow_image_url?: string | null;
  shiny_shadow_image_url?: string | null;
};

type MaxData = {
  shiny_gigantamax_image_url?: string | null;
  gigantamax_image_url?: string | null;
};

type CostumeData = {
  name: string;
  image_url?: string | null;
  image_url_shiny?: string | null;
  image_url_shadow?: string | null;
  image_url_shiny_shadow?: string | null;
  image_url_female?: string | null;
  image_url_shiny_female?: string | null;
};

type SearchVariant = {
  name: string;
  form?: string | null;
  image_url?: string | null;
  image_url_shiny?: string | null;
  image_url_shadow?: string | null;
  image_url_shiny_shadow?: string | null;
  shadow_shiny_available?: boolean | number;
  female_unique?: number;
  female_data?: FemaleData;
  costumes?: CostumeData[];
  max?: MaxData[];
};

export const updateImage = (
  pokemonData: SearchVariant[],
  name: string,
  shinyChecked: boolean,
  shadowChecked: boolean,
  selectedCostume: string | null | undefined,
  form: string | null | undefined,
  selectedGender: string | null | undefined,
  dynamax: boolean,
  gigantamax: boolean,
): string | null => {
  const matchedPokemon = pokemonData.find(
    (variant) =>
      variant.name.toLowerCase() === name.toLowerCase() &&
      (form ? variant.form === form : true),
  );

  if (!matchedPokemon) {
    return null;
  }

  let url = matchedPokemon.image_url || null;

  if (gigantamax && matchedPokemon.max && matchedPokemon.max.length > 0) {
    const maxData = matchedPokemon.max[0];
    if (shinyChecked && maxData.shiny_gigantamax_image_url) {
      url = maxData.shiny_gigantamax_image_url;
    } else if (maxData.gigantamax_image_url) {
      url = maxData.gigantamax_image_url;
    }
    return url;
  }

  const effectiveShadowChecked = dynamax ? false : shadowChecked;
  const isFemale = selectedGender === 'Female';
  const hasFemaleData = matchedPokemon.female_data !== undefined;
  const hasUniqueFemaleForm = matchedPokemon.female_unique === 1;

  if (shinyChecked && effectiveShadowChecked) {
    if (matchedPokemon.shadow_shiny_available) {
      url =
        isFemale && hasFemaleData && hasUniqueFemaleForm
          ? matchedPokemon.female_data?.shiny_shadow_image_url ||
            matchedPokemon.female_data?.shiny_image_url ||
            matchedPokemon.female_data?.image_url ||
            null
          : matchedPokemon.image_url_shiny_shadow || matchedPokemon.image_url_shiny || null;
    } else {
      url =
        isFemale && hasFemaleData && hasUniqueFemaleForm
          ? matchedPokemon.female_data?.shadow_image_url ||
            matchedPokemon.female_data?.image_url ||
            null
          : matchedPokemon.image_url_shadow || null;
    }
  } else if (shinyChecked) {
    url =
      isFemale && hasFemaleData && hasUniqueFemaleForm
        ? matchedPokemon.female_data?.shiny_image_url ||
          matchedPokemon.female_data?.image_url ||
          null
        : matchedPokemon.image_url_shiny || null;
  } else if (effectiveShadowChecked) {
    url =
      isFemale && hasFemaleData && hasUniqueFemaleForm
        ? matchedPokemon.female_data?.shadow_image_url ||
          matchedPokemon.female_data?.image_url ||
          null
        : matchedPokemon.image_url_shadow || null;
  } else {
    url =
      isFemale && hasFemaleData && hasUniqueFemaleForm
        ? matchedPokemon.female_data?.image_url || null
        : matchedPokemon.image_url || null;
  }

  if (!dynamax && selectedCostume && selectedCostume !== '') {
    const selectedCostumeData = matchedPokemon.costumes?.find(
      (costume) => costume.name === selectedCostume,
    );
    if (selectedCostumeData) {
      if (isFemale && selectedCostumeData.image_url_female) {
        url =
          shinyChecked && effectiveShadowChecked
            ? selectedCostumeData.image_url_shiny_female ||
              selectedCostumeData.image_url_female ||
              null
            : shinyChecked
              ? selectedCostumeData.image_url_shiny_female ||
                selectedCostumeData.image_url_female ||
                null
              : effectiveShadowChecked
                ? selectedCostumeData.image_url_shadow ||
                  selectedCostumeData.image_url_female ||
                  null
                : selectedCostumeData.image_url_female || null;
      } else if (shinyChecked && effectiveShadowChecked) {
        url =
          selectedCostumeData.image_url_shiny_shadow ||
          selectedCostumeData.image_url_shiny ||
          selectedCostumeData.image_url ||
          null;
      } else if (effectiveShadowChecked) {
        url = selectedCostumeData.image_url_shadow || selectedCostumeData.image_url || null;
      } else if (shinyChecked) {
        url = selectedCostumeData.image_url_shiny || selectedCostumeData.image_url || null;
      } else {
        url = selectedCostumeData.image_url || null;
      }
    }
  }

  return url;
};
