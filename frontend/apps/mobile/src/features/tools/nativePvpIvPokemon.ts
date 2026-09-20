import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import { getPokemonCrownFormLabel } from '@pokemongonexus/shared-domain/pokemon-display';

export type NativePvpIvPokemonOption = {
  id: string;
  pokemonId: number;
  pokedexNumber: number;
  name: string;
  imageUrl: string;
  shinyImageUrl: string;
  types: string[];
  kind: 'base' | 'crown' | 'fusion';
  formId: number | null;
  evaluationPokemon: BasePokemon;
};

const validStats = (
  attack: unknown,
  defense: unknown,
  stamina: unknown,
): boolean => Number(attack) > 0 && Number(defense) > 0 && Number(stamina) > 0;

const normalize = (value: unknown): string => String(value ?? '')
  .trim()
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const types = (
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string[] => [primary, secondary]
  .map((value) => String(value ?? '').trim().toLocaleLowerCase())
  .filter(Boolean);

const evaluationPokemon = (
  base: BasePokemon,
  overrides: Partial<BasePokemon>,
): BasePokemon => ({ ...base, ...overrides });

export const buildNativePvpIvPokemonOptions = (
  catalog: BasePokemon[],
): NativePvpIvPokemonOption[] => {
  const options = new Map<string, NativePvpIvPokemonOption>();

  catalog.forEach((pokemon) => {
    if (validStats(pokemon.attack, pokemon.defense, pokemon.stamina)) {
      const id = `${pokemon.pokemon_id}:base`;
      options.set(id, {
        id,
        pokemonId: pokemon.pokemon_id,
        pokedexNumber: pokemon.pokedex_number,
        name: pokemon.name,
        imageUrl: pokemon.image_url,
        shinyImageUrl: pokemon.image_url_shiny || pokemon.image_url,
        types: types(pokemon.type1_name, pokemon.type2_name),
        kind: 'base',
        formId: null,
        evaluationPokemon: pokemon,
      });
    }

    (pokemon.fusion ?? [])
      .filter((fusion) => (
        fusion.base_pokemon_id1 === pokemon.pokemon_id
        && validStats(fusion.attack, fusion.defense, fusion.stamina)
      ))
      .forEach((fusion, index) => {
        const formId = fusion.fusion_id ?? index;
        const id = `${pokemon.pokemon_id}:fusion:${formId}`;
        options.set(id, {
          id,
          pokemonId: pokemon.pokemon_id,
          pokedexNumber: pokemon.pokedex_number,
          name: fusion.name || pokemon.name,
          imageUrl: fusion.image_url || pokemon.image_url,
          shinyImageUrl: fusion.image_url_shiny || fusion.image_url || pokemon.image_url_shiny || pokemon.image_url,
          types: types(fusion.type1_name, fusion.type2_name),
          kind: 'fusion',
          formId,
          evaluationPokemon: evaluationPokemon(pokemon, {
            attack: Number(fusion.attack),
            defense: Number(fusion.defense),
            stamina: Number(fusion.stamina),
            name: fusion.name || pokemon.name,
            image_url: fusion.image_url || pokemon.image_url,
            image_url_shiny: fusion.image_url_shiny || fusion.image_url || pokemon.image_url_shiny,
            type1_name: fusion.type1_name || pokemon.type1_name,
            type2_name: fusion.type2_name || pokemon.type2_name,
          }),
        });
      });

    (pokemon.crownForms ?? [])
      .filter((crown) => validStats(crown.attack, crown.defense, crown.stamina))
      .forEach((crown) => {
        const label = getPokemonCrownFormLabel(crown);
        const species = String(crown.name || pokemon.name).trim();
        const name = label && !normalize(species).includes(normalize(label))
          ? `${label} ${species}`
          : species || label || pokemon.name;
        const id = `${pokemon.pokemon_id}:crown:${crown.id}`;
        options.set(id, {
          id,
          pokemonId: pokemon.pokemon_id,
          pokedexNumber: pokemon.pokedex_number,
          name,
          imageUrl: crown.image_url || pokemon.image_url,
          shinyImageUrl: crown.image_url_shiny || crown.image_url || pokemon.image_url_shiny || pokemon.image_url,
          types: types(
            crown.type1_name || pokemon.type1_name,
            crown.type2_name || pokemon.type2_name,
          ),
          kind: 'crown',
          formId: crown.id,
          evaluationPokemon: evaluationPokemon(pokemon, {
            attack: Number(crown.attack),
            defense: Number(crown.defense),
            stamina: Number(crown.stamina),
            name,
            image_url: crown.image_url || pokemon.image_url,
            image_url_shiny: crown.image_url_shiny || crown.image_url || pokemon.image_url_shiny,
            type1_name: crown.type1_name || pokemon.type1_name,
            type2_name: crown.type2_name || pokemon.type2_name,
          }),
        });
      });
  });

  return [...options.values()].sort((left, right) => (
    left.pokedexNumber - right.pokedexNumber
    || left.name.localeCompare(right.name)
  ));
};

export const resolveNativePvpIvOptionForInstance = (
  instance: PokemonInstance,
  pokemon: BasePokemon,
  options: NativePvpIvPokemonOption[],
): NativePvpIvPokemonOption | undefined => {
  const candidates = options.filter((option) => option.pokemonId === pokemon.pokemon_id);
  if (instance.is_fused) {
    const form = normalize(instance.fusion_form);
    const storedId = Number(instance.fusion?.fusion_id ?? instance.fusion?.id);
    const fusion = (pokemon.fusion ?? []).find((entry) => (
      (form && normalize(entry.name) === form)
      || (Number.isFinite(storedId) && entry.fusion_id === storedId)
    ));
    if (!fusion) return undefined;
    return candidates.find((option) => (
      option.kind === 'fusion'
      && fusion?.fusion_id != null
      && option.formId === fusion.fusion_id
    )) ?? candidates.find((option) => (
      option.kind === 'fusion' && normalize(option.name) === normalize(fusion?.name ?? instance.fusion_form)
    ));
  }
  if (instance.crown) {
    const form = normalize(instance.fusion_form);
    const crown = (pokemon.crownForms ?? []).find((entry) => (
      normalize(getPokemonCrownFormLabel(entry)) === form
      || normalize(entry.name) === form
      || normalize(entry.form) === form
    ));
    if (!crown) return undefined;
    return candidates.find((option) => option.kind === 'crown' && option.formId === crown?.id)
      ?? candidates.find((option) => (
        option.kind === 'crown'
        && normalize(option.name).includes(normalize(instance.fusion_form))
      ));
  }
  return candidates.find((option) => option.kind === 'base');
};

export const nativePvpIvOptionImage = (
  option: NativePvpIvPokemonOption,
  shiny = false,
): string => shiny ? option.shinyImageUrl : option.imageUrl;
