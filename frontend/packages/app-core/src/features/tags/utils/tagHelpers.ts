// src/features/tags/utils/tagHelpers.ts
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { TagItem, TagBuckets } from '@/types/tags';

type TagInstanceSource = Partial<PokemonInstance> & {
  pokemon_id?: number | string | null;
};

type TagVariantSource = Partial<PokemonVariant> & {
  pokemon_id?: number | string | null;
};

const toNumberOr = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function buildTagItem(
  key: string,
  inst: TagInstanceSource,
  variant: TagVariantSource,
): TagItem {
  const pokemonId = toNumberOr(inst.pokemon_id ?? variant.pokemon_id, 0);
  const hp = toNumberOr(variant.stamina, 0);
  const pokedexNumber = toNumberOr(variant.pokedex_number ?? pokemonId, 0);

  return {
    currentImage: variant.currentImage ?? '/images/default_pokemon.png',
    type1_name: variant.type1_name ?? 'Unknown',
    type2_name: variant.type2_name ?? '',
    type_1_icon: variant.type_1_icon ?? '',
    type_2_icon: variant.type_2_icon ?? '',
    name: variant.name,
    form: variant.form,
    variantType: variant.variantType,

    pokemon_id: pokemonId,
    variant_id: variant.variant_id ?? inst.variant_id,
    cp: inst.cp ?? null,
    hp,
    shiny: !!inst.shiny,
    shiny_rarity: variant.shiny_rarity ?? undefined,
    rarity: variant.rarity,

    // instance flags we want handy for system virtual tags/children
    favorite: !!inst.favorite,
    most_wanted: !!inst.most_wanted,
    is_caught: !!inst.is_caught,
    is_for_trade: !!inst.is_for_trade,
    is_wanted: !!inst.is_wanted,

    mirror: !!inst.mirror,
    pref_lucky: !!inst.pref_lucky,
    registered: !!inst.registered,
    gender: inst.gender ?? 'Unknown',

    friendship_level: toNullableNumber(inst.friendship_level),
    location_card: inst.location_card ?? '',

    pokedex_number: pokedexNumber,
    date_available: variant.date_available,
    date_shiny_available: variant.date_shiny_available,
    date_shadow_available: variant.date_shadow_available,
    date_shiny_shadow_available: variant.date_shiny_shadow_available,
    costumes: variant.costumes ?? [],
    moves: variant.moves ?? [],

    key,
    instance_id: inst.instance_id ?? key,
  };
}

export function coerceToTagBuckets(
  obj: Record<string, Record<string, TagItem>>,
): TagBuckets {
  return {
    caught: obj.caught ?? {},
    trade: obj.trade ?? {},
    wanted: obj.wanted ?? {},
    ...obj, // allow extra custom buckets, but no "missing"
  };
}
