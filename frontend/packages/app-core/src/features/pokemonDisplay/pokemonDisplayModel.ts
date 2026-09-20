import type { PokemonInstance } from '@/types/pokemonInstance';
import type {
  CrownForm,
  Fusion,
  MegaEvolution,
  VariantBackground,
} from '@/types/pokemonSubTypes';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { getCrownFormLabel, resolveActiveCrownForm } from '@/utils/crownHelpers';
import { parseBackgroundId } from '@pokemongonexus/shared-domain/instances';
import {
  buildTypeIcon,
  normalizeTypeName,
  resolvePokemonDisplayActiveFusionEntry,
  resolvePokemonDisplayActiveMegaEvolution,
} from './displayHelpers';
import {
  resolvePokemonDisplayFusionComboBackground,
  type ResolveFusionBackgroundPoolResult,
} from './fusionBackgrounds';

export {
  collectInstanceRefCandidates,
  extractLegacyInstanceId,
  findInstanceByRefs,
  normalizeInstanceToken,
  parseBackgroundId,
} from '@pokemongonexus/shared-domain/instances';

export {
  resolvePokemonDisplayFusionBackgroundPool,
  resolvePokemonDisplayFusionComboBackground,
  type FusionBackgroundSource,
  type ResolveFusionBackgroundPoolResult,
} from './fusionBackgrounds';

export {
  buildTypeIcon,
  normalizeFormToken,
  normalizeTypeName,
  parseFusionId,
  resolvePokemonDisplayActiveFusionEntry,
  resolvePokemonDisplayActiveMegaEvolution,
} from './displayHelpers';

export type PokemonDisplaySource = Omit<PokemonVariant, 'instanceData'> & {
  instanceData?: Partial<PokemonInstance>;
  currentImage: string;
};

export type PokemonDisplayTypeData = {
  type1_name?: string;
  type2_name?: string;
  type_1_icon?: string;
  type_2_icon?: string;
};

export type PokemonDisplayAttributes = {
  isDisabled?: boolean;
  isFemale?: boolean;
  isMega?: boolean;
  megaForm?: string | null;
  isFused?: boolean;
  fusionForm?: string | null;
  isCrown?: boolean;
  crownForm?: string | null;
  isPurified?: boolean;
  isDynamax?: boolean;
  isGigantamax?: boolean;
};

export type PokemonDisplayModel = PokemonDisplayAttributes & {
  activeCrownForm?: CrownForm;
  activeFusionEntry?: Fusion;
  activeMegaEvolution?: MegaEvolution;
  crownFormLabel?: string;
  cpValue: string | number | null;
  displayName: string;
  highlightKey: string;
  ownershipClass: string;
  shouldDisplayLuckyBackdrop: boolean;
  typeData: PokemonDisplayTypeData;
};

export const resolvePokemonDisplayTypeData = ({
  pokemon,
  isFused,
  activeFusionEntry,
  isCrown,
  activeCrownForm,
  isMega,
  activeMegaEvolution,
}: {
  pokemon: Pick<
    PokemonDisplaySource,
    'type1_name' | 'type2_name' | 'type_1_icon' | 'type_2_icon'
  >;
  isFused?: boolean;
  activeFusionEntry?: Fusion;
  isCrown?: boolean;
  activeCrownForm?: CrownForm;
  isMega?: boolean;
  activeMegaEvolution?: MegaEvolution;
}): PokemonDisplayTypeData => {
  const baseType1 = pokemon.type1_name;
  const baseType2 = pokemon.type2_name;
  const baseType1Icon = pokemon.type_1_icon || buildTypeIcon(baseType1);
  const baseType2Icon = pokemon.type_2_icon || buildTypeIcon(baseType2);

  if (isFused && activeFusionEntry) {
    const fusionType1 = activeFusionEntry.type1_name ?? baseType1;
    const fusionType2 = activeFusionEntry.type2_name ?? baseType2;
    return {
      type1_name: fusionType1,
      type2_name: fusionType2,
      type_1_icon: buildTypeIcon(fusionType1) ?? baseType1Icon,
      type_2_icon: fusionType2 ? buildTypeIcon(fusionType2) ?? baseType2Icon : undefined,
    };
  }

  if (isCrown && activeCrownForm) {
    const crownType1 = activeCrownForm.type1_name ?? baseType1;
    const crownType2 = activeCrownForm.type2_name ?? baseType2;
    return {
      type1_name: crownType1,
      type2_name: crownType2,
      type_1_icon: buildTypeIcon(crownType1) ?? baseType1Icon,
      type_2_icon: crownType2 ? buildTypeIcon(crownType2) ?? baseType2Icon : undefined,
    };
  }

  if (isMega && activeMegaEvolution) {
    const megaType1 = normalizeTypeName(activeMegaEvolution.type1_name) ?? baseType1;
    const megaHasType2ById =
      typeof activeMegaEvolution.type_2_id === 'number' && activeMegaEvolution.type_2_id > 0;
    const megaType2 =
      normalizeTypeName(activeMegaEvolution.type2_name) ??
      (megaHasType2ById ? baseType2 : undefined);
    return {
      type1_name: megaType1,
      type2_name: megaType2,
      type_1_icon: buildTypeIcon(megaType1) ?? baseType1Icon,
      type_2_icon: megaType2 ? buildTypeIcon(megaType2) ?? baseType2Icon : undefined,
    };
  }

  return {
    type1_name: baseType1,
    type2_name: baseType2,
    type_1_icon: baseType1Icon,
    type_2_icon: baseType2Icon,
  };
};

export const getPokemonDisplayName = ({
  pokemon,
  isFused,
  fusionForm,
  isMega,
  megaForm,
  isCrown,
  activeCrownForm,
}: {
  pokemon: Pick<PokemonDisplaySource, 'name' | 'variantType' | 'instanceData'>;
  isFused?: boolean;
  fusionForm?: string | null;
  isMega?: boolean;
  megaForm?: string | null;
  isCrown?: boolean;
  activeCrownForm?: CrownForm;
}): string => {
  if (pokemon.instanceData?.nickname) return pokemon.instanceData.nickname;

  let name = pokemon.name;
  if (isFused && fusionForm) {
    name = pokemon.instanceData?.shiny ? `Shiny ${fusionForm}` : fusionForm;
  }
  if (isMega) {
    const normalizedName = name
      .replace(/^Shiny\s+Mega\s+/i, '')
      .replace(/^Mega\s+/i, '')
      .replace(/^Shiny\s+/i, '');
    const isShinyState =
      Boolean(pokemon.instanceData?.shiny) ||
      pokemon.variantType.includes('shiny') ||
      /^Shiny\s+/i.test(name);
    const megaSuffix =
      megaForm && !normalizedName.toLowerCase().endsWith(megaForm.toLowerCase())
        ? ` ${megaForm}`
        : '';
    name = `${isShinyState ? 'Shiny Mega' : 'Mega'} ${normalizedName}${megaSuffix}`;
  }
  if (isCrown) {
    const crownLabel = getCrownFormLabel(activeCrownForm);
    if (crownLabel) {
      const normalizedName = name.replace(/^Shiny\s+/i, '');
      const isShinyState =
        Boolean(pokemon.instanceData?.shiny) ||
        pokemon.variantType.includes('shiny') ||
        /^Shiny\s+/i.test(name);
      name = `${isShinyState ? 'Shiny ' : ''}${crownLabel} ${normalizedName}`;
    }
  }
  return name;
};

export const getPokemonDisplayHighlightKey = (pokemon: PokemonDisplaySource): string =>
  pokemon.instanceData?.instance_id ?? pokemon.variant_id;

export const getPokemonDisplayOwnershipClass = (tagFilter: string): string => {
  const f = (tagFilter || '').toLowerCase();
  switch (f) {
    case 'caught':
      return 'caught';
    case 'trade':
      return 'trade';
    case 'wanted':
    case 'most wanted':
      return 'wanted';
    case 'missing':
      return 'missing';
    default:
      return '';
  }
};

export const shouldDisplayPokemonLuckyBackdrop = (
  tagFilter: string,
  instanceData: Partial<PokemonInstance> | undefined,
): boolean =>
  Boolean(
    (['wanted', 'most wanted'].includes(tagFilter.toLowerCase()) &&
      instanceData?.pref_lucky) ||
      instanceData?.lucky,
  );

export const getPokemonDisplayCpValue = ({
  tagFilter,
  sortType,
  pokemon,
}: {
  tagFilter: string;
  sortType: string;
  pokemon: Pick<PokemonDisplaySource, 'cp50' | 'instanceData'>;
}): string | number | null =>
  tagFilter !== ''
    ? (pokemon.instanceData?.cp ?? '')
    : sortType === 'combatPower' && pokemon.cp50 != null
      ? pokemon.cp50
      : '';

export const buildPokemonDisplayModel = ({
  pokemon,
  attributes,
  tagFilter,
  sortType,
}: {
  pokemon: PokemonDisplaySource;
  attributes: PokemonDisplayAttributes;
  tagFilter: string;
  sortType: string;
}): PokemonDisplayModel => {
  const {
    isDisabled = false,
    isFemale = false,
    isMega = false,
    megaForm = null,
    isFused = false,
    fusionForm = null,
    isCrown = false,
    crownForm = null,
    isPurified = false,
    isDynamax = false,
    isGigantamax = false,
  } = attributes;
  const activeCrownForm = resolveActiveCrownForm(pokemon.crownForms, crownForm ?? undefined);
  const activeMegaEvolution = resolvePokemonDisplayActiveMegaEvolution({
    isMega,
    megaForm,
    megaEvolutions: pokemon.megaEvolutions,
  });
  const storedFusion =
    pokemon.instanceData?.fusion && typeof pokemon.instanceData.fusion === 'object'
      ? (pokemon.instanceData.fusion as Record<string, unknown>)
      : null;
  const activeFusionEntry = resolvePokemonDisplayActiveFusionEntry({
    isFused,
    fusionForm,
    fusionEntries: pokemon.fusion,
    storedFusion,
  });
  const typeData = resolvePokemonDisplayTypeData({
    pokemon,
    isFused,
    activeFusionEntry,
    isCrown,
    activeCrownForm,
    isMega,
    activeMegaEvolution,
  });

  return {
    isDisabled,
    isFemale,
    isMega,
    megaForm,
    isFused,
    fusionForm,
    isCrown,
    crownForm,
    isPurified,
    isDynamax,
    isGigantamax,
    activeCrownForm,
    activeFusionEntry,
    activeMegaEvolution,
    crownFormLabel: getCrownFormLabel(activeCrownForm) ?? undefined,
    cpValue: getPokemonDisplayCpValue({ tagFilter, sortType, pokemon }),
    displayName: getPokemonDisplayName({
      pokemon,
      isFused,
      fusionForm,
      isMega,
      megaForm,
      isCrown,
      activeCrownForm,
    }),
    highlightKey: getPokemonDisplayHighlightKey(pokemon),
    ownershipClass: getPokemonDisplayOwnershipClass(tagFilter),
    shouldDisplayLuckyBackdrop: shouldDisplayPokemonLuckyBackdrop(
      tagFilter,
      pokemon.instanceData,
    ),
    typeData,
  };
};

export const resolvePokemonDisplayLocationBackground = ({
  pokemon,
  variantByPokemonId,
  resolvedFusionBackgrounds,
  isFused,
  fusedPartnerInstance,
  fusionForm,
}: {
  pokemon: Pick<
    PokemonDisplaySource,
    'backgrounds' | 'fusion' | 'instanceData' | 'pokemon_id'
  >;
  variantByPokemonId: Map<number, { backgrounds?: VariantBackground[] }>;
  resolvedFusionBackgrounds: ResolveFusionBackgroundPoolResult;
  isFused?: boolean;
  fusedPartnerInstance?: Pick<PokemonInstance, 'location_card'> | null;
  fusionForm?: string | null;
}): VariantBackground | null => {
  const locationCardId = parseBackgroundId(pokemon.instanceData?.location_card);
  if (locationCardId == null) return null;

  const fallbackVariant = variantByPokemonId.get(pokemon.pokemon_id);
  const fallbackBackgrounds = fallbackVariant?.backgrounds ?? [];
  const candidateBackgrounds =
    resolvedFusionBackgrounds.backgrounds.length > 0
      ? resolvedFusionBackgrounds.backgrounds
      : Array.isArray(pokemon.backgrounds) && pokemon.backgrounds.length > 0
        ? pokemon.backgrounds
        : fallbackBackgrounds;

  const directBackground =
    candidateBackgrounds.find((bg) => bg.background_id === locationCardId) ??
    fallbackBackgrounds.find((bg) => bg.background_id === locationCardId) ??
    null;

  if (!isFused) return directBackground;

  const ownBackgroundId = directBackground?.background_id ?? locationCardId;
  const partnerBackgroundId = parseBackgroundId(fusedPartnerInstance?.location_card);

  const comboBackground = resolvePokemonDisplayFusionComboBackground({
    pokemonId: pokemon.pokemon_id,
    fusionEntries: pokemon.fusion ?? [],
    resolvedFusionId: resolvedFusionBackgrounds.fusionId,
    fusionForm: fusionForm ?? null,
    ownBackgroundId,
    partnerBackgroundId,
    availableBackgrounds: candidateBackgrounds,
  });
  if (comboBackground) return comboBackground;

  if (directBackground) return directBackground;

  for (const entry of pokemon.fusion ?? []) {
    for (const rule of entry.background_combo_rules ?? []) {
      if (rule.combo_background_id !== locationCardId) continue;
      const url =
        typeof rule.combo_background_image_url === 'string'
          ? rule.combo_background_image_url.trim()
          : '';
      if (!url) continue;
      return {
        background_id: rule.combo_background_id,
        image_url: url,
        name: rule.combo_background_name ?? `Background ${rule.combo_background_id}`,
        costume_id: 0,
        date: rule.combo_background_date ?? '',
        location: rule.combo_background_location ?? '',
      };
    }
  }

  return null;
};
