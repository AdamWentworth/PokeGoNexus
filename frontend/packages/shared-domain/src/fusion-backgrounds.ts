import type {
  Fusion,
  FusionBackgroundComboRule,
  VariantBackground,
} from '@pokemongonexus/shared-contracts/pokemon';

type FusionBackgroundState = {
  is_fused?: boolean;
  fusion_form?: string | null;
  storedFusionObject?: unknown;
};

type FusionBackgroundPokemon = {
  backgrounds?: VariantBackground[];
  fusion?: Fusion[];
  fusion_id?: number | null;
  variantType?: string;
};

type ResolveFusionBackgroundPoolParams = {
  pokemon: FusionBackgroundPokemon;
  fusion: FusionBackgroundState;
};

type FusionEntry = {
  fusion_id?: number | null;
  name?: string;
  base_pokemon_id1?: number;
  base_pokemon_id2?: number;
  backgrounds?: VariantBackground[];
  background_combo_rules?: FusionBackgroundComboRule[];
};

type ResolveFusionComboBackgroundParams = {
  pokemonId: number;
  fusionEntries: FusionEntry[] | null | undefined;
  resolvedFusionId: number | null;
  fusionForm: string | null | undefined;
  ownBackgroundId: number | null;
  partnerBackgroundId: number | null;
  availableBackgrounds: VariantBackground[];
};

export type FusionBackgroundSource = 'base' | 'fusion' | 'fusion_missing';

export type ResolveFusionBackgroundPoolResult = {
  backgrounds: VariantBackground[];
  source: FusionBackgroundSource;
  fusionId: number | null;
};

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeFusionToken = (value: unknown): string =>
  normalizeText(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const parseFusionId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/^(?:shiny[_\s-]?)?fusion[_\s-]?(\d+)$/i);
  return match ? Number(match[1]) : null;
};

const parseFusionIdFromVariantType = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = value.trim().toLowerCase().match(/(?:^|_)fusion_(\d+)$/);
  return match ? Number(match[1]) : null;
};

const parseFusionIdsFromStoredObject = (value: unknown): number[] => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, enabled]) => {
    if (!enabled) return [];
    const id = parseFusionId(key);
    return id == null ? [] : [id];
  });
};

const dedupeBackgrounds = (backgrounds: VariantBackground[]): VariantBackground[] => {
  const seen = new Set<string>();
  return backgrounds.filter((background) => {
    if (!background || typeof background.background_id !== 'number') return false;
    const costumeId = typeof background.costume_id === 'number'
      && Number.isFinite(background.costume_id)
      ? background.costume_id
      : 0;
    const key = `${background.background_id}:${costumeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const findFusionEntry = (
  fusionEntries: FusionEntry[],
  fusionState: FusionBackgroundState,
): FusionEntry | undefined => {
  const explicitId = parseFusionId(fusionState.fusion_form);
  if (explicitId != null) {
    const entry = fusionEntries.find((candidate) => candidate.fusion_id === explicitId);
    if (entry) return entry;
  }
  const normalizedName = normalizeFusionToken(fusionState.fusion_form);
  if (normalizedName) {
    const entry = fusionEntries.find(
      (candidate) => normalizeFusionToken(candidate.name) === normalizedName,
    );
    if (entry) return entry;
  }
  for (const id of parseFusionIdsFromStoredObject(fusionState.storedFusionObject)) {
    const entry = fusionEntries.find((candidate) => candidate.fusion_id === id);
    if (entry) return entry;
  }
  return fusionState.is_fused && fusionEntries.length === 1
    ? fusionEntries[0]
    : undefined;
};

export const resolvePokemonDisplayFusionBackgroundPool = ({
  pokemon,
  fusion,
}: ResolveFusionBackgroundPoolParams): ResolveFusionBackgroundPoolResult => {
  const baseBackgrounds = dedupeBackgrounds(
    Array.isArray(pokemon.backgrounds) ? pokemon.backgrounds : [],
  );
  if (!fusion.is_fused) {
    return { backgrounds: baseBackgrounds, source: 'base', fusionId: null };
  }
  const fusionEntries = Array.isArray(pokemon.fusion) ? pokemon.fusion : [];
  const idCandidates = Array.from(new Set([
    parseFusionId(fusion.fusion_form),
    ...parseFusionIdsFromStoredObject(fusion.storedFusionObject),
    typeof pokemon.fusion_id === 'number' ? pokemon.fusion_id : null,
    parseFusionIdFromVariantType(pokemon.variantType),
  ].filter((id): id is number => id != null)));
  const selectedFusion = findFusionEntry(fusionEntries, fusion)
    ?? idCandidates
      .map((id) => fusionEntries.find((entry) => entry.fusion_id === id))
      .find((entry) => entry != null);
  const selectedFusionId = typeof selectedFusion?.fusion_id === 'number'
    ? selectedFusion.fusion_id
    : idCandidates[0] ?? null;
  const fusionBackgrounds = dedupeBackgrounds(
    Array.isArray(selectedFusion?.backgrounds) ? selectedFusion.backgrounds : [],
  );
  if (fusionBackgrounds.length > 0) {
    return { backgrounds: fusionBackgrounds, source: 'fusion', fusionId: selectedFusionId };
  }
  const variantLooksLikeFusion = parseFusionIdFromVariantType(pokemon.variantType) != null
    || (typeof pokemon.fusion_id === 'number' && pokemon.fusion_id > 0);
  if (variantLooksLikeFusion && baseBackgrounds.length > 0) {
    return { backgrounds: baseBackgrounds, source: 'fusion', fusionId: selectedFusionId };
  }
  return { backgrounds: [], source: 'fusion_missing', fusionId: selectedFusionId };
};

const findFusionEntryForCombo = ({
  fusionEntries,
  resolvedFusionId,
  fusionForm,
}: {
  fusionEntries: FusionEntry[];
  resolvedFusionId: number | null;
  fusionForm: string | null | undefined;
}): FusionEntry | null => {
  const normalizedForm = normalizeFusionToken(fusionForm);
  if (normalizedForm) {
    const entry = fusionEntries.find(
      (candidate) => normalizeFusionToken(candidate.name) === normalizedForm,
    );
    if (entry) return entry;
  }
  if (resolvedFusionId != null) {
    const entry = fusionEntries.find((candidate) => candidate.fusion_id === resolvedFusionId);
    if (entry) return entry;
  }
  return fusionEntries.length === 1 ? fusionEntries[0] : null;
};

export const resolvePokemonDisplayFusionComboBackground = ({
  pokemonId,
  fusionEntries,
  resolvedFusionId,
  fusionForm,
  ownBackgroundId,
  partnerBackgroundId,
  availableBackgrounds,
}: ResolveFusionComboBackgroundParams): VariantBackground | null => {
  if (ownBackgroundId == null || partnerBackgroundId == null) return null;
  const entries = Array.isArray(fusionEntries) ? fusionEntries : [];
  const fusionEntry = findFusionEntryForCombo({
    fusionEntries: entries,
    resolvedFusionId,
    fusionForm,
  });
  if (!fusionEntry) return null;
  const matchingRule = (fusionEntry.background_combo_rules ?? []).find((rule) => {
    if (fusionEntry.base_pokemon_id1 === pokemonId) {
      return rule.member1_background_id === ownBackgroundId
        && rule.member2_background_id === partnerBackgroundId;
    }
    if (fusionEntry.base_pokemon_id2 === pokemonId) {
      return rule.member2_background_id === ownBackgroundId
        && rule.member1_background_id === partnerBackgroundId;
    }
    return (
      rule.member1_background_id === ownBackgroundId
      && rule.member2_background_id === partnerBackgroundId
    ) || (
      rule.member2_background_id === ownBackgroundId
      && rule.member1_background_id === partnerBackgroundId
    );
  });
  if (!matchingRule) return null;
  const existing = availableBackgrounds.find(
    (background) => background.background_id === matchingRule.combo_background_id,
  );
  if (existing) return existing;
  const imageUrl = matchingRule.combo_background_image_url?.trim();
  if (!imageUrl) return null;
  return {
    background_id: matchingRule.combo_background_id,
    image_url: imageUrl,
    name: matchingRule.combo_background_name ?? `Background ${matchingRule.combo_background_id}`,
    costume_id: 0,
    date: matchingRule.combo_background_date ?? '',
    location: matchingRule.combo_background_location ?? '',
  };
};
