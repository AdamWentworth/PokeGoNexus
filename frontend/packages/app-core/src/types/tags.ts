// tags.ts

import type { Costume, Move } from './pokemonSubTypes';

/* one row in any bucket */
export interface TagItem {
  currentImage: string;
  friendship_level: number | null;
  mirror: boolean;
  pref_lucky: boolean;
  pokemon_id: number;
  variant_id?: string;
  cp: number | null;
  hp: number;
  favorite: boolean;
  most_wanted: boolean;
  is_caught: boolean;
  is_for_trade: boolean;
  is_wanted: boolean;

  /* optional meta */
  name?: string;
  pokedex_number: number;
  date_available?: string;
  date_shiny_available?: string;
  date_shadow_available?: string;
  date_shiny_shadow_available?: string;
  costumes?: Costume[];
  variantType?: string;
  shiny_rarity?: string;
  rarity?: string;
  location_card?: string;
  key?: string;
  gender: string;
  registered: boolean;
  moves: Move[];
  type1_name?: string;
  type2_name?: string;
  type_1_icon?: string;
  type_2_icon?: string;
  form?: string | null;
  shiny: boolean;
  instance_id: string;
}

/**
 * Canonical tag buckets for the redesigned Tags feature.
 * Note: "missing" was intentionally removed from the public Tags model.
 */
export interface TagBuckets {
  caught : Record<string, TagItem>; // "Inventory" (see all caught)
  wanted : Record<string, TagItem>; // wanted
  /** allow future custom buckets */
  [key: string]: Record<string, TagItem>;
}

export interface TagBucketsDB {
  [bucket: string]: Record<string, TagItem>;
}
