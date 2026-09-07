import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import {
  buildPokedexRegistrationId,
  createManualPokedexRegistration,
  projectPokedexRegistrations,
  type PokedexRegistrationEntry,
  type PokedexRegistrationFacets,
  type PokedexSizeClass,
} from '@/features/pokedex/registrationProjection';
import { useManualPokedexRegistrationsStore } from '@/features/pokedex/store/useManualPokedexRegistrationsStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { AppLoadingFallback } from '@/contexts/AppLoadingContext';
import { useContextBackHandler } from '@/contexts/ContextBackContext';
import { useModal } from '@/contexts/ModalContext';
import CloseButton from '@/components/CloseButton';
import AppPageShell from '@/components/layout/AppPageShell';
import ProductPageHeader from '@/components/layout/ProductPageHeader';
import { determineImageUrl } from '@/utils/imageHelpers';
import {
  getPokemonCatalogManifest,
  getPokemonPokedexSpeciesChunk,
} from '@/services/pokemonDataService';
import { createScopedLogger } from '@/utils/logger';

import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonPokedexSpecies } from '@shared-contracts/pokemon';
import { pokedexExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';

import './Pokedex.css';
import PokedexPokemonDetail from './PokedexPokemonDetail';
import { schedulePokedexScrollRestore } from './pokedexScrollRestoration';
import { isPokedexPokemonReleased, mergePokedexSpecies } from './pokedexSpecies';

type PokedexViewMode = 'regions' | 'detail';
type PokedexGenderValue = 'Male' | 'Female';
type PokedexInternalVariantCategoryKey =
  | 'default'
  | 'shiny'
  | 'costume'
  | 'shadow'
  | 'shiny costume'
  | 'shiny shadow'
  | 'shadow costume'
  | 'mega'
  | 'shiny mega'
  | 'dynamax'
  | 'shiny dynamax'
  | 'gigantamax'
  | 'shiny gigantamax'
  | 'fusion'
  | 'shiny fusion';
type PokedexVariantCategoryKey = 'pokemon' | Exclude<PokedexInternalVariantCategoryKey, 'default'>;
type PokedexAdvancedFacetKey =
  | 'gender-male'
  | 'gender-female'
  | 'size-xxs'
  | 'size-xs'
  | 'size-xl'
  | 'size-xxl'
  | 'lucky'
  | 'purified'
  | 'perfect';
type PokedexAdvancedFacetGroup = 'gender' | 'size' | 'other';
type SelectedPokemon =
  | PokemonVariant
  | { pokemon: PokemonVariant; overlayType: 'instance' }
  | null;

const DEFAULT_POKEMON_IMAGE_URL = '/images/default_pokemon.png';
const log = createScopedLogger('Pokedex');

interface RegionDefinition {
  key: string;
  label: string;
  generation: number;
  starterDexNumbers: number[];
  accent: string;
  secondaryAccent: string;
  tertiaryAccent: string;
  textAccent: string;
}

interface RegionSummary extends RegionDefinition {
  species: PokemonVariant[];
  registeredDexNumbers: Set<number>;
  totalCount: number;
  registeredCount: number;
  shinyCount: number;
  luckyCount: number;
  xxlCount: number;
  xxsCount: number;
  perfectCount: number;
}

interface PokedexCategoryDefinition {
  key: PokedexVariantCategoryKey;
  label: string;
  icons: string[];
  accent: string;
  secondaryAccent: string;
}

interface PokedexAdvancedFacetDefinition {
  key: PokedexAdvancedFacetKey;
  label: string;
  icons: string[];
  group: PokedexAdvancedFacetGroup;
  facets: PokedexRegistrationFacets;
  accent: string;
  secondaryAccent: string;
}

interface PokedexAdvancedFacetSelection {
  gender?: PokedexGenderValue;
  size?: PokedexSizeClass;
  lucky?: boolean;
  purified?: boolean;
  appraisal?: '4-star';
}

interface RegionCategorySummary {
  species: PokemonVariant[];
  registeredKeys: Set<string>;
  totalCount: number;
  registeredCount: number;
}

type PokedexThemeDefinition = Pick<PokedexCategoryDefinition, 'accent' | 'secondaryAccent'>;

const POKEDEX_BASE_VARIANT_CATEGORIES: PokedexCategoryDefinition[] = [
  {
    key: 'pokemon',
    label: 'Pokemon',
    icons: ['/images/pokedex-icon.png'],
    accent: '#1699c9',
    secondaryAccent: '#4ad8c7',
  },
  {
    key: 'shiny',
    label: 'Shiny',
    icons: ['/images/shiny_icon.png'],
    accent: '#f4a229',
    secondaryAccent: '#ffe16a',
  },
  {
    key: 'shadow',
    label: 'Shadow',
    icons: ['/images/shadow_icon.png'],
    accent: '#6730a5',
    secondaryAccent: '#bd75ff',
  },
  {
    key: 'costume',
    label: 'Costume',
    icons: ['/images/costume_icon.png'],
    accent: '#ef6a8a',
    secondaryAccent: '#67c7f2',
  },
  {
    key: 'mega',
    label: 'Mega',
    icons: ['/images/mega.png'],
    accent: '#b551d6',
    secondaryAccent: '#ff82d0',
  },
  {
    key: 'dynamax',
    label: 'Dynamax',
    icons: ['/images/dynamax-icon.png'],
    accent: '#d94973',
    secondaryAccent: '#ff9bb1',
  },
  {
    key: 'gigantamax',
    label: 'Gigantamax',
    icons: ['/images/gigantamax-icon.png'],
    accent: '#d73442',
    secondaryAccent: '#ff7d5f',
  },
  {
    key: 'fusion',
    label: 'Fusion',
    icons: ['/images/fusion_1.png', '/images/fusion_2.png'],
    accent: '#416ed8',
    secondaryAccent: '#64d2ff',
  },
];

const POKEDEX_COMBO_VARIANT_CATEGORIES: PokedexCategoryDefinition[] = [
  {
    key: 'shiny shadow',
    label: 'Shiny Shadow',
    icons: ['/images/shiny_icon.png', '/images/shadow_icon.png'],
    accent: '#8845b8',
    secondaryAccent: '#f2a53d',
  },
  {
    key: 'shiny costume',
    label: 'Shiny Costume',
    icons: ['/images/shiny_icon.png', '/images/costume_icon.png'],
    accent: '#e89a2f',
    secondaryAccent: '#ef6a8a',
  },
  {
    key: 'shadow costume',
    label: 'Shadow Costume',
    icons: ['/images/shadow_icon.png', '/images/costume_icon.png'],
    accent: '#5a348f',
    secondaryAccent: '#ef6a8a',
  },
  {
    key: 'shiny mega',
    label: 'Shiny Mega',
    icons: ['/images/shiny_icon.png', '/images/mega.png'],
    accent: '#c768cb',
    secondaryAccent: '#ffc860',
  },
  {
    key: 'shiny dynamax',
    label: 'Shiny Dynamax',
    icons: ['/images/shiny_icon.png', '/images/dynamax-icon.png'],
    accent: '#e76478',
    secondaryAccent: '#ffd166',
  },
  {
    key: 'shiny gigantamax',
    label: 'Shiny Gigantamax',
    icons: ['/images/shiny_icon.png', '/images/gigantamax-icon.png'],
    accent: '#df4651',
    secondaryAccent: '#ffc65e',
  },
  {
    key: 'shiny fusion',
    label: 'Shiny Fusion',
    icons: ['/images/shiny_icon.png', '/images/fusion_1.png', '/images/fusion_2.png'],
    accent: '#6676e8',
    secondaryAccent: '#ffc447',
  },
];

const POKEDEX_VARIANT_CATEGORIES: PokedexCategoryDefinition[] = [
  ...POKEDEX_BASE_VARIANT_CATEGORIES,
  ...POKEDEX_COMBO_VARIANT_CATEGORIES,
];

const POKEDEX_BASE_QUALITY_FACETS: PokedexAdvancedFacetDefinition[] = [
  {
    key: 'lucky',
    label: 'Lucky',
    icons: ['/images/lucky-icon.png'],
    group: 'other',
    facets: { lucky: true },
    accent: '#d84e24',
    secondaryAccent: '#ff9a3d',
  },
  {
    key: 'purified',
    label: 'Purified',
    icons: ['/images/purified.png'],
    group: 'other',
    facets: { purified: true },
    accent: '#16aeb7',
    secondaryAccent: '#8ce9e1',
  },
  {
    key: 'size-xxs',
    label: 'XXS',
    icons: ['/images/xxs.png'],
    group: 'size',
    facets: { size: 'xxs' },
    accent: '#102f70',
    secondaryAccent: '#4b7be8',
  },
  {
    key: 'size-xxl',
    label: 'XXL',
    icons: ['/images/xxl.png'],
    group: 'size',
    facets: { size: 'xxl' },
    accent: '#1767b7',
    secondaryAccent: '#5ba8ff',
  },
  {
    key: 'perfect',
    label: '100%',
    icons: ['/images/appraisal_04.png'],
    group: 'other',
    facets: { appraisal: '4-star' },
    accent: '#e3303d',
    secondaryAccent: '#ff727c',
  },
];

const POKEDEX_ADVANCED_ONLY_QUALITY_FACETS: PokedexAdvancedFacetDefinition[] = [
  {
    key: 'size-xs',
    label: 'XS',
    icons: ['/images/height.png'],
    group: 'size',
    facets: { size: 'xs' },
    accent: '#1d4d95',
    secondaryAccent: '#6996ff',
  },
  {
    key: 'size-xl',
    label: 'XL',
    icons: ['/images/height.png'],
    group: 'size',
    facets: { size: 'xl' },
    accent: '#1a7cc6',
    secondaryAccent: '#6fc6ff',
  },
  {
    key: 'gender-male',
    label: 'Male',
    icons: ['/images/male-icon.png'],
    group: 'gender',
    facets: { gender: 'Male' },
    accent: '#2c78d8',
    secondaryAccent: '#69c2ff',
  },
  {
    key: 'gender-female',
    label: 'Female',
    icons: ['/images/female-icon.png'],
    group: 'gender',
    facets: { gender: 'Female' },
    accent: '#ca4bb6',
    secondaryAccent: '#ff8aca',
  },
];

const POKEDEX_QUALITY_FACETS: PokedexAdvancedFacetDefinition[] = [
  POKEDEX_BASE_QUALITY_FACETS[0],
  POKEDEX_BASE_QUALITY_FACETS[1],
  POKEDEX_BASE_QUALITY_FACETS[2],
  POKEDEX_ADVANCED_ONLY_QUALITY_FACETS[0],
  POKEDEX_ADVANCED_ONLY_QUALITY_FACETS[1],
  POKEDEX_BASE_QUALITY_FACETS[3],
  POKEDEX_BASE_QUALITY_FACETS[4],
  POKEDEX_ADVANCED_ONLY_QUALITY_FACETS[2],
  POKEDEX_ADVANCED_ONLY_QUALITY_FACETS[3],
];

const LIGHT_MODE_DARK_ICON_PATHS = new Set([
  '/images/appraisal_04.png',
  '/images/height.png',
  '/images/lucky-icon.png',
  '/images/xxl.png',
  '/images/xxs.png',
]);

const REGION_DEFINITIONS: RegionDefinition[] = [
  {
    key: 'kanto',
    label: 'Kanto',
    generation: 1,
    starterDexNumbers: [1, 4, 7],
    accent: '#ee4b2b',
    secondaryAccent: '#3b4cca',
    tertiaryAccent: '#ffde00',
    textAccent: '#1687b8',
  },
  {
    key: 'johto',
    label: 'Johto',
    generation: 2,
    starterDexNumbers: [152, 155, 158],
    accent: '#d4af37',
    secondaryAccent: '#c0c0c0',
    tertiaryAccent: '#9bd3e0',
    textAccent: '#b8871f',
  },
  {
    key: 'hoenn',
    label: 'Hoenn',
    generation: 3,
    starterDexNumbers: [252, 255, 258],
    accent: '#aa0000',
    secondaryAccent: '#0a6dc2',
    tertiaryAccent: '#2e8b57',
    textAccent: '#168a72',
  },
  {
    key: 'sinnoh',
    label: 'Sinnoh',
    generation: 4,
    starterDexNumbers: [387, 390, 393],
    accent: '#8fd2f5',
    secondaryAccent: '#e1b8d8',
    tertiaryAccent: '#a7a7a7',
    textAccent: '#607c9c',
  },
  {
    key: 'unova',
    label: 'Unova',
    generation: 5,
    starterDexNumbers: [495, 498, 501],
    accent: '#1c1c1c',
    secondaryAccent: '#f5f5f5',
    tertiaryAccent: '#7f64c5',
    textAccent: '#7561d5',
  },
  {
    key: 'kalos',
    label: 'Kalos',
    generation: 6,
    starterDexNumbers: [650, 653, 656],
    accent: '#637cff',
    secondaryAccent: '#ff6b81',
    tertiaryAccent: '#b68fcc',
    textAccent: '#526de0',
  },
  {
    key: 'alola',
    label: 'Alola',
    generation: 7,
    starterDexNumbers: [722, 725, 728],
    accent: '#fdb813',
    secondaryAccent: '#2d2d70',
    tertiaryAccent: '#eaadea',
    textAccent: '#008f9c',
  },
  {
    key: 'galar',
    label: 'Galar',
    generation: 8,
    starterDexNumbers: [810, 813, 816],
    accent: '#0074b8',
    secondaryAccent: '#d80040',
    tertiaryAccent: '#b9a0e7',
    textAccent: '#0074b8',
  },
  {
    key: 'hisui',
    label: 'Hisui',
    generation: 9,
    starterDexNumbers: [722, 155, 501],
    accent: '#a1a1a1',
    secondaryAccent: '#ae8baf',
    tertiaryAccent: '#e3d1a7',
    textAccent: '#6f7f8d',
  },
  {
    key: 'paldea',
    label: 'Paldea',
    generation: 10,
    starterDexNumbers: [906, 909, 912],
    accent: '#b80000',
    secondaryAccent: '#7f3fbf',
    tertiaryAccent: '#ffd966',
    textAccent: '#b80000',
  },
];

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function getDexNumber(pokemon: PokemonVariant): number | null {
  return asNumber(pokemon.pokedex_number);
}

function formatDexNumber(pokemon: PokemonVariant): string {
  const dexNumber = getDexNumber(pokemon);
  return dexNumber === null ? '----' : String(dexNumber).padStart(4, '0');
}

function getDisplayName(pokemon: PokemonVariant): string {
  return pokemon.name || pokemon.species_name;
}

function getPokemonImage(pokemon: PokemonVariant, gender?: PokedexGenderValue): string | undefined {
  const isFemale = gender === 'Female';

  return (
    determineImageUrl(isFemale, pokemon) ||
    pokemon.currentImage ||
    pokemon.image_url ||
    DEFAULT_POKEMON_IMAGE_URL
  );
}

function PokedexPokemonImage({
  pokemon,
  className,
  gender,
}: {
  pokemon: PokemonVariant;
  className: string;
  gender?: PokedexGenderValue;
}) {
  const image = getPokemonImage(pokemon, gender) || DEFAULT_POKEMON_IMAGE_URL;
  const [src, setSrc] = useState(image);

  useEffect(() => {
    setSrc(image);
  }, [image]);

  return (
    <img
      alt=""
      className={className}
      src={src}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        if (src !== DEFAULT_POKEMON_IMAGE_URL) {
          setSrc(DEFAULT_POKEMON_IMAGE_URL);
        }
      }}
    />
  );
}

function getBaseSpeciesByDex(variants: PokemonVariant[]): PokemonVariant[] {
  const byDexNumber = new Map<number, PokemonVariant>();

  for (const variant of variants) {
    const dexNumber = getDexNumber(variant);
    if (dexNumber === null) continue;

    const existing = byDexNumber.get(dexNumber);
    if (!existing) {
      byDexNumber.set(dexNumber, variant);
      continue;
    }

    const variantIsDefault = variant.variantType === 'default';
    const existingIsDefault = existing.variantType === 'default';
    if (variantIsDefault && !existingIsDefault) {
      byDexNumber.set(dexNumber, variant);
      continue;
    }

    if (variantIsDefault === existingIsDefault && variant.pokemon_id < existing.pokemon_id) {
      byDexNumber.set(dexNumber, variant);
    }
  }

  return Array.from(byDexNumber.values()).sort((left, right) => {
    const leftDex = getDexNumber(left) ?? 0;
    const rightDex = getDexNumber(right) ?? 0;
    return leftDex - rightDex;
  });
}

function getRegionBaseSpecies(variants: PokemonVariant[], generation: number): PokemonVariant[] {
  return getBaseSpeciesByDex(
    variants.filter((pokemon) => getRegionGeneration(pokemon) === generation),
  );
}

function getRegionGeneration(pokemon: PokemonVariant): number | null {
  return asNumber(pokemon.generation);
}

function getSupportedGenders(pokemon: PokemonVariant): Set<PokedexGenderValue> {
  const genderRate = String(pokemon.gender_rate ?? '').trim();
  if (!genderRate) return new Set<PokedexGenderValue>(['Male', 'Female']);

  const maleRate = genderRate.match(/(\d+)M/)?.[1];
  const femaleRate = genderRate.match(/(\d+)F/)?.[1];
  if (maleRate !== undefined || femaleRate !== undefined) {
    const supported = new Set<PokedexGenderValue>();
    if (Number(maleRate ?? 0) > 0) supported.add('Male');
    if (Number(femaleRate ?? 0) > 0) supported.add('Female');
    return supported;
  }

  if (genderRate === 'M/M') return new Set<PokedexGenderValue>(['Male']);
  if (genderRate === 'F/F') return new Set<PokedexGenderValue>(['Female']);
  if (genderRate === 'M/F' || genderRate === 'F/M') return new Set<PokedexGenderValue>(['Male', 'Female']);

  return new Set<PokedexGenderValue>();
}

function pokemonSupportsGender(pokemon: PokemonVariant, gender: PokedexGenderValue): boolean {
  return getSupportedGenders(pokemon).has(gender);
}

function classifyPokedexVariantCategory(variantType: string): PokedexInternalVariantCategoryKey {
  const normalizedVariantType = variantType.toLowerCase();

  if (normalizedVariantType === 'shiny') {
    return 'shiny';
  }

  if (normalizedVariantType.includes('fusion')) {
    return normalizedVariantType.includes('shiny') ? 'shiny fusion' : 'fusion';
  }

  if (normalizedVariantType.includes('gigantamax')) {
    return normalizedVariantType.includes('shiny') ? 'shiny gigantamax' : 'gigantamax';
  }

  if (normalizedVariantType.includes('dynamax')) {
    return normalizedVariantType.includes('shiny') ? 'shiny dynamax' : 'dynamax';
  }

  if (normalizedVariantType.includes('mega') || normalizedVariantType.includes('primal')) {
    return normalizedVariantType.includes('shiny') ? 'shiny mega' : 'mega';
  }

  if (normalizedVariantType.includes('shiny') && normalizedVariantType.includes('costume')) {
    return 'shiny costume';
  }

  if (normalizedVariantType.includes('shiny') && normalizedVariantType.includes('shadow')) {
    return 'shiny shadow';
  }

  if (normalizedVariantType.includes('shadow') && normalizedVariantType.includes('costume')) {
    return 'shadow costume';
  }

  if (normalizedVariantType.includes('costume')) {
    return 'costume';
  }

  if (normalizedVariantType.includes('shadow')) {
    return 'shadow';
  }

  return 'default';
}

function isShadowCategory(categoryKey: PokedexVariantCategoryKey): boolean {
  return categoryKey.includes('shadow');
}

function isShadowVariantType(variantType: string): boolean {
  return classifyPokedexVariantCategory(variantType).includes('shadow');
}

function getAdvancedFacets(selection: PokedexAdvancedFacetSelection): PokedexRegistrationFacets {
  const facets: PokedexRegistrationFacets = {};
  if (selection.gender) facets.gender = selection.gender;
  if (selection.size) facets.size = selection.size;
  if (selection.lucky) facets.lucky = true;
  if (selection.purified) facets.purified = true;
  if (selection.appraisal) facets.appraisal = selection.appraisal;
  return facets;
}

function hasAdvancedFacets(selection: PokedexAdvancedFacetSelection): boolean {
  return Object.keys(getAdvancedFacets(selection)).length > 0;
}

function getCategoryPokemonPhrase(
  category: PokedexCategoryDefinition,
  hasQualities: boolean,
): string {
  if (category.key === 'pokemon') {
    return hasQualities ? 'Pokemon with these qualities' : 'Pokemon';
  }

  const categoryLabel = category.label.toLowerCase();
  return hasQualities
    ? `${categoryLabel} Pokemon with these qualities`
    : `${categoryLabel} Pokemon`;
}

function facetsMatchSelection(
  entryFacets: PokedexRegistrationFacets,
  expectedFacets: PokedexRegistrationFacets,
): boolean {
  return Object.entries(expectedFacets).every(([key, value]) => entryFacets[key] === value);
}

function isAdvancedFacetSelected(
  selection: PokedexAdvancedFacetSelection,
  facet: PokedexAdvancedFacetDefinition,
): boolean {
  switch (facet.key) {
    case 'gender-male':
      return selection.gender === 'Male';
    case 'gender-female':
      return selection.gender === 'Female';
    case 'size-xxs':
      return selection.size === 'xxs';
    case 'size-xs':
      return selection.size === 'xs';
    case 'size-xl':
      return selection.size === 'xl';
    case 'size-xxl':
      return selection.size === 'xxl';
    case 'lucky':
      return selection.lucky === true;
    case 'purified':
      return selection.purified === true;
    case 'perfect':
      return selection.appraisal === '4-star';
    default:
      return false;
  }
}

function isAdvancedFacetDisabled(
  categoryKey: PokedexVariantCategoryKey,
  facet: PokedexAdvancedFacetDefinition,
): boolean {
  return (facet.key === 'lucky' || facet.key === 'purified') && isShadowCategory(categoryKey);
}

function getThemeStyle(theme: PokedexThemeDefinition): React.CSSProperties {
  return {
    '--pokedex-category-accent': theme.accent,
    '--pokedex-category-secondary-accent': theme.secondaryAccent,
  } as React.CSSProperties;
}

function getRegionStyle(region: RegionDefinition): React.CSSProperties {
  return {
    '--region-accent': region.accent,
    '--region-secondary-accent': region.secondaryAccent,
    '--region-tertiary-accent': region.tertiaryAccent,
    '--region-text-accent': region.textAccent,
  } as React.CSSProperties;
}

function getRegionSectionRefKey(categoryKey: PokedexVariantCategoryKey, regionKey: string): string {
  return `${categoryKey}:${regionKey}`;
}

function getRegionGridId(categoryKey: PokedexVariantCategoryKey, regionKey: string): string {
  return `pokedex-region-grid-${categoryKey.replace(/\s+/g, '-')}-${regionKey}`;
}

function doesVariantMatchCategory(
  categoryKey: PokedexVariantCategoryKey,
  variantType: string,
): boolean {
  const variantCategory = classifyPokedexVariantCategory(variantType);
  return categoryKey === 'pokemon'
    ? variantCategory === 'default'
    : variantCategory === categoryKey;
}

function shouldCollapseCategoryByDex(categoryKey: PokedexVariantCategoryKey): boolean {
  return categoryKey === 'pokemon' || categoryKey === 'shiny' || categoryKey === 'shadow';
}

function registrationMatchesCategory(
  entry: PokedexRegistrationEntry,
  categoryKey: PokedexVariantCategoryKey,
  options?: {
    selectedFacets?: PokedexRegistrationFacets;
  },
): boolean {
  const entryVariantType = String(entry.facets.variant ?? entry.variant_type ?? '');
  const matchesVariant = doesVariantMatchCategory(categoryKey, entryVariantType);
  if (!matchesVariant) return false;
  return facetsMatchSelection(entry.facets, options?.selectedFacets ?? {});
}

function getPokemonRegistrationKey(
  pokemon: PokemonVariant,
  options?: {
    selectedFacets?: PokedexRegistrationFacets;
    useDexRegistration?: boolean;
  },
): string | null {
  if (options?.useDexRegistration) {
    const dexNumber = getDexNumber(pokemon);
    return dexNumber === null ? null : String(dexNumber);
  }

  const selectedFacets = options?.selectedFacets ?? {};

  if (Object.keys(selectedFacets).length > 0) {
    return buildPokedexRegistrationId({
      pokemon_id: pokemon.pokemon_id,
      form: pokemon.form,
      facets: { variant: pokemon.variantType, ...selectedFacets },
    });
  }

  return pokemon.variant_id;
}

function registrationEntryMatchesPokemonCard(
  entry: PokedexRegistrationEntry,
  pokemon: PokemonVariant,
  options?: {
    useDexRegistration?: boolean;
  },
): boolean {
  if (options?.useDexRegistration) {
    const dexNumber = getDexNumber(pokemon);
    return dexNumber !== null && entry.pokedex_number === dexNumber;
  }

  return entry.base_variant_id === pokemon.variant_id;
}

function sortPokedexEntries(entries: PokemonVariant[]): PokemonVariant[] {
  return [...entries].sort((left, right) => {
    const leftDex = getDexNumber(left) ?? 0;
    const rightDex = getDexNumber(right) ?? 0;
    if (leftDex !== rightDex) return leftDex - rightDex;
    return String(left.variant_id).localeCompare(String(right.variant_id));
  });
}

function pokemonSupportsAdvancedSelection(
  pokemon: PokemonVariant,
  categoryKey: PokedexVariantCategoryKey,
  selection: PokedexAdvancedFacetSelection,
): boolean {
  if (selection.gender && !pokemonSupportsGender(pokemon, selection.gender)) {
    return false;
  }

  if (
    (selection.lucky || selection.purified) &&
    (isShadowCategory(categoryKey) || isShadowVariantType(pokemon.variantType))
  ) {
    return false;
  }

  return true;
}

function getRegionCategorySpecies(
  region: RegionSummary,
  allVariants: PokemonVariant[],
  categoryKey: PokedexVariantCategoryKey,
  options?: {
    selection?: PokedexAdvancedFacetSelection;
  },
): PokemonVariant[] {
  const advancedSelection = options?.selection ?? {};

  if (categoryKey !== 'pokemon') {
    const matchingVariants = allVariants.filter(
      (pokemon) =>
        getRegionGeneration(pokemon) === region.generation &&
        doesVariantMatchCategory(categoryKey, pokemon.variantType) &&
        pokemonSupportsAdvancedSelection(pokemon, categoryKey, advancedSelection),
    );

    if (shouldCollapseCategoryByDex(categoryKey)) {
      return getBaseSpeciesByDex(matchingVariants);
    }

    return sortPokedexEntries(matchingVariants);
  }

  return region.species.filter((pokemon) =>
    pokemonSupportsAdvancedSelection(pokemon, categoryKey, advancedSelection),
  );
}

function getRegionCategoryPreviewPokemon(
  region: RegionSummary,
  categorySpecies: PokemonVariant[],
): PokemonVariant[] {
  if (categorySpecies.length === 0) return [];

  const previewPokemon = region.starterDexNumbers
    .map((dexNumber) => categorySpecies.find((pokemon) => getDexNumber(pokemon) === dexNumber))
    .filter((pokemon): pokemon is PokemonVariant => Boolean(pokemon));
  const previewIds = new Set(previewPokemon.map((pokemon) => pokemon.variant_id));
  const fallbackPokemon = categorySpecies.filter((pokemon) => !previewIds.has(pokemon.variant_id));

  return [...previewPokemon, ...fallbackPokemon].slice(0, 3);
}

function getVariantBadgeIcons(pokemon: PokemonVariant): { src: string; label: string }[] {
  const variantType = pokemon.variantType.toLowerCase();

  if (variantType.includes('gigantamax')) {
    return [{ src: '/images/gigantamax.png', label: 'Gigantamax' }];
  }

  if (variantType.includes('dynamax')) {
    return [{ src: '/images/dynamax.png', label: 'Dynamax' }];
  }

  return [];
}

function getPokemonMaxBadge(pokemon: PokemonVariant): string | null {
  const variantType = pokemon.variantType.toLowerCase();

  if (variantType.includes('gigantamax')) {
    return '/images/gigantamax.png';
  }

  if (variantType.includes('dynamax')) {
    return '/images/dynamax.png';
  }

  return null;
}

function getActiveFacetBadgeIcons(
  selection: PokedexAdvancedFacetSelection,
): { src: string; label: string }[] {
  return POKEDEX_QUALITY_FACETS.filter((facet) => isAdvancedFacetSelected(selection, facet)).flatMap(
    (facet) => facet.icons.map((src) => ({ src, label: facet.label })),
  );
}

function getPokedexIconClassName(baseClassName: string, src: string): string {
  return LIGHT_MODE_DARK_ICON_PATHS.has(src)
    ? `${baseClassName} ${baseClassName}--dark-on-light`
    : baseClassName;
}

function filterPokemonBySearch(pokemon: PokemonVariant[], normalizedSearchTerm: string): PokemonVariant[] {
  if (!normalizedSearchTerm) return pokemon;

  return pokemon.filter((entry) => {
    const dexNumber = getDexNumber(entry);
    return (
      getDisplayName(entry).toLowerCase().includes(normalizedSearchTerm) ||
      (dexNumber !== null && String(dexNumber).includes(normalizedSearchTerm))
    );
  });
}

function getRegisteredEntriesForRegion(
  registrations: PokedexRegistrationEntry[],
  regionDexNumbers: Set<number>,
): PokedexRegistrationEntry[] {
  return registrations.filter((entry) => {
    if (!entry.is_registered || entry.pokedex_number === null) return false;
    return regionDexNumbers.has(entry.pokedex_number);
  });
}

function countRegisteredDexNumbers(
  entries: PokedexRegistrationEntry[],
  predicate: (entry: PokedexRegistrationEntry) => boolean,
): number {
  const dexNumbers = new Set<number>();
  for (const entry of entries) {
    if (entry.pokedex_number === null || !predicate(entry)) continue;
    dexNumbers.add(entry.pokedex_number);
  }
  return dexNumbers.size;
}

function getPokedexScrollTop(): number {
  return (
    window.scrollY ||
    document.scrollingElement?.scrollTop ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

function Pokedex() {
  const variants = useVariantsStore((s) => s.variants);
  const loading = useVariantsStore((s) => s.variantsLoading);
  const instances = useInstancesStore((s) => s.instances);
  const manualRegistrations = useManualPokedexRegistrationsStore((s) => s.registrations);
  const hydrateManualRegistrations = useManualPokedexRegistrationsStore((s) => s.hydrate);
  const registerManualRegistrations = useManualPokedexRegistrationsStore((s) => s.register);
  const unregisterManualRegistrations = useManualPokedexRegistrationsStore((s) => s.unregister);
  const { confirm } = useModal();

  const [viewMode, setViewMode] = useState<PokedexViewMode>('regions');
  const [selectedRegionKey, setSelectedRegionKey] = useState(REGION_DEFINITIONS[0].key);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<PokedexVariantCategoryKey>('pokemon');
  const [advancedMode, setAdvancedMode] = useState(false);
  const [advancedSelection, setAdvancedSelection] = useState<PokedexAdvancedFacetSelection>({});
  const [activeThemeKey, setActiveThemeKey] = useState<string>('pokemon');
  const [selectedPokemon, setSelectedPokemon] = useState<SelectedPokemon>(null);
  const [regionSearchTerm, setRegionSearchTerm] = useState('');
  const [pendingScrollRegionKey, setPendingScrollRegionKey] = useState<string | null>(null);
  const [pokedexSpecies, setPokedexSpecies] = useState<PokemonPokedexSpecies[]>([]);
  const [pokedexSpeciesLoading, setPokedexSpeciesLoading] = useState(true);
  const [collapsedRegionSectionKeys, setCollapsedRegionSectionKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const regionSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const regionDetailScrollYRef = useRef(0);
  const pendingRegionDetailScrollRestoreRef = useRef<number | null>(null);

  const registrations = useMemo(
    () => projectPokedexRegistrations(variants, instances, manualRegistrations),
    [instances, manualRegistrations, variants],
  );
  const pokedexVariants = useMemo(
    () => mergePokedexSpecies(variants, pokedexSpecies),
    [pokedexSpecies, variants],
  );

  const regionSummaries = useMemo<RegionSummary[]>(() => {
    return REGION_DEFINITIONS.map((region) => {
      const species = getRegionBaseSpecies(pokedexVariants, region.generation);
      const regionDexNumbers = new Set(
        species
          .map((pokemon) => getDexNumber(pokemon))
          .filter((dexNumber): dexNumber is number => dexNumber !== null),
      );
      const registeredEntries = getRegisteredEntriesForRegion(registrations, regionDexNumbers);
      const registeredDexNumbers = new Set(
        registeredEntries
          .map((entry) => entry.pokedex_number)
          .filter((dexNumber): dexNumber is number => dexNumber !== null),
      );
      return {
        ...region,
        species,
        registeredDexNumbers,
        totalCount: species.length,
        registeredCount: registeredDexNumbers.size,
        shinyCount: countRegisteredDexNumbers(
          registeredEntries,
          (entry) => String(entry.facets.variant).includes('shiny'),
        ),
        luckyCount: countRegisteredDexNumbers(registeredEntries, (entry) => entry.facets.lucky === true),
        xxlCount: countRegisteredDexNumbers(registeredEntries, (entry) => entry.facets.size === 'xxl'),
        xxsCount: countRegisteredDexNumbers(registeredEntries, (entry) => entry.facets.size === 'xxs'),
        perfectCount: countRegisteredDexNumbers(
          registeredEntries,
          (entry) => entry.facets.appraisal === '4-star',
        ),
      };
    }).filter((region) => region.totalCount > 0);
  }, [pokedexVariants, registrations]);

  const activeCategory = useMemo(
    () =>
      POKEDEX_VARIANT_CATEGORIES.find((category) => category.key === selectedCategoryKey) ??
      POKEDEX_BASE_VARIANT_CATEGORIES[0],
    [selectedCategoryKey],
  );
  const advancedFacets = useMemo(() => getAdvancedFacets(advancedSelection), [advancedSelection]);
  const hasActiveAdvancedFacets = useMemo(
    () => hasAdvancedFacets(advancedSelection),
    [advancedSelection],
  );
  const displayGender = useMemo<PokedexGenderValue | undefined>(() => {
    return advancedSelection.gender;
  }, [advancedSelection.gender]);
  const visibleVariantCategories = useMemo(
    () =>
      advancedMode
        ? POKEDEX_VARIANT_CATEGORIES
        : POKEDEX_BASE_VARIANT_CATEGORIES,
    [advancedMode],
  );
  const visibleQualityFacets = useMemo(
    () =>
      advancedMode
        ? POKEDEX_QUALITY_FACETS
        : POKEDEX_BASE_QUALITY_FACETS,
    [advancedMode],
  );
  const visibleQualityFacetKeys = useMemo(
    () => new Set(visibleQualityFacets.map((facet) => facet.key)),
    [visibleQualityFacets],
  );
  const selectedCategoryIndex = useMemo(() => {
    const index = visibleVariantCategories.findIndex((category) => category.key === selectedCategoryKey);
    return index === -1 ? 0 : index;
  }, [selectedCategoryKey, visibleVariantCategories]);
  const activeTheme = useMemo<PokedexThemeDefinition>(() => {
    const activeFacet = visibleQualityFacets.find(
      (facet) => facet.key === activeThemeKey && isAdvancedFacetSelected(advancedSelection, facet),
    );
    if (activeFacet) return activeFacet;

    return (
      visibleVariantCategories.find((category) => category.key === activeThemeKey) ??
      activeCategory
    );
  }, [activeCategory, activeThemeKey, advancedSelection, visibleQualityFacets, visibleVariantCategories]);
  const regionCategorySummariesByKey = useMemo(() => {
    const summariesByKey = new Map<PokedexVariantCategoryKey, Map<string, RegionCategorySummary>>();

    for (const category of visibleVariantCategories) {
      const summaries = new Map<string, RegionCategorySummary>();
      const useDexRegistration = shouldCollapseCategoryByDex(category.key);

      for (const region of regionSummaries) {
        const eligibleSpecies = getRegionCategorySpecies(region, variants, category.key, {
          selection: advancedSelection,
        });
        const eligibleVariantIds = new Set(eligibleSpecies.map((pokemon) => pokemon.variant_id));
        const eligibleDexNumbers = new Set(
          eligibleSpecies
            .map((pokemon) => getDexNumber(pokemon))
            .filter((dexNumber): dexNumber is number => dexNumber !== null),
        );
        const matchingRegisteredEntries = getRegisteredEntriesForRegion(registrations, eligibleDexNumbers).filter(
          (entry) =>
            (useDexRegistration || eligibleVariantIds.has(entry.base_variant_id)) &&
            registrationMatchesCategory(entry, category.key, {
              selectedFacets: advancedFacets,
            }),
        );
        const registeredKeys = new Set<string>();
        for (const pokemon of eligibleSpecies) {
          const key = getPokemonRegistrationKey(pokemon, {
            selectedFacets: advancedFacets,
            useDexRegistration,
          });
          if (!key) continue;

          const isRegistered = matchingRegisteredEntries.some((entry) =>
            registrationEntryMatchesPokemonCard(entry, pokemon, { useDexRegistration }),
          );
          if (isRegistered) registeredKeys.add(key);
        }

        summaries.set(region.key, {
          species: eligibleSpecies,
          registeredKeys,
          totalCount: eligibleSpecies.length,
          registeredCount: registeredKeys.size,
        });
      }

      summariesByKey.set(category.key, summaries);
    }

    return summariesByKey;
  }, [
    advancedFacets,
    advancedSelection,
    regionSummaries,
    registrations,
    visibleVariantCategories,
    variants,
  ]);
  const normalizedRegionSearchTerm = useMemo(
    () => regionSearchTerm.trim().toLowerCase(),
    [regionSearchTerm],
  );

  useEffect(() => {
    void hydrateManualRegistrations();
  }, [hydrateManualRegistrations]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const manifest = await getPokemonCatalogManifest();
        const species = await getPokemonPokedexSpeciesChunk(manifest);
        if (!cancelled && species) {
          setPokedexSpecies(species);
        }
      } catch (error) {
        log.warn('Unreleased Pokedex species are unavailable; using the released catalog.', error);
      } finally {
        if (!cancelled) {
          setPokedexSpeciesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeRegistrationSummary = useMemo(() => {
    const categorySummaries = regionCategorySummariesByKey.get(selectedCategoryKey);
    if (!categorySummaries) {
      return { registeredCount: 0, totalCount: 0 };
    }

    let registeredCount = 0;
    let totalCount = 0;
    for (const summary of categorySummaries.values()) {
      registeredCount += summary.registeredCount;
      totalCount += summary.totalCount;
    }

    return { registeredCount, totalCount };
  }, [regionCategorySummariesByKey, selectedCategoryKey]);

  const activeVisibleRegistrationEntries = useMemo(() => {
    if (viewMode !== 'detail') return [];

    const categorySummaries = regionCategorySummariesByKey.get(selectedCategoryKey);
    if (!categorySummaries) return [];

    const byRegistrationId = new Map<string, PokedexRegistrationEntry>();
    const registeredAt = new Date().toISOString();

    for (const region of regionSummaries) {
      if (collapsedRegionSectionKeys.has(getRegionSectionRefKey(selectedCategoryKey, region.key))) {
        continue;
      }

      const categorySummary = categorySummaries.get(region.key);
      if (!categorySummary || categorySummary.totalCount === 0) continue;

      const visibleSpecies = filterPokemonBySearch(
        categorySummary.species,
        normalizedRegionSearchTerm,
      );

      for (const pokemon of visibleSpecies) {
        if (!isPokedexPokemonReleased(pokemon)) continue;
        const entry = createManualPokedexRegistration(pokemon, advancedFacets, registeredAt);
        byRegistrationId.set(entry.registration_id, entry);
      }
    }

    return Array.from(byRegistrationId.values());
  }, [
    advancedFacets,
    collapsedRegionSectionKeys,
    normalizedRegionSearchTerm,
    regionCategorySummariesByKey,
    regionSummaries,
    selectedCategoryKey,
    viewMode,
  ]);

  useEffect(() => {
    const selectedVariantIsVisible = visibleVariantCategories.some(
      (category) => category.key === selectedCategoryKey,
    );
    if (!selectedVariantIsVisible) {
      setSelectedCategoryKey('pokemon');
      setActiveThemeKey('pokemon');
    }
  }, [selectedCategoryKey, visibleVariantCategories]);

  useEffect(() => {
    setAdvancedSelection((current) => {
      let changed = false;
      const next = { ...current };

      if (!visibleQualityFacetKeys.has('gender-male') && next.gender === 'Male') {
        next.gender = undefined;
        changed = true;
      }
      if (!visibleQualityFacetKeys.has('gender-female') && next.gender === 'Female') {
        next.gender = undefined;
        changed = true;
      }
      if (!visibleQualityFacetKeys.has('size-xs') && next.size === 'xs') {
        next.size = undefined;
        changed = true;
      }
      if (!visibleQualityFacetKeys.has('size-xl') && next.size === 'xl') {
        next.size = undefined;
        changed = true;
      }
      if (!visibleQualityFacetKeys.has('purified') && next.purified) {
        next.purified = undefined;
        changed = true;
      }

      return changed ? next : current;
    });
  }, [visibleQualityFacetKeys]);

  useEffect(() => {
    if (
      (advancedSelection.lucky || advancedSelection.purified) &&
      isShadowCategory(selectedCategoryKey)
    ) {
      setAdvancedSelection((current) => ({ ...current, lucky: false, purified: false }));
    }
  }, [advancedSelection.lucky, advancedSelection.purified, selectedCategoryKey]);

  useEffect(() => {
    const activeFacet = visibleQualityFacets.find(
      (facet) => facet.key === activeThemeKey && isAdvancedFacetSelected(advancedSelection, facet),
    );
    const activeCategoryThemeIsVisible = visibleVariantCategories.some(
      (category) => category.key === activeThemeKey,
    );

    if (!activeFacet && !activeCategoryThemeIsVisible) {
      setActiveThemeKey(selectedCategoryKey);
    }
  }, [
    activeThemeKey,
    advancedSelection,
    selectedCategoryKey,
    visibleQualityFacets,
    visibleVariantCategories,
  ]);

  useLayoutEffect(() => {
    if (viewMode !== 'detail' || !pendingScrollRegionKey) return;
    const sectionRefKey = getRegionSectionRefKey(selectedCategoryKey, pendingScrollRegionKey);
    const targetSection = regionSectionRefs.current[sectionRefKey];
    if (typeof targetSection?.scrollIntoView !== 'function') return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    targetSection.scrollIntoView({
      block: 'start',
      behavior: reducedMotion
        ? pokedexExperienceParityContract.regionNavigationScrollBehavior.reducedMotion
        : pokedexExperienceParityContract.regionNavigationScrollBehavior.default,
    });
    setPendingScrollRegionKey(null);
  }, [pendingScrollRegionKey, selectedCategoryKey, viewMode]);

  useEffect(() => {
    if (selectedPokemon !== null || pendingRegionDetailScrollRestoreRef.current === null) return;

    const scrollY = pendingRegionDetailScrollRestoreRef.current;
    pendingRegionDetailScrollRestoreRef.current = null;

    return schedulePokedexScrollRestore(scrollY);
  }, [selectedPokemon]);

  const handleShowRegions = useCallback(() => {
    setSelectedPokemon(null);
    setRegionSearchTerm('');
    setSelectedCategoryKey('pokemon');
    setActiveThemeKey('pokemon');
    setViewMode('regions');
  }, []);

  const handleCategorySelect = useCallback((categoryKey: PokedexVariantCategoryKey) => {
    setSelectedPokemon(null);
    setSelectedCategoryKey(categoryKey);
    setActiveThemeKey(categoryKey);
  }, []);

  const handleAdvancedModeToggle = useCallback(() => {
    setSelectedPokemon(null);
    setAdvancedMode((current) => !current);
  }, []);

  const handleAdvancedFacetToggle = useCallback(
    (facet: PokedexAdvancedFacetDefinition) => {
      if (isAdvancedFacetDisabled(selectedCategoryKey, facet)) return;

      setSelectedPokemon(null);
      setAdvancedSelection((current) => {
        const next = { ...current };
        const isSelected = isAdvancedFacetSelected(current, facet);

        switch (facet.key) {
          case 'gender-male':
            next.gender = isSelected ? undefined : 'Male';
            break;
          case 'gender-female':
            next.gender = isSelected ? undefined : 'Female';
            break;
          case 'size-xxs':
            next.size = isSelected ? undefined : 'xxs';
            break;
          case 'size-xs':
            next.size = isSelected ? undefined : 'xs';
            break;
          case 'size-xl':
            next.size = isSelected ? undefined : 'xl';
            break;
          case 'size-xxl':
            next.size = isSelected ? undefined : 'xxl';
            break;
          case 'lucky':
            next.lucky = isSelected ? undefined : true;
            break;
          case 'purified':
            next.purified = isSelected ? undefined : true;
            break;
          case 'perfect':
            next.appraisal = isSelected ? undefined : '4-star';
            break;
          default:
            break;
        }

        return next;
      });
      setActiveThemeKey((current) =>
        isAdvancedFacetSelected(advancedSelection, facet) ? current : facet.key,
      );
    },
    [advancedSelection, selectedCategoryKey],
  );

  const handleRegionSelect = useCallback((regionKey: string) => {
    setSelectedPokemon(null);
    setRegionSearchTerm('');
    setSelectedRegionKey(regionKey);
    setCollapsedRegionSectionKeys((current) => {
      const key = getRegionSectionRefKey(selectedCategoryKey, regionKey);
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setPendingScrollRegionKey(regionKey);
    setViewMode('detail');
  }, [selectedCategoryKey]);

  const handleToggleRegionSection = useCallback(
    (categoryKey: PokedexVariantCategoryKey, regionKey: string) => {
      setSelectedPokemon(null);
      setCollapsedRegionSectionKeys((current) => {
        const key = getRegionSectionRefKey(categoryKey, regionKey);
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [],
  );

  const handleOpenPokemonDetail = useCallback((pokemon: PokemonVariant) => {
    regionDetailScrollYRef.current = getPokedexScrollTop();
    setSelectedPokemon(pokemon);
  }, []);

  const handleClosePokemonDetail = useCallback(() => {
    pendingRegionDetailScrollRestoreRef.current = regionDetailScrollYRef.current;
    setSelectedPokemon(null);
  }, []);

  const handleRegisterVisible = useCallback(async () => {
    if (activeVisibleRegistrationEntries.length === 0) return;

    const confirmed = await confirm(
      `Register all ${activeVisibleRegistrationEntries.length} visible Pokedex entries?\nThis applies to the current region, category, search, and quality filters.`,
    );
    if (!confirmed) return;

    void registerManualRegistrations(activeVisibleRegistrationEntries);
  }, [activeVisibleRegistrationEntries, confirm, registerManualRegistrations]);

  const handleClearVisible = useCallback(async () => {
    if (activeVisibleRegistrationEntries.length === 0) return;

    const confirmed = await confirm(
      `Unregister all ${activeVisibleRegistrationEntries.length} visible Pokedex entries?\nThis only removes manual Pokedex registrations. Your caught Pokemon instances stay unchanged.`,
    );
    if (!confirmed) return;

    void unregisterManualRegistrations(
      activeVisibleRegistrationEntries.map((entry) => entry.registration_id),
    );
  }, [activeVisibleRegistrationEntries, confirm, unregisterManualRegistrations]);

  const handleToggleRegionRegistration = useCallback(
    (entry: PokedexRegistrationEntry, isRegistered: boolean) => {
      if (isRegistered) {
        void unregisterManualRegistrations([entry.registration_id]);
        return;
      }

      void registerManualRegistrations([entry]);
    },
    [registerManualRegistrations, unregisterManualRegistrations],
  );

  const handlePokedexBackContext = useCallback(() => {
    if (selectedPokemon) {
      handleClosePokemonDetail();
      return true;
    }

    if (viewMode === 'detail') {
      handleShowRegions();
      return true;
    }

    return false;
  }, [handleClosePokemonDetail, handleShowRegions, selectedPokemon, viewMode]);

  useContextBackHandler(
    viewMode === 'detail' || selectedPokemon !== null,
    handlePokedexBackContext,
    'pokedex-context',
  );

  if ((loading && variants.length === 0) || pokedexSpeciesLoading) {
    return <AppLoadingFallback source="pokedex-page" />;
  }

  if (viewMode === 'detail' && selectedPokemon && !('overlayType' in selectedPokemon)) {
    return (
      <div className="pokedex-page pokedex-page--pokemon-detail" style={getThemeStyle(activeTheme)}>
        <PokedexPokemonDetail
          pokemon={selectedPokemon}
          variants={variants}
          registrations={registrations}
          gender={displayGender}
          onRegister={registerManualRegistrations}
          onUnregister={unregisterManualRegistrations}
          onClose={handleClosePokemonDetail}
        />
      </div>
    );
  }

  return (
    <AppPageShell
      className={`pokedex-page ${viewMode === 'detail' ? 'pokedex-page--detail' : ''}`}
      contentClassName="pokedex-page__shell"
      inset="comfortable"
      maxWidth="standard"
      style={getThemeStyle(activeTheme)}
    >
        <ProductPageHeader
          actions={(
            <div className="pokedex-page__header-tools">
              <p className="pokedex-page__registration-total">
                Registered: {activeRegistrationSummary.registeredCount} / {activeRegistrationSummary.totalCount}
              </p>
              <button
                className={`pokedex-advanced-toggle ${advancedMode ? 'is-active' : ''}`}
                type="button"
                role="switch"
                aria-checked={advancedMode}
                onClick={handleAdvancedModeToggle}
              >
                <span className="pokedex-advanced-toggle__label">Advanced</span>
                <span className="pokedex-advanced-toggle__track" aria-hidden="true">
                  <span className="pokedex-advanced-toggle__thumb" />
                </span>
              </button>
            </div>
          )}
          className="pokedex-product-header"
          description="Explore every released species, form, and collectible variant."
          eyebrow="Trainer reference"
          icon={<img alt="" src="/images/pokedex-icon.png" />}
          title="Pokédex"
        >
          <div className="pokedex-category-groups">
            <div className="pokedex-category-tabs" role="tablist" aria-label="Pokedex variant category">
              {visibleVariantCategories.map((category) => {
                const isActive = selectedCategoryKey === category.key;

                return (
                  <button
                    className={`pokedex-category-tabs__button ${isActive ? 'is-active' : ''}`}
                    key={category.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    style={getThemeStyle(category)}
                    onClick={() => handleCategorySelect(category.key)}
                  >
                    <span className="pokedex-category-tabs__icons" aria-hidden="true">
                      {category.icons.map((icon) => (
                        <img
                          className={getPokedexIconClassName('pokedex-category-tabs__icon', icon)}
                          key={icon}
                          src={icon}
                          alt=""
                        />
                      ))}
                    </span>
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>

            <div
              className="pokedex-category-tabs pokedex-category-tabs--qualities"
              role="toolbar"
              aria-label="Pokedex quality facets"
            >
              {visibleQualityFacets.map((facet) => {
                const isActive = isAdvancedFacetSelected(advancedSelection, facet);
                const isDisabled = isAdvancedFacetDisabled(selectedCategoryKey, facet);

                return (
                  <button
                    className={`pokedex-category-tabs__button pokedex-category-tabs__button--facet ${isActive ? 'is-active' : ''}`}
                    key={facet.key}
                    type="button"
                    aria-pressed={isActive}
                    disabled={isDisabled}
                    style={getThemeStyle(facet)}
                    onClick={() => handleAdvancedFacetToggle(facet)}
                  >
                    <span className="pokedex-category-tabs__icons" aria-hidden="true">
                      {facet.icons.map((icon) => (
                        <img
                          className={getPokedexIconClassName('pokedex-category-tabs__icon', icon)}
                          key={icon}
                          src={icon}
                          alt=""
                        />
                      ))}
                    </span>
                    <span>{facet.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ProductPageHeader>

        <section className="pokedex-page__panel" aria-label="Pokedex catalog">
          {viewMode === 'regions' ? (
            <div className="pokedex-category-slider-container">
              <div
                className="pokedex-category-slider"
                style={{ transform: `translateX(-${selectedCategoryIndex * 100}%)` }}
              >
                {visibleVariantCategories.map((category) => {
                  const categorySummaryMap = regionCategorySummariesByKey.get(category.key);
                  const categoryPokemonPhrase = getCategoryPokemonPhrase(
                    category,
                    hasActiveAdvancedFacets,
                  );
                  const visibleRegions = regionSummaries.filter((region) => {
                    const categorySummary = categorySummaryMap?.get(region.key);
                    return (categorySummary?.totalCount ?? 0) > 0;
                  });

                  return (
                    <div
                      className="pokedex-category-panel"
                      key={category.key}
                      style={getThemeStyle(category)}
                      aria-hidden={category.key !== selectedCategoryKey}
                    >
                      <div className="pokedex-regions" aria-label={`${category.label} regions`}>
                        {visibleRegions.map((region) => {
                          const categorySummary = categorySummaryMap?.get(region.key) ?? {
                            species: [],
                            registeredKeys: new Set<string>(),
                            totalCount: region.totalCount,
                            registeredCount: region.registeredCount,
                          };
                          const isComplete =
                            categorySummary.totalCount > 0 &&
                            categorySummary.registeredCount >= categorySummary.totalCount;
                          const previewPokemon = getRegionCategoryPreviewPokemon(
                            region,
                            categorySummary.species,
                          );

                          return (
                            <button
                              className="pokedex-region-card"
                              key={region.key}
                              style={getRegionStyle(region)}
                              type="button"
                              tabIndex={category.key === selectedCategoryKey ? 0 : -1}
                              onClick={() => handleRegionSelect(region.key)}
                            >
                              <span className="pokedex-region-card__copy">
                                <span className="pokedex-region-card__name">{region.label}</span>
                                <span className="pokedex-region-card__status">
                                  {isComplete ? 'Complete!' : 'In progress'}
                                </span>
                                <span className="pokedex-region-card__count">
                                  {categorySummary.registeredCount} / {categorySummary.totalCount}
                                </span>
                                <span className={`pokedex-region-card__badge ${isComplete ? 'is-complete' : ''}`}>
                                  {isComplete ? 'OK' : '!'}
                                </span>
                              </span>
                              <span className="pokedex-region-card__art" aria-hidden="true">
                                {previewPokemon.map((pokemon, index) => {
                                  const maxBadge = getPokemonMaxBadge(pokemon);

                                  return (
                                    <span
                                      className={`pokedex-region-card__pokemon-preview pokedex-region-card__pokemon-preview--${index + 1}`}
                                      key={pokemon.variant_id}
                                    >
                                      <PokedexPokemonImage
                                        className="pokedex-region-card__pokemon"
                                        pokemon={pokemon}
                                      />
                                      {maxBadge ? (
                                        <img
                                          className="pokedex-region-card__max-badge"
                                          src={maxBadge}
                                          alt=""
                                          draggable={false}
                                        />
                                      ) : null}
                                    </span>
                                  );
                                })}
                              </span>
                            </button>
                          );
                        })}
                        {regionSummaries.length === 0 ? (
                          <p className="pokedex-page__empty">
                            Pokedex data is not available yet. Try again after the Pokemon catalog finishes loading.
                          </p>
                        ) : null}
                        {regionSummaries.length > 0 && visibleRegions.length === 0 ? (
                          <p className="pokedex-page__empty">
                            No regions have matching {categoryPokemonPhrase.toLowerCase()} in this view.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {viewMode === 'detail' ? (
            <div className="pokedex-region-detail">
              <div className="pokedex-region-detail__toolbar">
                <label className="pokedex-region-detail__search">
                  <span className="pokedex-region-detail__search-label">Search</span>
                  <input
                    type="search"
                    value={regionSearchTerm}
                    onChange={(event) => setRegionSearchTerm(event.target.value)}
                    placeholder="Pokemon or number"
                  />
                </label>
                <div className="pokedex-region-detail__registration-tray" aria-label="Visible registration actions">
                  <div className="pokedex-region-detail__registration-copy">
                    <span>Visible</span>
                    <strong>{activeVisibleRegistrationEntries.length}</strong>
                  </div>
                  <div className="pokedex-region-detail__bulk-actions">
                    <button
                      className="pokedex-region-detail__bulk-action pokedex-region-detail__bulk-action--register"
                      type="button"
                      disabled={activeVisibleRegistrationEntries.length === 0}
                      onClick={handleRegisterVisible}
                    >
                      Register all
                    </button>
                    <button
                      className="pokedex-region-detail__bulk-action pokedex-region-detail__bulk-action--unregister"
                      type="button"
                      disabled={activeVisibleRegistrationEntries.length === 0}
                      onClick={handleClearVisible}
                    >
                      Unregister all
                    </button>
                  </div>
                </div>
              </div>

              <div className="pokedex-category-slider-container">
                <div
                  className="pokedex-category-slider"
                  style={{ transform: `translateX(-${selectedCategoryIndex * 100}%)` }}
                >
                  {visibleVariantCategories.map((category) => {
                    const categorySummaryMap = regionCategorySummariesByKey.get(category.key);
                    const categoryLabel = hasActiveAdvancedFacets
                      ? `${category.label} + qualities`
                      : category.label;
                    const categoryPokemonPhrase = getCategoryPokemonPhrase(
                      category,
                      hasActiveAdvancedFacets,
                    );
                    const hasVisibleSearchResults =
                      !normalizedRegionSearchTerm ||
                      regionSummaries.some((region) => {
                        const categorySummary = categorySummaryMap?.get(region.key);
                        if (!categorySummary || categorySummary.totalCount === 0) return false;
                        return (
                          filterPokemonBySearch(
                            categorySummary.species,
                            normalizedRegionSearchTerm,
                          ).length > 0
                        );
                      });

                    return (
                      <div
                        className="pokedex-category-panel"
                        key={category.key}
                        style={getThemeStyle(category)}
                        aria-hidden={category.key !== selectedCategoryKey}
                      >
                        <div className="pokedex-region-detail__sections">
                          {regionSummaries.map((region) => {
                            const categorySummary = categorySummaryMap?.get(region.key) ?? {
                              species: [],
                              registeredKeys: new Set<string>(),
                              totalCount: 0,
                              registeredCount: 0,
                            };
                            if (categorySummary.totalCount === 0) return null;

                            const visibleSpecies = filterPokemonBySearch(
                              categorySummary.species,
                              normalizedRegionSearchTerm,
                            );
                            if (visibleSpecies.length === 0) return null;

                            const isCurrentRegion =
                              category.key === selectedCategoryKey && region.key === selectedRegionKey;
                            const regionSectionRefKey = getRegionSectionRefKey(category.key, region.key);
                            const isCollapsed = collapsedRegionSectionKeys.has(regionSectionRefKey);
                            const regionGridId = getRegionGridId(category.key, region.key);

                            return (
                              <section
                                className={`pokedex-region-detail__section ${
                                  isCurrentRegion ? 'is-current' : ''
                                } ${isCollapsed ? 'is-collapsed' : ''}`}
                                key={region.key}
                                ref={(element) => {
                                  regionSectionRefs.current[regionSectionRefKey] = element;
                                }}
                                style={getRegionStyle(region)}
                              >
                                <header className="pokedex-region-detail__summary">
                                  <div className="pokedex-region-detail__summary-top">
                                    <div className="pokedex-region-detail__summary-heading">
                                      <p className="pokedex-region-detail__eyebrow">{categoryLabel}</p>
                                      <h2 className="pokedex-region-detail__title">{region.label}</h2>
                                    </div>
                                    <div className="pokedex-region-detail__count">
                                      {categorySummary.registeredCount} / {categorySummary.totalCount}
                                    </div>
                                    <button
                                      className="pokedex-region-detail__summary-toggle"
                                      type="button"
                                      aria-controls={regionGridId}
                                      aria-expanded={!isCollapsed}
                                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${region.label} ${categoryLabel}`}
                                      onClick={() => handleToggleRegionSection(category.key, region.key)}
                                    >
                                      <span className="pokedex-region-detail__folder-indicator" aria-hidden="true" />
                                    </button>
                                  </div>
                                  <dl
                                    className="pokedex-region-detail__stats"
                                    aria-hidden={isCollapsed}
                                    aria-label={`${region.label} registration totals`}
                                  >
                                    <div>
                                      <dt>Shiny</dt>
                                      <dd>{region.shinyCount}</dd>
                                    </div>
                                    <div>
                                      <dt>Lucky</dt>
                                      <dd>{region.luckyCount}</dd>
                                    </div>
                                    <div>
                                      <dt>XXL</dt>
                                      <dd>{region.xxlCount}</dd>
                                    </div>
                                    <div>
                                      <dt>XXS</dt>
                                      <dd>{region.xxsCount}</dd>
                                    </div>
                                    <div>
                                      <dt>100%</dt>
                                      <dd>{region.perfectCount}</dd>
                                    </div>
                                  </dl>
                                </header>

                                <div
                                  className="pokedex-region-detail__grid-collapsible"
                                  aria-hidden={isCollapsed}
                                >
                                  <div className="pokedex-region-detail__grid-collapsible-inner">
                                    <div
                                      className="pokedex-region-grid"
                                      id={regionGridId}
                                      aria-label={`${region.label} ${categoryLabel}`}
                                    >
                                  {visibleSpecies.map((pokemon) => {
                                    const isReleased = isPokedexPokemonReleased(pokemon);
                                    const registrationKey = getPokemonRegistrationKey(pokemon, {
                                      selectedFacets: advancedFacets,
                                      useDexRegistration: shouldCollapseCategoryByDex(category.key),
                                    });
                                    const isRegistered =
                                      registrationKey !== null && categorySummary.registeredKeys.has(registrationKey);
                                    const variantBadges = [
                                      ...getVariantBadgeIcons(pokemon),
                                      ...getActiveFacetBadgeIcons(advancedSelection),
                                    ];
                                    const manualRegistrationEntry = isReleased
                                      ? createManualPokedexRegistration(pokemon, advancedFacets)
                                      : null;

                                    return (
                                      <article
                                        className={`pokedex-region-grid__cell ${
                                          !isReleased
                                            ? 'is-unreleased'
                                            : isRegistered
                                              ? 'is-registered'
                                              : 'is-missing'
                                        }`}
                                        key={pokemon.variant_id}
                                      >
                                        <button
                                          className="pokedex-region-grid__open"
                                          type="button"
                                          disabled={!isReleased}
                                          tabIndex={category.key === selectedCategoryKey && !isCollapsed ? 0 : -1}
                                          onClick={() => handleOpenPokemonDetail(pokemon)}
                                        >
                                          <span className="pokedex-region-grid__image-frame">
                                            <PokedexPokemonImage
                                              className="pokedex-region-grid__image"
                                              pokemon={pokemon}
                                              gender={displayGender}
                                            />
                                            {variantBadges.length > 0 ? (
                                              <span className="pokedex-region-grid__variant-badges" aria-hidden="true">
                                                {variantBadges.map((badge) => (
                                                  <img
                                                    className={getPokedexIconClassName(
                                                      'pokedex-region-grid__variant-badge',
                                                      badge.src,
                                                    )}
                                                    key={badge.label}
                                                    src={badge.src}
                                                    alt={badge.label}
                                                  />
                                                ))}
                                              </span>
                                            ) : null}
                                          </span>
                                          <span className="pokedex-region-grid__number">{formatDexNumber(pokemon)}</span>
                                          <span className="pokedex-region-grid__name">{getDisplayName(pokemon)}</span>
                                          <span className="pokedex-region-grid__state">
                                            {!isReleased
                                              ? 'Unreleased'
                                              : isRegistered
                                                ? 'Registered'
                                                : 'Missing'}
                                          </span>
                                        </button>
                                        {manualRegistrationEntry ? (
                                          <button
                                            className="pokedex-region-grid__registration-toggle"
                                            type="button"
                                            aria-label={`${isRegistered ? 'Clear' : 'Register'} ${getDisplayName(pokemon)}`}
                                            aria-pressed={isRegistered}
                                            tabIndex={category.key === selectedCategoryKey && !isCollapsed ? 0 : -1}
                                            onClick={() =>
                                              handleToggleRegionRegistration(
                                                manualRegistrationEntry,
                                                isRegistered,
                                              )
                                            }
                                          >
                                            {isRegistered ? '✓' : '+'}
                                          </button>
                                        ) : null}
                                      </article>
                                    );
                                  })}
                                    </div>
                                  </div>
                                </div>

                              </section>
                            );
                          })}
                          {!hasVisibleSearchResults ? (
                            <p className="pokedex-region-detail__empty">
                              No {categoryPokemonPhrase} match this search.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

        </section>
      {viewMode === 'detail' && !selectedPokemon ? (
        <CloseButton
          className="pokedex-page__detail-close"
          onClick={handleShowRegions}
          title="Back to regions"
        />
      ) : null}
    </AppPageShell>
  );
}

export default Pokedex;
