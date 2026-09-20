import type { PokemonVariant } from '@pokemongonexus/shared-contracts/variants';

export type SpecialMaxAttacker = {
  displayName: string;
  form: string | null;
  moveName: string;
  moveType: string;
  movePower: number;
};

export type SpecialMaxMoveEligibility = {
  pokemonId?: number | null;
  variantType?: string | null;
  form?: string | null;
  isCrowned?: boolean;
};

const SPECIAL_MAX_ATTACKERS: Readonly<Record<number, SpecialMaxAttacker>> = {
  888: {
    displayName: 'Crowned Sword Zacian',
    form: 'crowned_sword',
    moveName: 'Behemoth Blade',
    moveType: 'steel',
    movePower: 350,
  },
  889: {
    displayName: 'Crowned Shield Zamazenta',
    form: 'crowned_shield',
    moveName: 'Behemoth Bash',
    moveType: 'steel',
    movePower: 350,
  },
  890: {
    displayName: 'Eternatus',
    form: null,
    moveName: 'Dynamax Cannon',
    moveType: 'dragon',
    movePower: 450,
  },
};

const LEGACY_CROWNED_IDS: Readonly<Record<number, number>> = {
  2290: 888,
  2292: 889,
};

const normalizeForm = (value?: string | null): string =>
  value?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? '';

const normalizeVariantType = (value?: string | null): string =>
  value?.trim().toLowerCase() ?? '';

export const canonicalSpecialMaxPokemonId = (
  pokemonId?: number | null,
): number | null => {
  if (typeof pokemonId !== 'number') return null;
  return LEGACY_CROWNED_IDS[pokemonId] ?? pokemonId;
};

export const isSpecialMaxMoveEligible = ({
  pokemonId,
  variantType,
  form,
  isCrowned = false,
}: SpecialMaxMoveEligibility): boolean => {
  const normalizedVariantType = normalizeVariantType(variantType);
  if (
    normalizedVariantType !== 'default' &&
    normalizedVariantType !== 'shiny'
  ) {
    return false;
  }

  const catalogId = canonicalSpecialMaxPokemonId(pokemonId);
  if (catalogId === null) return false;

  const special = SPECIAL_MAX_ATTACKERS[catalogId];
  if (!special) return false;
  if (special.form === null) return true;

  return isCrowned || normalizeForm(form) === special.form;
};

export const getSpecialMaxAttacker = (
  variant: PokemonVariant,
): SpecialMaxAttacker | null => {
  if (
    !isSpecialMaxMoveEligible({
      pokemonId: variant.pokemon_id,
      variantType: variant.variantType,
      form: variant.form,
    })
  ) {
    return null;
  }

  const catalogId = canonicalSpecialMaxPokemonId(variant.pokemon_id);
  return catalogId === null ? null : SPECIAL_MAX_ATTACKERS[catalogId] ?? null;
};

export const isSpecialMaxAttacker = (variant: PokemonVariant): boolean =>
  getSpecialMaxAttacker(variant) !== null;
