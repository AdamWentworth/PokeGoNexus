import type { PokemonInstance } from '../../types/pokemonInstance';
import type { PokemonVariant } from '../../types/pokemonVariants';
import type { Instances } from '../../types/instances';

export type PokedexRegistrationFacetValue = string | number | boolean | null;
export type PokedexRegistrationFacets = Record<string, PokedexRegistrationFacetValue>;
export type PokedexRegistrationSource = 'catalog' | 'manual' | 'instance';
export type PokedexRegistrationLevel = 'base' | 'derived' | 'exact';
export type PokedexSizeClass = 'xxs' | 'xs' | 'normal' | 'xl' | 'xxl';

export interface PokedexRegistrationEntry {
  registration_id: string;
  pokemon_id: number;
  pokedex_number: number | null;
  base_variant_id: string;
  species_name: string;
  form: string | null;
  variant_type: string;
  facets: PokedexRegistrationFacets;
  is_registered: boolean;
  registered_at: string | null;
  source: PokedexRegistrationSource;
  source_instance_id: string | null;
  level: PokedexRegistrationLevel;
}

const FACET_ORDER = [
  'variant',
  'size',
  'background',
  'lucky',
  'purified',
  'gender',
  'appraisal',
  'ball',
] as const;

function toSlug(value: unknown): string {
  return String(value ?? 'none')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'none';
}

function facetSortKey(key: string): string {
  const index = FACET_ORDER.indexOf(key as (typeof FACET_ORDER)[number]);
  return index === -1 ? `z-${key}` : String(index).padStart(2, '0');
}

function normalizeFacets(facets: PokedexRegistrationFacets): PokedexRegistrationFacets {
  return Object.fromEntries(
    Object.entries(facets)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .sort(([left], [right]) => facetSortKey(left).localeCompare(facetSortKey(right))),
  );
}

export function buildPokedexRegistrationId(input: {
  pokemon_id: number;
  form?: string | null;
  facets: PokedexRegistrationFacets;
}): string {
  const normalizedFacets = normalizeFacets(input.facets);
  const facetSegments = Object.entries(normalizedFacets).map(
    ([key, value]) => `${toSlug(key)}:${toSlug(value)}`,
  );

  return [
    `species:${input.pokemon_id}`,
    `form:${toSlug(input.form || 'normal')}`,
    ...facetSegments,
  ].join('|');
}

function createRegistrationEntry(input: {
  variant: PokemonVariant;
  facets: PokedexRegistrationFacets;
  isRegistered: boolean;
  registeredAt: string | null;
  source: PokedexRegistrationSource;
  sourceInstanceId: string | null;
  level: PokedexRegistrationLevel;
}): PokedexRegistrationEntry {
  const facets = normalizeFacets(input.facets);

  return {
    registration_id: buildPokedexRegistrationId({
      pokemon_id: input.variant.pokemon_id,
      form: input.variant.form,
      facets,
    }),
    pokemon_id: input.variant.pokemon_id,
    pokedex_number:
      typeof input.variant.pokedex_number === 'number' ? input.variant.pokedex_number : null,
    base_variant_id: input.variant.variant_id,
    species_name: input.variant.species_name || input.variant.name,
    form: input.variant.form ?? null,
    variant_type: input.variant.variantType,
    facets,
    is_registered: input.isRegistered,
    registered_at: input.registeredAt,
    source: input.source,
    source_instance_id: input.sourceInstanceId,
    level: input.level,
  };
}

export function projectCatalogRegistration(variant: PokemonVariant): PokedexRegistrationEntry {
  return createRegistrationEntry({
    variant,
    facets: { variant: variant.variantType },
    isRegistered: false,
    registeredAt: null,
    source: 'catalog',
    sourceInstanceId: null,
    level: 'base',
  });
}

export function createManualPokedexRegistration(
  variant: PokemonVariant,
  facets: PokedexRegistrationFacets = {},
  registeredAt = new Date().toISOString(),
): PokedexRegistrationEntry {
  return createRegistrationEntry({
    variant,
    facets: { variant: variant.variantType, ...facets },
    isRegistered: true,
    registeredAt,
    source: 'manual',
    sourceInstanceId: null,
    level: 'exact',
  });
}

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseFusionId(value: unknown): number | null {
  const direct = asFiniteNumber(value);
  if (direct !== null) return direct;

  const normalized = normalizeToken(value);
  if (!normalized) return null;

  const match = normalized.match(/(?:^|\s)fusion\s*(\d+)$/) ?? normalized.match(/(?:^|\s)(\d+)$/);
  return match ? asFiniteNumber(match[1]) : null;
}

function parseFusionIdsFromStoredObject(value: unknown): number[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        typeof entry === 'object' && entry !== null
          ? parseFusionId((entry as { fusion_id?: unknown; id?: unknown }).fusion_id) ??
            parseFusionId((entry as { id?: unknown }).id)
          : parseFusionId(entry),
      )
      .filter((id): id is number => id !== null);
  }

  if (typeof value !== 'object') {
    const parsed = parseFusionId(value);
    return parsed === null ? [] : [parsed];
  }

  const record = value as Record<string, unknown>;
  const explicit = parseFusionId(record.fusion_id) ?? parseFusionId(record.id);
  const keyIds = Object.entries(record)
    .filter(([, isSelected]) => isSelected !== false && isSelected !== null && isSelected !== undefined)
    .map(([key]) => parseFusionId(key))
    .filter((id): id is number => id !== null);

  return explicit === null ? keyIds : [explicit, ...keyIds];
}

function isShinyRegistrationInstance(
  variant: PokemonVariant,
  instance: PokemonInstance,
): boolean {
  return Boolean(instance.shiny) || variant.variantType.toLowerCase().includes('shiny');
}

function isFusionVariantType(variantType: string): boolean {
  return variantType.toLowerCase().includes('fusion');
}

function isMegaVariantType(variantType: string): boolean {
  const normalized = variantType.toLowerCase();
  return (
    normalized === 'primal' ||
    normalized === 'shiny_primal' ||
    normalized.startsWith('mega') ||
    normalized.startsWith('shiny_mega')
  );
}

interface RegistrationVariantIndex {
  byId: Map<string, PokemonVariant>;
  byPokemon: Map<number, PokemonVariant[]>;
  byPokemonAndType: Map<number, Map<string, PokemonVariant[]>>;
}

function buildRegistrationVariantIndex(
  variants: PokemonVariant[],
): RegistrationVariantIndex {
  const byId = new Map<string, PokemonVariant>();
  const byPokemon = new Map<number, PokemonVariant[]>();
  const byPokemonAndType = new Map<number, Map<string, PokemonVariant[]>>();

  for (const variant of variants) {
    byId.set(variant.variant_id, variant);
    const pokemonVariants = byPokemon.get(variant.pokemon_id) ?? [];
    pokemonVariants.push(variant);
    byPokemon.set(variant.pokemon_id, pokemonVariants);

    const variantsByType = byPokemonAndType.get(variant.pokemon_id) ?? new Map();
    const normalizedType = variant.variantType.toLowerCase();
    const matchingType = variantsByType.get(normalizedType) ?? [];
    matchingType.push(variant);
    variantsByType.set(normalizedType, matchingType);
    byPokemonAndType.set(variant.pokemon_id, variantsByType);
  }

  return { byId, byPokemon, byPokemonAndType };
}

function resolveFusionIdForInstance(
  variant: PokemonVariant,
  instance: PokemonInstance,
): number | null {
  const entries = Array.isArray(variant.fusion) ? variant.fusion : [];
  const directId = parseFusionId(instance.fusion_form);
  if (directId !== null) return directId;

  const normalizedFusionForm = normalizeToken(instance.fusion_form);
  if (normalizedFusionForm) {
    const byName = entries.find((entry) => normalizeToken(entry.name) === normalizedFusionForm);
    if (typeof byName?.fusion_id === 'number') return byName.fusion_id;
  }

  const storedIds = parseFusionIdsFromStoredObject(instance.fusion);
  for (const id of storedIds) {
    if (entries.length === 0 || entries.some((entry) => entry.fusion_id === id)) return id;
  }

  if (entries.length === 1 && typeof entries[0].fusion_id === 'number') {
    return entries[0].fusion_id;
  }

  return null;
}

function resolveFusionRegistrationVariant(
  variantIndex: RegistrationVariantIndex,
  variant: PokemonVariant,
  instance: PokemonInstance,
): PokemonVariant | null {
  if (!instance.is_fused) return null;
  if (isFusionVariantType(variant.variantType)) return variant;

  const fusionId = resolveFusionIdForInstance(variant, instance);
  if (fusionId === null) return null;

  const wantsShiny = isShinyRegistrationInstance(variant, instance);
  const preferredVariantType = `${wantsShiny ? 'shiny_' : ''}fusion_${fusionId}`;
  const fallbackVariantType = `${wantsShiny ? '' : 'shiny_'}fusion_${fusionId}`;

  return (
    variantIndex.byPokemonAndType.get(variant.pokemon_id)?.get(preferredVariantType)?.[0] ??
    variantIndex.byPokemonAndType.get(variant.pokemon_id)?.get(fallbackVariantType)?.[0] ??
    null
  );
}

function resolveMegaRegistrationVariant(
  variantIndex: RegistrationVariantIndex,
  variant: PokemonVariant,
  instance: PokemonInstance,
): PokemonVariant | null {
  if (!instance.is_mega && !instance.mega) return null;
  if (isMegaVariantType(variant.variantType)) return variant;

  const candidates = (variantIndex.byPokemon.get(variant.pokemon_id) ?? [])
    .filter((candidate) => isMegaVariantType(candidate.variantType));
  if (candidates.length === 0) return null;

  const requestedForm = normalizeToken(instance.mega_form);
  const formMatches = requestedForm
    ? candidates.filter((candidate) => normalizeToken(candidate.megaForm) === requestedForm)
    : candidates.filter((candidate) => normalizeToken(candidate.megaForm) === '');
  const scopedCandidates = formMatches.length > 0 ? formMatches : candidates;
  const wantsShiny = isShinyRegistrationInstance(variant, instance);

  return (
    scopedCandidates.find((candidate) =>
      wantsShiny
        ? candidate.variantType.toLowerCase().startsWith('shiny_')
        : !candidate.variantType.toLowerCase().startsWith('shiny_'),
    ) ??
    scopedCandidates[0] ??
    null
  );
}

interface ResolvedRegistrationVariant {
  variant: PokemonVariant;
  derived: boolean;
}

function getParentVariantTypes(variantType: string): string[] {
  const normalized = variantType.toLowerCase();
  const parents = new Set<string>();
  const add = (parent: string) => {
    if (parent !== normalized) parents.add(parent);
  };

  if (normalized === 'default') return [];

  const shinyFusionMatch = normalized.match(/^shiny_fusion_(.+)$/);
  if (shinyFusionMatch) {
    add(`fusion_${shinyFusionMatch[1]}`);
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  if (normalized.startsWith('fusion_')) {
    add('default');
    return Array.from(parents);
  }

  const shinyMegaMatch = normalized.match(/^shiny_mega(.+)$/);
  if (shinyMegaMatch) {
    add(`mega${shinyMegaMatch[1]}`);
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  if (normalized.startsWith('mega')) {
    add('default');
    return Array.from(parents);
  }

  const shinyCostumeMatch = normalized.match(/^costume_(.+)_shiny$/);
  if (shinyCostumeMatch) {
    add(`costume_${shinyCostumeMatch[1]}`);
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  const shadowCostumeMatch = normalized.match(/^shadow_costume_(.+)$/);
  if (shadowCostumeMatch) {
    add(`costume_${shadowCostumeMatch[1]}`);
    add('shadow');
    add('default');
    return Array.from(parents);
  }

  const shinyShadowCostumeMatch = normalized.match(
    /^shiny_shadow_costume_(.+)$/,
  );
  if (shinyShadowCostumeMatch) {
    add(`shadow_costume_${shinyShadowCostumeMatch[1]}`);
    add(`costume_${shinyShadowCostumeMatch[1]}_shiny`);
    add(`costume_${shinyShadowCostumeMatch[1]}`);
    add('shiny_shadow');
    add('shadow');
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  if (normalized.startsWith('costume_')) {
    add('default');
    return Array.from(parents);
  }

  if (normalized === 'shiny_shadow') {
    add('shadow');
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  if (normalized === 'shiny_primal') {
    add('primal');
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  if (normalized === 'shiny_dynamax') {
    add('dynamax');
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  if (normalized === 'shiny_gigantamax') {
    add('gigantamax');
    add('shiny');
    add('default');
    return Array.from(parents);
  }

  if (normalized === 'shiny') {
    add('default');
    return Array.from(parents);
  }

  if (
    normalized === 'shadow' ||
    normalized === 'primal' ||
    normalized === 'dynamax' ||
    normalized === 'gigantamax'
  ) {
    add('default');
  }

  return Array.from(parents);
}

function findRelatedVariantByType(
  variantIndex: RegistrationVariantIndex,
  variant: PokemonVariant,
  variantType: string,
): PokemonVariant | null {
  const candidates = variantIndex.byPokemonAndType
    .get(variant.pokemon_id)
    ?.get(variantType) ?? [];

  if (candidates.length === 0) return null;

  const normalizedForm = normalizeToken(variant.form);
  if (normalizedForm) {
    const formMatch = candidates.find(
      (candidate) => normalizeToken(candidate.form) === normalizedForm,
    );
    if (formMatch) return formMatch;
  }

  return candidates[0] ?? null;
}

function collectParentRegistrationVariants(
  variantIndex: RegistrationVariantIndex,
  variant: PokemonVariant,
): ResolvedRegistrationVariant[] {
  return getParentVariantTypes(variant.variantType)
    .map((variantType) => findRelatedVariantByType(variantIndex, variant, variantType))
    .filter((parent): parent is PokemonVariant => parent !== null)
    .map((parent) => ({ variant: parent, derived: true }));
}

function createDerivedManualRegistration(
  parentVariant: PokemonVariant,
  entry: PokedexRegistrationEntry,
): PokedexRegistrationEntry {
  const remainingFacets = { ...entry.facets };
  delete remainingFacets.variant;

  return createRegistrationEntry({
    variant: parentVariant,
    facets: { variant: parentVariant.variantType, ...remainingFacets },
    isRegistered: entry.is_registered,
    registeredAt: entry.registered_at,
    source: 'manual',
    sourceInstanceId: null,
    level: 'derived',
  });
}

function projectManualRegistrationParents(
  variantIndex: RegistrationVariantIndex,
  entry: PokedexRegistrationEntry,
): PokedexRegistrationEntry[] {
  const variant =
    variantIndex.byId.get(entry.base_variant_id) ??
    (variantIndex.byPokemon.get(entry.pokemon_id) ?? []).find(
      (candidate) =>
        candidate.variantType.toLowerCase() === entry.variant_type.toLowerCase(),
    );

  if (!variant) return [];

  return collectParentRegistrationVariants(variantIndex, variant).map((parentVariant) =>
    createDerivedManualRegistration(parentVariant.variant, entry),
  );
}

function addResolvedVariant(
  resolved: Map<string, ResolvedRegistrationVariant>,
  variant: PokemonVariant,
  derived: boolean,
) {
  const current = resolved.get(variant.variant_id);
  if (!current || (current.derived && !derived)) {
    resolved.set(variant.variant_id, { variant, derived });
  }
}

function resolveRegistrationVariantsForInstance(
  variantIndex: RegistrationVariantIndex,
  variant: PokemonVariant,
  instance: PokemonInstance,
): ResolvedRegistrationVariant[] {
  const resolved = new Map<string, ResolvedRegistrationVariant>();
  addResolvedVariant(resolved, variant, false);

  const specialVariant =
    resolveFusionRegistrationVariant(variantIndex, variant, instance) ??
    resolveMegaRegistrationVariant(variantIndex, variant, instance);

  if (specialVariant) {
    addResolvedVariant(resolved, specialVariant, false);
  }

  for (const directVariant of Array.from(resolved.values())) {
    for (const parentVariant of collectParentRegistrationVariants(
      variantIndex,
      directVariant.variant,
    )) {
      addResolvedVariant(resolved, parentVariant.variant, true);
    }
  }

  return Array.from(resolved.values());
}

function classifyAgainstThresholds(
  value: number,
  thresholds: {
    xxs: number;
    xs: number;
    xl: number;
    xxl: number;
  },
): PokedexSizeClass {
  if (value <= thresholds.xxs) return 'xxs';
  if (value <= thresholds.xs) return 'xs';
  if (value >= thresholds.xxl) return 'xxl';
  if (value >= thresholds.xl) return 'xl';
  return 'normal';
}

export function deriveInstanceSizeClass(
  variant: PokemonVariant,
  instance: PokemonInstance,
): PokedexSizeClass | null {
  const sizeData = variant.sizes;
  if (!sizeData) return null;

  const height = asFiniteNumber(instance.height);
  if (height !== null) {
    return classifyAgainstThresholds(height, {
      xxs: sizeData.height_xxs_threshold,
      xs: sizeData.height_xs_threshold,
      xl: sizeData.height_xl_threshold,
      xxl: sizeData.height_xxl_threshold,
    });
  }

  const weight = asFiniteNumber(instance.weight);
  if (weight !== null) {
    return classifyAgainstThresholds(weight, {
      xxs: sizeData.weight_xxs_threshold,
      xs: sizeData.weight_xs_threshold,
      xl: sizeData.weight_xl_threshold,
      xxl: sizeData.weight_xxl_threshold,
    });
  }

  return null;
}

export function deriveAppraisalFacet(instance: PokemonInstance): string | null {
  const attack = asFiniteNumber(instance.attack_iv);
  const defense = asFiniteNumber(instance.defense_iv);
  const stamina = asFiniteNumber(instance.stamina_iv);
  if (attack === null || defense === null || stamina === null) return null;

  const total = attack + defense + stamina;
  if (total >= 45) return '4-star';
  if (total >= 37) return '3-star';
  if (total >= 30) return '2-star';
  if (total >= 23) return '1-star';
  return '0-star';
}

function isRegistrationSource(instance: PokemonInstance): boolean {
  return Boolean(instance.registered || instance.is_caught || instance.is_for_trade);
}

function getRegisteredAt(instance: PokemonInstance): string | null {
  return instance.date_caught || instance.date_added || null;
}

function getQualityFacets(
  variant: PokemonVariant,
  instance: PokemonInstance,
): PokedexRegistrationFacets {
  const facets: PokedexRegistrationFacets = {};
  const sizeClass = deriveInstanceSizeClass(variant, instance);
  const appraisal = deriveAppraisalFacet(instance);

  if (sizeClass) facets.size = sizeClass;
  if (instance.location_card) facets.background = instance.location_card;
  if (instance.lucky) facets.lucky = true;
  if (instance.purified) facets.purified = true;
  if (instance.gender) facets.gender = instance.gender;
  if (appraisal) facets.appraisal = appraisal;
  if (instance.pokeball) facets.ball = instance.pokeball;

  return facets;
}

function buildFacetSubsets(facets: PokedexRegistrationFacets): PokedexRegistrationFacets[] {
  const entries = Object.entries(normalizeFacets(facets));
  const subsets: PokedexRegistrationFacets[] = [];

  const visit = (index: number, current: PokedexRegistrationFacets) => {
    if (index >= entries.length) {
      if (Object.keys(current).length > 0) {
        subsets.push(current);
      }
      return;
    }

    visit(index + 1, current);
    const [key, value] = entries[index];
    visit(index + 1, { ...current, [key]: value });
  };

  visit(0, {});
  return subsets;
}

export function projectInstanceRegistrations(
  variant: PokemonVariant,
  instance: PokemonInstance,
  options: { includeFacetSubsets?: boolean } = {},
): PokedexRegistrationEntry[] {
  if (!isRegistrationSource(instance)) return [];

  const registeredAt = getRegisteredAt(instance);
  const sourceInstanceId = instance.instance_id ?? null;
  const qualityFacets = getQualityFacets(variant, instance);
  const qualityFacetCount = Object.keys(qualityFacets).length;
  const entries: PokedexRegistrationEntry[] = [
    createRegistrationEntry({
      variant,
      facets: { variant: variant.variantType },
      isRegistered: true,
      registeredAt,
      source: 'instance',
      sourceInstanceId,
      level: qualityFacetCount === 0 ? 'exact' : 'base',
    }),
  ];

  if (qualityFacetCount > 0 && options.includeFacetSubsets === false) {
    entries.push(
      createRegistrationEntry({
        variant,
        facets: { variant: variant.variantType, ...qualityFacets },
        isRegistered: true,
        registeredAt,
        source: 'instance',
        sourceInstanceId,
        level: 'exact',
      }),
    );
    return entries;
  }

  for (const subset of buildFacetSubsets(qualityFacets)) {
    const subsetCount = Object.keys(subset).length;
    entries.push(
      createRegistrationEntry({
        variant,
        facets: { variant: variant.variantType, ...subset },
        isRegistered: true,
        registeredAt,
        source: 'instance',
        sourceInstanceId,
        level: subsetCount === qualityFacetCount ? 'exact' : 'derived',
      }),
    );
  }

  return entries;
}

function mergeRegistrationEntries(
  current: PokedexRegistrationEntry,
  next: PokedexRegistrationEntry,
): PokedexRegistrationEntry {
  const isRegistered = current.is_registered || next.is_registered;
  const currentIsRegistered = current.is_registered;
  const nextIsRegistered = next.is_registered;
  const sourcePriority: Record<PokedexRegistrationSource, number> = {
    catalog: 0,
    manual: 1,
    instance: 2,
  };
  const authoritative =
    sourcePriority[next.source] > sourcePriority[current.source] ? next : current;

  return {
    ...current,
    is_registered: isRegistered,
    registered_at:
      currentIsRegistered && current.registered_at
        ? current.registered_at
        : nextIsRegistered
        ? next.registered_at
        : current.registered_at,
    source: authoritative.source,
    source_instance_id:
      current.source_instance_id ?? next.source_instance_id ?? null,
    level: current.level === 'base' ? next.level : current.level,
  };
}

export function projectPokedexRegistrations(
  variants: PokemonVariant[],
  instances: Instances = {},
  manualRegistrations: PokedexRegistrationEntry[] = [],
  options: {
    includeCatalogRegistrations?: boolean;
    includeFacetSubsets?: boolean;
  } = {},
): PokedexRegistrationEntry[] {
  const byId = new Map<string, PokedexRegistrationEntry>();
  const variantIndex = buildRegistrationVariantIndex(variants);

  if (options.includeCatalogRegistrations !== false) {
    for (const variant of variants) {
      const entry = projectCatalogRegistration(variant);
      byId.set(entry.registration_id, entry);
    }
  }

  for (const entry of manualRegistrations) {
    for (const projectedEntry of [
      entry,
      ...projectManualRegistrationParents(variantIndex, entry),
    ]) {
      const current = byId.get(projectedEntry.registration_id);
      byId.set(
        projectedEntry.registration_id,
        current ? mergeRegistrationEntries(current, projectedEntry) : projectedEntry,
      );
    }
  }

  for (const instance of Object.values(instances)) {
    if (!instance) continue;
    const variant = variantIndex.byId.get(instance.variant_id);
    if (!variant) continue;

    for (const registrationVariant of resolveRegistrationVariantsForInstance(
      variantIndex,
      variant,
      instance,
    )) {
      for (const entry of projectInstanceRegistrations(
        registrationVariant.variant,
        instance,
        { includeFacetSubsets: options.includeFacetSubsets },
      )) {
        const projectedEntry = registrationVariant.derived
          ? ({ ...entry, level: 'derived' } satisfies PokedexRegistrationEntry)
          : entry;
        const current = byId.get(projectedEntry.registration_id);
        byId.set(
          projectedEntry.registration_id,
          current ? mergeRegistrationEntries(current, projectedEntry) : projectedEntry,
        );
      }
    }
  }

  return Array.from(byId.values());
}
