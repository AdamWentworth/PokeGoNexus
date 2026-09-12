// Shared by the Vite and native Pokédex detail screens.
import { buildPokedexRegistrationId, createManualPokedexRegistration,
  type PokedexRegistrationEntry, type PokedexRegistrationFacets,
} from '../../features/pokedex/registrationProjection';
import type { PokemonVariant } from '../../types/pokemonVariants';
import { getDisplayName, getFusionId, getSpeciesName, getVariantCategory,
  getVariantFamilyKey, isShadowVariant, isShinyVariant, normalizeVariantType,
} from './pokedexPokemonDetailModel';

export type PokedexGenderValue = 'Male' | 'Female';
export type PokedexPokemonDetailTab = 'registered' | 'info' | 'battle' | 'more';
type PokedexSlotSection =
  | 'primary'
  | 'costume'
  | 'shadow'
  | 'mega'
  | 'max'
  | 'fusion'
  | 'special';
type PokedexComboBadgePlacement = 'left' | 'right';
type PokedexComboFilterGroup = 'status' | 'variant' | 'gender' | 'size' | 'quality';
export type PokedexComboFilterKey =
  | 'registered'
  | 'missing'
  | 'pokemon'
  | 'shiny'
  | 'male'
  | 'female'
  | 'xxs'
  | 'xs'
  | 'xl'
  | 'xxl'
  | 'lucky'
  | 'perfect';
type PokedexDetailThemeKey =
  | 'pokemon'
  | 'shiny'
  | 'shadow'
  | 'costume'
  | 'mega'
  | 'dynamax'
  | 'gigantamax'
  | 'fusion'
  | 'shiny-shadow'
  | 'shiny-costume'
  | 'shadow-costume'
  | 'shiny-mega'
  | 'shiny-dynamax'
  | 'shiny-gigantamax'
  | 'shiny-fusion'
  | 'lucky'
  | 'purified'
  | 'xxs'
  | 'xs'
  | 'xl'
  | 'xxl'
  | 'perfect';

export interface PokedexPokemonDetailProps {
  pokemon: PokemonVariant;
  variants: PokemonVariant[];
  registrations: PokedexRegistrationEntry[];
  gender?: PokedexGenderValue;
  onRegister?: (entries: PokedexRegistrationEntry[]) => void | Promise<void>;
  onUnregister?: (registrationIds: string[]) => void | Promise<void>;
  onClose: () => void;
}

export interface PokedexRegistrationSlot {
  key: string;
  label: string;
  section: PokedexSlotSection;
  pokemon: PokemonVariant;
  facets?: PokedexRegistrationFacets;
  icon?: string;
  iconPlacement?: 'left' | 'right';
  purifiedImage?: boolean;
  releaseDate?: string | null;
  registered: boolean;
  registration?: PokedexRegistrationEntry;
}

interface PokedexComboBadge {
  key: string;
  label: string;
  icon?: string;
  placement: PokedexComboBadgePlacement;
}

export interface PokedexComboFilter {
  key: PokedexComboFilterKey;
  label: string;
  group: PokedexComboFilterGroup;
}

export interface PokedexRegistrationCombo {
  key: string;
  label: string;
  pokemon: PokemonVariant;
  facets: PokedexRegistrationFacets;
  purifiedImage?: boolean;
  badges: PokedexComboBadge[];
  registered: boolean;
}

export interface PokedexComboSection {
  slot: PokedexRegistrationSlot;
  combos: PokedexRegistrationCombo[];
  registeredCount: number;
}

export const EMPTY_REGISTRATION_COMBOS: PokedexRegistrationCombo[] = [];

export const COMBO_FILTERS: PokedexComboFilter[] = [
  { key: 'registered', label: 'Registered', group: 'status' },
  { key: 'missing', label: 'Missing', group: 'status' },
  { key: 'pokemon', label: 'Pokemon', group: 'variant' },
  { key: 'shiny', label: 'Shiny', group: 'variant' },
  { key: 'male', label: 'Male', group: 'gender' },
  { key: 'female', label: 'Female', group: 'gender' },
  { key: 'xxs', label: 'XXS', group: 'size' },
  { key: 'xs', label: 'XS', group: 'size' },
  { key: 'xl', label: 'XL', group: 'size' },
  { key: 'xxl', label: 'XXL', group: 'size' },
  { key: 'lucky', label: 'Lucky', group: 'quality' },
  { key: 'perfect', label: '100%', group: 'quality' },
];

export const EXCLUSIVE_COMBO_FILTER_GROUPS = new Set<PokedexComboFilterGroup>([
  'status',
  'variant',
  'gender',
  'size',
]);

const ICONS_DARK_ON_LIGHT = new Set([
  '/images/appraisal_04.png',
  '/images/height.png',
  '/images/lucky-icon.png',
  '/images/xxl.png',
  '/images/xxs.png',
]);

export function getSlotThemeKey(slot?: PokedexRegistrationSlot): PokedexDetailThemeKey {
  if (!slot) return 'pokemon';

  if (slot.facets?.purified === true || slot.purifiedImage === true) return 'purified';
  if (slot.facets?.lucky === true) return 'lucky';
  if (slot.facets?.appraisal === '4-star') return 'perfect';
  if (slot.facets?.size === 'xxs') return 'xxs';
  if (slot.facets?.size === 'xs') return 'xs';
  if (slot.facets?.size === 'xl') return 'xl';
  if (slot.facets?.size === 'xxl') return 'xxl';

  return getVariantCategory(slot.pokemon).replace(/\s+/g, '-') as PokedexDetailThemeKey;
}

function getSlotRegistrationId(
  pokemon: PokemonVariant,
  facets: PokedexRegistrationFacets = {},
): string {
  return buildPokedexRegistrationId({
    pokemon_id: pokemon.pokemon_id,
    form: pokemon.form,
    facets: { variant: pokemon.variantType, ...facets },
  });
}

export function getIconClassName(baseClassName: string, icon: string): string {
  return ICONS_DARK_ON_LIGHT.has(icon)
    ? `${baseClassName} ${baseClassName}--dark-on-light`
    : baseClassName;
}

export function getSizedImageClassName(
  baseClassName: string,
  facets?: PokedexRegistrationFacets,
): string {
  return facets?.size
    ? `${baseClassName} pokedex-pokemon-detail__size-image--${facets.size}`
    : baseClassName;
}

function getRegistration(
  registrations: PokedexRegistrationEntry[],
  pokemon: PokemonVariant,
  facets?: PokedexRegistrationFacets,
): PokedexRegistrationEntry | undefined {
  const registrationId = getSlotRegistrationId(pokemon, facets);
  return registrations.find((entry) => entry.registration_id === registrationId);
}

function createManualRegistrationForPokemon(
  pokemon: PokemonVariant,
  facets: PokedexRegistrationFacets = {},
): PokedexRegistrationEntry {
  return createManualPokedexRegistration(pokemon, facets);
}

export function createManualRegistrationForSlot(
  slot: PokedexRegistrationSlot,
): PokedexRegistrationEntry {
  return createManualRegistrationForPokemon(slot.pokemon, slot.facets ?? {});
}

export function createManualRegistrationForCombo(
  combo: PokedexRegistrationCombo,
): PokedexRegistrationEntry {
  return createManualRegistrationForPokemon(combo.pokemon, combo.facets);
}

function createSlot(input: {
  key: string;
  label: string;
  section: PokedexSlotSection;
  pokemon: PokemonVariant;
  registrations: PokedexRegistrationEntry[];
  facets?: PokedexRegistrationFacets;
  icon?: string;
  iconPlacement?: 'left' | 'right';
  purifiedImage?: boolean;
  releaseDate?: string | null;
}): PokedexRegistrationSlot {
  const registration = getRegistration(input.registrations, input.pokemon, input.facets);

  return {
    key: input.key,
    label: input.label,
    section: input.section,
    pokemon: input.pokemon,
    facets: input.facets,
    icon: input.icon,
    iconPlacement: input.iconPlacement,
    purifiedImage: input.purifiedImage,
    releaseDate: input.releaseDate,
    registration,
    registered: registration?.is_registered === true,
  };
}

function getVariantLabel(pokemon: PokemonVariant): string {
  const category = getVariantCategory(pokemon);
  if (category === 'pokemon') return 'Pokemon';
  if (category === 'shiny') return 'Shiny';
  if (category === 'shadow') return 'Shadow';

  return getDisplayName(pokemon);
}

function getFusionIcon(pokemon: PokemonVariant): string {
  const fusionId = getFusionId(pokemon);
  return `/images/fusion_${fusionId ?? 1}.png`;
}

function getVariantIcon(pokemon: PokemonVariant): string | undefined {
  const category = getVariantCategory(pokemon);

  switch (category) {
    case 'shadow':
    case 'shiny shadow':
      return '/images/shadow_icon.png';
    case 'costume':
    case 'shiny costume':
    case 'shadow costume':
      return '/images/costume_icon.png';
    case 'mega':
    case 'shiny mega':
      return '/images/mega.png';
    case 'dynamax':
    case 'shiny dynamax':
      return '/images/dynamax-icon.png';
    case 'gigantamax':
    case 'shiny gigantamax':
      return '/images/gigantamax-icon.png';
    case 'fusion':
    case 'shiny fusion':
      return getFusionIcon(pokemon);
    default:
      return undefined;
  }
}

function getVariantBadge(pokemon: PokemonVariant): PokedexComboBadge | null {
  const icon = getVariantIcon(pokemon);
  if (!icon) return null;

  return {
    key: `variant:${pokemon.variant_id}`,
    label: getVariantLabel(pokemon),
    icon,
    placement: 'right',
  };
}

function getRelatedComboVariants(
  selectedPokemon: PokemonVariant,
  variants: PokemonVariant[],
  includeRelatedFamilyVariants = true,
): PokemonVariant[] {
  if (!includeRelatedFamilyVariants) return [selectedPokemon];

  const familyKey = getVariantFamilyKey(selectedPokemon);
  const related = variants.filter(
    (variant) =>
      variant.pokemon_id === selectedPokemon.pokemon_id &&
      getVariantFamilyKey(variant) === familyKey,
  );

  if (related.length === 0) return [selectedPokemon];

  return related.sort((left, right) => {
    if (isShinyVariant(left) !== isShinyVariant(right)) {
      return isShinyVariant(left) ? 1 : -1;
    }
    return left.variant_id.localeCompare(right.variant_id);
  });
}

function sortSpeciesVariants(variants: PokemonVariant[]): PokemonVariant[] {
  return [...variants].sort((left, right) => {
    const leftCategory = getVariantCategory(left);
    const rightCategory = getVariantCategory(right);
    if (leftCategory !== rightCategory) return leftCategory.localeCompare(rightCategory);

    const leftName = getDisplayName(left);
    const rightName = getDisplayName(right);
    if (leftName !== rightName) return leftName.localeCompare(rightName);

    return left.variant_id.localeCompare(right.variant_id);
  });
}

function getCostumeId(pokemon: PokemonVariant): number | null {
  const match = normalizeVariantType(pokemon).match(/costume_(\d+)/);
  if (!match) return null;

  const costumeId = Number(match[1]);
  return Number.isFinite(costumeId) ? costumeId : null;
}

function getCostumeData(pokemon: PokemonVariant) {
  const costumeId = getCostumeId(pokemon);
  if (costumeId === null) return null;

  return pokemon.costumes?.find((costume) => Number(costume.costume_id) === costumeId) ?? null;
}

function getVariantReleaseDate(pokemon: PokemonVariant): string | null {
  const category = getVariantCategory(pokemon);
  const costume = getCostumeData(pokemon);

  if (costume) {
    if (category === 'shiny costume') {
      return costume.date_shiny_available ?? costume.date_available ?? null;
    }

    if (category === 'shadow costume') {
      return costume.shadow_costume?.date_available ?? costume.date_available ?? null;
    }

    return costume.date_available ?? null;
  }

  if (category === 'shiny shadow') {
    return pokemon.date_shiny_shadow_available ?? pokemon.date_shadow_available ?? null;
  }

  if (category === 'shadow') {
    return pokemon.date_shadow_available ?? null;
  }

  if (category.includes('shiny')) {
    return pokemon.date_shiny_available ?? pokemon.date_available ?? null;
  }

  return pokemon.date_available ?? null;
}

function getVariantFamilyReleaseDate(pokemon: PokemonVariant): string | null {
  const costume = getCostumeData(pokemon);
  if (costume) return costume.date_available ?? null;

  const category = getVariantCategory(pokemon);
  if (category.includes('shadow')) return pokemon.date_shadow_available ?? pokemon.date_available ?? null;
  return pokemon.date_available ?? null;
}

function getDateSortTime(date: string | null): number {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const time = new Date(date).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function formatReleaseDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function getVariantFamilySortLabel(pokemon: PokemonVariant): string {
  const costumeId = getCostumeId(pokemon);
  if (costumeId !== null) return `costume:${String(costumeId).padStart(5, '0')}`;

  return `${getVariantCategory(pokemon)}:${getVariantFamilyKey(pokemon)}`;
}

function sortVariantsByFamilyThenShiny(variants: PokemonVariant[]): PokemonVariant[] {
  return [...variants].sort((left, right) => {
    const leftFamilyDate = getDateSortTime(getVariantFamilyReleaseDate(left));
    const rightFamilyDate = getDateSortTime(getVariantFamilyReleaseDate(right));
    if (leftFamilyDate !== rightFamilyDate) return leftFamilyDate - rightFamilyDate;

    const leftFamilyLabel = getVariantFamilySortLabel(left);
    const rightFamilyLabel = getVariantFamilySortLabel(right);
    if (leftFamilyLabel !== rightFamilyLabel) return leftFamilyLabel.localeCompare(rightFamilyLabel);

    if (isShinyVariant(left) !== isShinyVariant(right)) {
      return isShinyVariant(left) ? 1 : -1;
    }

    const leftReleaseDate = getDateSortTime(getVariantReleaseDate(left));
    const rightReleaseDate = getDateSortTime(getVariantReleaseDate(right));
    if (leftReleaseDate !== rightReleaseDate) return leftReleaseDate - rightReleaseDate;

    return getDisplayName(left).localeCompare(getDisplayName(right)) || left.variant_id.localeCompare(right.variant_id);
  });
}

export function getGenderOptions(pokemon: PokemonVariant): PokedexGenderValue[] {
  const genderRate = String(pokemon.gender_rate ?? '').toUpperCase();
  if (genderRate === 'GENDERLESS' || genderRate === 'NONE') return [];
  if (genderRate === 'M/M') return ['Male'];
  if (genderRate === 'F/F') return ['Female'];
  if (genderRate === 'M/F' || genderRate === 'F/M') return ['Male', 'Female'];

  const maleRate = genderRate.match(/(\d+)M/)?.[1];
  const femaleRate = genderRate.match(/(\d+)F/)?.[1];
  const options: PokedexGenderValue[] = [];
  if (Number(maleRate ?? 0) > 0) options.push('Male');
  if (Number(femaleRate ?? 0) > 0) options.push('Female');
  return options;
}

function getComboRegistrationBadges(input: {
  pokemon: PokemonVariant;
  facets: PokedexRegistrationFacets;
}): PokedexComboBadge[] {
  const variantBadge = getVariantBadge(input.pokemon);
  const badges: PokedexComboBadge[] = variantBadge ? [variantBadge] : [];

  if (input.facets.gender === 'Male') {
    badges.push({
      key: 'gender:male',
      label: 'Male',
      icon: '/images/male-icon.png',
      placement: 'left',
    });
  }

  if (input.facets.gender === 'Female') {
    badges.push({
      key: 'gender:female',
      label: 'Female',
      icon: '/images/female-icon.png',
      placement: 'left',
    });
  }

  if (input.facets.size === 'xxs') {
    badges.push({
      key: 'size:xxs',
      label: 'XXS',
      icon: '/images/xxs.png',
      placement: 'left',
    });
  }

  if (input.facets.size === 'xs') {
    badges.push({
      key: 'size:xs',
      label: 'XS',
      icon: '/images/height.png',
      placement: 'left',
    });
  }

  if (input.facets.size === 'xl') {
    badges.push({
      key: 'size:xl',
      label: 'XL',
      icon: '/images/height.png',
      placement: 'left',
    });
  }

  if (input.facets.size === 'xxl') {
    badges.push({
      key: 'size:xxl',
      label: 'XXL',
      icon: '/images/xxl.png',
      placement: 'left',
    });
  }

  if (input.facets.purified === true) {
    badges.push({
      key: 'purified',
      label: 'Purified',
      icon: '/images/purified.png',
      placement: 'left',
    });
  }

  if (input.facets.lucky === true) {
    badges.push({
      key: 'lucky',
      label: 'Lucky',
      icon: '/images/lucky-icon.png',
      placement: 'left',
    });
  }

  if (input.facets.appraisal === '4-star') {
    badges.push({
      key: 'perfect',
      label: '100%',
      icon: '/images/appraisal_04.png',
      placement: 'left',
    });
  }

  return badges;
}

function getComboLabel(input: {
  pokemon: PokemonVariant;
  facets: PokedexRegistrationFacets;
}): string {
  const labels = [
    isShinyVariant(input.pokemon) ? 'Shiny' : null,
    input.facets.purified === true ? 'Purified' : null,
    input.facets.gender,
    input.facets.size ? String(input.facets.size).toUpperCase() : null,
    input.facets.lucky === true ? 'Lucky' : null,
    input.facets.appraisal === '4-star' ? '100%' : null,
  ].filter(Boolean);

  return labels.length === 0 ? getVariantLabel(input.pokemon) : labels.join(' ');
}

function getFacetCombinationOptions(pokemon: PokemonVariant): PokedexRegistrationFacets[] {
  const genderOptions = getGenderOptions(pokemon);
  const genderFacets = [
    {},
    ...genderOptions.map((gender): PokedexRegistrationFacets => ({ gender })),
  ];
  const sizeFacets: PokedexRegistrationFacets[] = [
    {},
    { size: 'xxs' },
    { size: 'xs' },
    { size: 'xl' },
    { size: 'xxl' },
  ];
  const luckyFacets: PokedexRegistrationFacets[] = isShadowVariant(pokemon)
    ? [{}]
    : [{}, { lucky: true }];
  const perfectFacets: PokedexRegistrationFacets[] = [{}, { appraisal: '4-star' }];
  const combinations: PokedexRegistrationFacets[] = [];

  for (const genderFacet of genderFacets) {
    for (const sizeFacet of sizeFacets) {
      for (const luckyFacet of luckyFacets) {
        for (const perfectFacet of perfectFacets) {
          combinations.push({
            ...genderFacet,
            ...sizeFacet,
            ...luckyFacet,
            ...perfectFacet,
          });
        }
      }
    }
  }

  return combinations;
}

export function getRegistrationCombos(input: {
  selectedSlot: PokedexRegistrationSlot | undefined;
  variants: PokemonVariant[];
  registrations: PokedexRegistrationEntry[];
}): PokedexRegistrationCombo[] {
  if (!input.selectedSlot) return [];

  const comboVariants = getRelatedComboVariants(
    input.selectedSlot.pokemon,
    input.variants,
    input.selectedSlot.section !== 'primary',
  );
  const slotFacets = input.selectedSlot.facets ?? {};

  return comboVariants.flatMap((pokemon) =>
    getFacetCombinationOptions(pokemon).map((facets) => {
      const mergedFacets = { ...slotFacets, ...facets };
      const registration = getRegistration(input.registrations, pokemon, mergedFacets);

      return {
        key: getSlotRegistrationId(pokemon, mergedFacets),
        label: getComboLabel({ pokemon, facets: mergedFacets }),
        pokemon,
        facets: mergedFacets,
        purifiedImage: mergedFacets.purified === true,
        badges: getComboRegistrationBadges({ pokemon, facets: mergedFacets }),
        registered: registration?.is_registered === true,
      };
    }),
  );
}

function isComboRootSlot(slot: PokedexRegistrationSlot): boolean {
  return slot.section !== 'primary' || !slot.facets;
}

export function getComboRootSlots(slots: PokedexRegistrationSlot[]): PokedexRegistrationSlot[] {
  const seenVariantFamilies = new Set<string>();

  return slots.filter((slot) => {
    if (!isComboRootSlot(slot)) return false;
    if (slot.section === 'primary') return true;

    const familyKey = `${slot.section}:${getVariantFamilyKey(slot.pokemon)}`;
    if (seenVariantFamilies.has(familyKey)) return false;

    seenVariantFamilies.add(familyKey);
    return true;
  });
}

export function getComboRootKeyForSlot(
  slot: PokedexRegistrationSlot | undefined,
  rootSlots: PokedexRegistrationSlot[],
): string | null {
  if (!slot) return null;

  const exactRoot = rootSlots.find((rootSlot) => rootSlot.key === slot.key);
  if (exactRoot) return exactRoot.key;

  if (slot.section === 'primary') return null;

  const familyRoot = rootSlots.find(
    (rootSlot) =>
      rootSlot.section === slot.section &&
      getVariantFamilyKey(rootSlot.pokemon) === getVariantFamilyKey(slot.pokemon),
  );

  return familyRoot?.key ?? null;
}

function normalizeSearchTerm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function getComboSearchText(combo: PokedexRegistrationCombo): string {
  const labels = [
    combo.label,
    getDisplayName(combo.pokemon),
    getSpeciesName(combo.pokemon),
    getVariantLabel(combo.pokemon),
    combo.pokemon.variantType,
    combo.pokemon.form,
    combo.facets.gender,
    combo.facets.size,
    combo.facets.lucky === true ? 'lucky' : null,
    combo.facets.appraisal === '4-star' ? '100 perfect hundo 4-star' : null,
    isShinyVariant(combo.pokemon) ? 'shiny' : 'pokemon base normal',
    combo.registered ? 'registered' : 'missing',
    ...combo.badges.map((badge) => badge.label),
  ];

  return labels.map(normalizeSearchTerm).filter(Boolean).join(' ');
}

function comboMatchesFilterKey(
  combo: PokedexRegistrationCombo,
  key: PokedexComboFilterKey,
): boolean {
  switch (key) {
    case 'registered':
      return combo.registered;
    case 'missing':
      return !combo.registered;
    case 'pokemon':
      return !isShinyVariant(combo.pokemon);
    case 'shiny':
      return isShinyVariant(combo.pokemon);
    case 'male':
      return combo.facets.gender === 'Male';
    case 'female':
      return combo.facets.gender === 'Female';
    case 'xxs':
    case 'xs':
    case 'xl':
    case 'xxl':
      return combo.facets.size === key;
    case 'lucky':
      return combo.facets.lucky === true;
    case 'perfect':
      return combo.facets.appraisal === '4-star';
    default:
      return true;
  }
}

function groupComboFilterKeys(activeFilterKeys: PokedexComboFilterKey[]) {
  return activeFilterKeys.reduce(
    (groups, key) => {
      const filter = COMBO_FILTERS.find((option) => option.key === key);
      if (!filter) return groups;

      groups[filter.group] = [...(groups[filter.group] ?? []), key];
      return groups;
    },
    {} as Partial<Record<PokedexComboFilterGroup, PokedexComboFilterKey[]>>,
  );
}

function comboMatchesActiveFilters(
  combo: PokedexRegistrationCombo,
  activeFilterKeys: PokedexComboFilterKey[],
): boolean {
  const groupedFilters = groupComboFilterKeys(activeFilterKeys);

  return (Object.entries(groupedFilters) as [
    PokedexComboFilterGroup,
    PokedexComboFilterKey[],
  ][]).every(([group, keys]) => {
    if (keys.length === 0) return true;
    if (group === 'quality') return keys.every((key) => comboMatchesFilterKey(combo, key));
    return keys.some((key) => comboMatchesFilterKey(combo, key));
  });
}

function comboMatchesSearch(combo: PokedexRegistrationCombo, search: string): boolean {
  const tokens = normalizeSearchTerm(search).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const searchText = getComboSearchText(combo);
  return tokens.every((token) => searchText.includes(token));
}

export function filterRegistrationCombos(
  combos: PokedexRegistrationCombo[],
  search: string,
  activeFilterKeys: PokedexComboFilterKey[],
): PokedexRegistrationCombo[] {
  return combos.filter(
    (combo) =>
      comboMatchesSearch(combo, search) &&
      comboMatchesActiveFilters(combo, activeFilterKeys),
  );
}

export function getRegistrationSlots(
  pokemon: PokemonVariant,
  variants: PokemonVariant[],
  registrations: PokedexRegistrationEntry[],
): PokedexRegistrationSlot[] {
  const speciesVariants = sortSpeciesVariants(
    variants.filter((variant) => variant.pokemon_id === pokemon.pokemon_id),
  );
  const defaultVariant =
    speciesVariants.find(
      (variant) => getVariantCategory(variant) === 'pokemon' && variant.form === pokemon.form,
    ) ??
    speciesVariants.find((variant) => getVariantCategory(variant) === 'pokemon') ??
    pokemon;
  const findVariant = (category: string) =>
    speciesVariants.find((variant) => getVariantCategory(variant) === category);
  const shinyVariant = findVariant('shiny');
  const shadowVariant = findVariant('shadow');
  const shinyShadowVariant = findVariant('shiny shadow');
  const hasShadowAvailability = speciesVariants.some((variant) =>
    getVariantCategory(variant).includes('shadow'),
  );
  const costumeVariants = sortVariantsByFamilyThenShiny(
    speciesVariants.filter((variant) =>
      ['costume', 'shiny costume', 'shadow costume'].includes(getVariantCategory(variant)),
    ),
  );
  const megaVariants = sortVariantsByFamilyThenShiny(
    speciesVariants.filter((variant) =>
      ['mega', 'shiny mega'].includes(getVariantCategory(variant)),
    ),
  );
  const maxVariants = sortVariantsByFamilyThenShiny(
    speciesVariants.filter((variant) =>
      ['dynamax', 'shiny dynamax', 'gigantamax', 'shiny gigantamax'].includes(
        getVariantCategory(variant),
      ),
    ),
  );
  const fusionVariants = sortVariantsByFamilyThenShiny(
    speciesVariants.filter((variant) =>
      ['fusion', 'shiny fusion'].includes(getVariantCategory(variant)),
    ),
  );

  const primarySlots: PokedexRegistrationSlot[] = [
    createSlot({
      key: `variant:${defaultVariant.variant_id}`,
      label: 'Pokemon',
      section: 'primary',
      pokemon: defaultVariant,
      registrations,
      icon: '/images/pokedex-icon.png',
    }),
    shinyVariant
      ? createSlot({
          key: `variant:${shinyVariant.variant_id}`,
          label: 'Shiny',
          section: 'primary',
          pokemon: shinyVariant,
          registrations,
        })
      : null,
    createSlot({
      key: `facet:perfect:${defaultVariant.variant_id}`,
      label: '100%',
      section: 'primary',
      pokemon: defaultVariant,
      registrations,
      facets: { appraisal: '4-star' },
      icon: '/images/appraisal_04.png',
    }),
    createSlot({
      key: `facet:lucky:${defaultVariant.variant_id}`,
      label: 'Lucky',
      section: 'primary',
      pokemon: defaultVariant,
      registrations,
      facets: { lucky: true },
      icon: '/images/lucky-icon.png',
    }),
    createSlot({
      key: `facet:xxl:${defaultVariant.variant_id}`,
      label: 'XXL',
      section: 'primary',
      pokemon: defaultVariant,
      registrations,
      facets: { size: 'xxl' },
      icon: '/images/xxl.png',
    }),
    createSlot({
      key: `facet:xxs:${defaultVariant.variant_id}`,
      label: 'XXS',
      section: 'primary',
      pokemon: defaultVariant,
      registrations,
      facets: { size: 'xxs' },
      icon: '/images/xxs.png',
    }),
  ].filter((slot): slot is PokedexRegistrationSlot => Boolean(slot));

  const shadowSlots: PokedexRegistrationSlot[] = [
    shadowVariant
      ? createSlot({
          key: `variant:${shadowVariant.variant_id}`,
          label: 'Shadow',
          section: 'shadow',
          pokemon: shadowVariant,
          registrations,
          icon: '/images/shadow_icon.png',
        })
      : null,
    shinyShadowVariant
      ? createSlot({
          key: `variant:${shinyShadowVariant.variant_id}`,
          label: 'Shiny Shadow',
          section: 'shadow',
          pokemon: shinyShadowVariant,
          registrations,
          icon: '/images/shadow_icon.png',
        })
      : null,
    hasShadowAvailability
      ? createSlot({
          key: `facet:purified:${defaultVariant.variant_id}`,
          label: 'Purified',
          section: 'shadow',
          pokemon: defaultVariant,
          registrations,
          facets: { purified: true },
          icon: '/images/purified.png',
          purifiedImage: true,
        })
      : null,
    shinyShadowVariant
      ? createSlot({
          key: `facet:shiny-purified:${shinyShadowVariant.variant_id}`,
          label: 'Shiny Purified',
          section: 'shadow',
          pokemon: shinyShadowVariant,
          registrations,
          facets: { purified: true },
          icon: '/images/purified.png',
          purifiedImage: true,
        })
      : null,
  ].filter((slot): slot is PokedexRegistrationSlot => Boolean(slot));

  return [
    ...primarySlots,
    ...costumeVariants.map((variant) =>
      createSlot({
        key: `costume:${variant.variant_id}`,
        label: getVariantLabel(variant),
        section: 'costume',
        pokemon: variant,
        registrations,
        icon: getVariantIcon(variant),
        iconPlacement: 'right',
        releaseDate: getVariantReleaseDate(variant),
      }),
    ),
    ...shadowSlots,
    ...megaVariants.map((variant) =>
      createSlot({
        key: `mega:${variant.variant_id}`,
        label: getVariantLabel(variant),
        section: 'mega',
        pokemon: variant,
        registrations,
        icon: getVariantIcon(variant),
        iconPlacement: 'right',
      }),
    ),
    ...maxVariants.map((variant) =>
      createSlot({
        key: `max:${variant.variant_id}`,
        label: getVariantLabel(variant),
        section: 'max',
        pokemon: variant,
        registrations,
        icon: getVariantIcon(variant),
        iconPlacement: 'right',
      }),
    ),
    ...fusionVariants.map((variant) =>
      createSlot({
        key: `fusion:${variant.variant_id}`,
        label: getVariantLabel(variant),
        section: 'fusion',
        pokemon: variant,
        registrations,
        icon: getVariantIcon(variant),
        iconPlacement: 'right',
      }),
    ),
  ];
}
