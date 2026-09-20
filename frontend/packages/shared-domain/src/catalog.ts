import type { BasePokemon, Costume } from '@pokemongonexus/shared-contracts/pokemon';

export type PokemonCatalogEntry = {
  id: string;
  pokemonId: number;
  pokedexNumber: number;
  name: string;
  speciesName?: string;
  variantType?: string;
  form?: string | null;
  imageUri: string | null;
  typeIconUris: string[];
  maxKind: 'dynamax' | 'gigantamax' | null;
  /** Present on canonical catalog projections; optional for legacy fixture callers. */
  stamina?: number;
  /** Present on canonical catalog projections; optional for legacy fixture callers. */
  cp50?: number;
  evolvesFrom?: number[];
  evolvesTo?: number[];
};

const titleCase = (value: string): string =>
  value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');

const paddedId = (pokemonId: number): string => String(pokemonId).padStart(4, '0');

const typeIcons = (...names: (string | null | undefined)[]): string[] =>
  names
    .filter((name): name is string => Boolean(name?.trim()))
    .map((name) => `/images/types/${name.trim().toLowerCase()}.png`);

const baseTypeIcons = (pokemon: BasePokemon): string[] =>
  [pokemon.type_1_icon, pokemon.type_2_icon].filter(
    (path): path is string => Boolean(path?.trim()),
  );

const released = (date: string | null | undefined, now: number): boolean => {
  if (!date) return true;
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) || timestamp <= now;
};

const costumeName = (
  pokemon: BasePokemon,
  costume: Costume,
  prefixes: string[],
): string => [...prefixes, titleCase(costume.name), pokemon.name].join(' ');

/**
 * Builds the complete, selectable Pokémon catalog from the same canonical payload
 * used by the web client. Collection instances are deliberately not mixed in here.
 */
export const buildPokemonCatalogEntries = (
  catalog: BasePokemon[],
  now = Date.now(),
): PokemonCatalogEntry[] => catalog.flatMap((pokemon) => {
  const entries: PokemonCatalogEntry[] = [];
  const dexId = paddedId(pokemon.pokemon_id);
  const add = (
    id: string,
    name: string,
    imageUri: string | null | undefined,
    options: {
      maxKind?: PokemonCatalogEntry['maxKind'];
      icons?: string[];
      variantType?: string;
      form?: string | null;
      speciesName?: string;
      stamina?: number;
      cp50?: number;
    } = {},
  ) => {
    if (!imageUri) return;
    entries.push({
      id,
      pokemonId: pokemon.pokemon_id,
      pokedexNumber: pokemon.pokedex_number,
      name,
      speciesName: options.speciesName ?? pokemon.name,
      variantType: options.variantType,
      form: options.form === undefined ? pokemon.form : options.form,
      imageUri,
      typeIconUris: options.icons ?? baseTypeIcons(pokemon),
      maxKind: options.maxKind ?? null,
      stamina: options.stamina ?? pokemon.stamina,
      cp50: options.cp50 ?? pokemon.cp50,
      evolvesFrom: pokemon.evolves_from ?? pokemon.evolutionData?.evolves_from ?? [],
      evolvesTo: pokemon.evolves_to ?? pokemon.evolutionData?.evolves_to ?? [],
    });
  };

  add(`${dexId}-default`, pokemon.name, pokemon.image_url, { variantType: 'default' });
  if (pokemon.shiny_available) {
    add(`${dexId}-shiny`, `Shiny ${pokemon.name}`, pokemon.image_url_shiny, { variantType: 'shiny' });
  }
  if (pokemon.date_shadow_available) {
    add(`${dexId}-shadow`, `Shadow ${pokemon.name}`, pokemon.image_url_shadow, { variantType: 'shadow' });
    if (pokemon.date_shiny_shadow_available) {
      add(
        `${dexId}-shiny_shadow`,
        `Shiny Shadow ${pokemon.name}`,
        pokemon.image_url_shiny_shadow,
        { variantType: 'shiny_shadow' },
      );
    }
  }

  pokemon.costumes?.forEach((costume) => {
    add(
      `${dexId}-${costume.name}_default`,
      costumeName(pokemon, costume, []),
      costume.image_url,
      { variantType: `costume_${costume.costume_id}` },
    );
    if (costume.shiny_available) {
      add(
        `${dexId}-${costume.name}_shiny`,
        costumeName(pokemon, costume, ['Shiny']),
        costume.image_url_shiny,
        { variantType: `costume_${costume.costume_id}_shiny` },
      );
    }
    if (costume.shadow_costume) {
      add(
        `${dexId}-shadow_${costume.name}_default`,
        costumeName(pokemon, costume, ['Shadow']),
        costume.shadow_costume.image_url_shadow_costume,
        { variantType: `shadow_costume_${costume.costume_id}` },
      );
      add(
        `${dexId}-shadow_${costume.name}_shiny`,
        costumeName(pokemon, costume, ['Shiny', 'Shadow']),
        costume.shadow_costume.image_url_shiny_shadow_costume,
        { variantType: `shiny_shadow_costume_${costume.costume_id}` },
      );
    }
  });

  if (pokemon.max?.some((form) => Boolean(form.dynamax))) {
    add(`${dexId}-dynamax`, `Dynamax ${pokemon.name}`, pokemon.image_url, {
      maxKind: 'dynamax',
      variantType: 'dynamax',
    });
    if (pokemon.shiny_available) {
      add(
        `${dexId}-shiny_dynamax`,
        `Shiny Dynamax ${pokemon.name}`,
        pokemon.image_url_shiny,
        { maxKind: 'dynamax', variantType: 'shiny_dynamax' },
      );
    }
  }
  pokemon.max?.filter((form) => Boolean(form.gigantamax)).forEach((form) => {
    add(
      `${dexId}-gigantamax`,
      `Gigantamax ${pokemon.name}`,
      form.gigantamax_image_url,
      { maxKind: 'gigantamax', variantType: 'gigantamax' },
    );
    if (pokemon.shiny_available) {
      add(
        `${dexId}-shiny_gigantamax`,
        `Shiny Gigantamax ${pokemon.name}`,
        form.shiny_gigantamax_image_url,
        { maxKind: 'gigantamax', variantType: 'shiny_gigantamax' },
      );
    }
  });

  pokemon.megaEvolutions?.forEach((mega) => {
    if (!released(mega.date_available, now)) return;
    const form = mega.form?.trim();
    const kind = mega.primal ? 'Primal' : 'Mega';
    const suffix = form ? ` ${form}` : '';
    const idSuffix = mega.primal
      ? 'primal'
      : `mega${form ? `_${form.toLowerCase()}` : ''}`;
    const icons = typeIcons(mega.type1_name, mega.type2_name);
    add(`${dexId}-${idSuffix}`, `${kind} ${pokemon.name}${suffix}`, mega.image_url, {
      icons,
      form: form ?? null,
      stamina: mega.stamina,
      cp50: mega.cp50,
      variantType: mega.primal ? 'primal' : `mega${form ? `_${form.toLowerCase()}` : ''}`,
    });
    if (pokemon.shiny_available) {
      add(
        `${dexId}-shiny_${idSuffix}`,
        `Shiny ${kind} ${pokemon.name}${suffix}`,
        mega.image_url_shiny,
        {
          icons,
          form: form ?? null,
          stamina: mega.stamina,
          cp50: mega.cp50,
          variantType: mega.primal ? 'shiny_primal' : `shiny_mega${form ? `_${form.toLowerCase()}` : ''}`,
        },
      );
    }
  });

  pokemon.fusion?.forEach((fusion) => {
    if (pokemon.pokemon_id !== fusion.base_pokemon_id1 || fusion.fusion_id == null) return;
    const icons = typeIcons(fusion.type1_name, fusion.type2_name);
    add(`${dexId}-fusion_${fusion.fusion_id}`, fusion.name, fusion.image_url, {
      icons,
      speciesName: fusion.name,
      stamina: fusion.stamina,
      variantType: `fusion_${fusion.fusion_id}`,
    });
    add(
      `${dexId}-shiny_fusion_${fusion.fusion_id}`,
      `Shiny ${fusion.name}`,
      fusion.image_url_shiny,
      {
        icons,
        speciesName: fusion.name,
        stamina: fusion.stamina,
        variantType: `shiny_fusion_${fusion.fusion_id}`,
      },
    );
  });

  return entries;
});
