import type { PokemonInstance } from './instances';
import type { BasePokemon } from './pokemon';

export type PokemonVariantKind =
  | 'default'
  | 'shiny'
  | 'shadow'
  | 'shiny_shadow'
  | 'primal'
  | 'shiny_primal'
  | 'dynamax'
  | 'shiny_dynamax'
  | 'gigantamax'
  | 'shiny_gigantamax'
  | `costume_${string}`
  | `costume_${string}_shiny`
  | `shadow_costume_${string}`
  | `shiny_shadow_costume_${string}`
  | `mega${string}`
  | `shiny_mega${string}`
  | `fusion_${string}`
  | `shiny_fusion_${string}`;

export type PokemonVariantCommon = {
  currentImage: string | undefined;
  fusion_id?: number | null;
  instanceData?: PokemonInstance;
  megaForm?: string;
  primal?: boolean;
  raidRoster?: {
    cpSource?: 'recorded' | 'calculated';
    formSource?: 'base' | 'fusion' | 'crown' | 'mega';
    hiddenPowerTypeEstimated?: boolean;
    instanceId: string;
    ivSource: 'recorded' | 'estimated';
    levelSource: 'recorded' | 'inferred' | 'estimated';
    moveSource: 'recorded' | 'estimated';
    source: 'caught';
  };
  species_name: string;
  variantType: PokemonVariantKind;
};

export type PokemonVariant = Omit<
  BasePokemon,
  'backgrounds' | 'currentImage' | 'raid_boss' | 'variantType'
> & PokemonVariantCommon & {
  backgrounds?: BasePokemon['backgrounds'];
  raid_boss?: BasePokemon['raid_boss'];
  variant_id: string;
};

export type PokemonVariants = PokemonVariant[];
