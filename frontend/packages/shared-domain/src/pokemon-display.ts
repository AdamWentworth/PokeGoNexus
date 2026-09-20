import type {
  BasePokemon,
  Costume,
  CrownForm,
  Fusion,
  MegaEvolution,
} from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';

/**
 * Canonical, renderer-independent Pokémon presentation decisions.
 *
 * Web and native must consume these helpers instead of independently deciding
 * which form is active or how type assets are addressed. Keeping the rules in
 * this package prevents the two collection UIs from silently drifting.
 */
export const normalizePokemonFormToken = (
  value: string | null | undefined,
): string => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

export const buildPokemonTypeIconPath = (
  typeName?: string | null,
): string | undefined => {
  const normalized = typeof typeName === 'string' ? typeName.trim().toLowerCase() : '';
  return normalized ? `/images/types/${normalized}.png` : undefined;
};

export const normalizePokemonTypeName = (
  value: string | null | undefined,
): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const parsePokemonFusionId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const resolvePokemonActiveMegaEvolution = ({
  isMega,
  megaForm,
  megaEvolutions,
}: {
  isMega: boolean;
  megaForm?: string | null;
  megaEvolutions?: MegaEvolution[] | null;
}): MegaEvolution | undefined => {
  if (!isMega || !Array.isArray(megaEvolutions) || megaEvolutions.length === 0) {
    return undefined;
  }
  const normalizedForm = normalizePokemonFormToken(megaForm);
  if (!normalizedForm) {
    return megaEvolutions.find(
      (entry) => normalizePokemonFormToken(entry.form) === '',
    ) ?? megaEvolutions[0];
  }
  return megaEvolutions.find(
    (entry) => normalizePokemonFormToken(entry.form) === normalizedForm,
  ) ?? megaEvolutions[0];
};

export const resolvePokemonActiveFusionEntry = ({
  isFused,
  fusionForm,
  fusionEntries,
  storedFusion,
}: {
  isFused?: boolean;
  fusionForm?: string | null;
  fusionEntries?: Fusion[] | null;
  storedFusion?: Record<string, unknown> | null;
}): Fusion | undefined => {
  if (!isFused || !Array.isArray(fusionEntries) || fusionEntries.length === 0) {
    return undefined;
  }
  const explicitId = parsePokemonFusionId(fusionForm)
    ?? parsePokemonFusionId(String(fusionForm ?? '').match(/^(?:shiny[_\s-]?)?fusion[_\s-]?(\d+)$/i)?.[1]);
  const byId = fusionEntries.find((entry) => entry.fusion_id === explicitId);
  if (byId) return byId;
  const normalizedForm = normalizePokemonFormToken(fusionForm);
  if (normalizedForm) {
    const byName = fusionEntries.find(
      (entry) => normalizePokemonFormToken(entry.name) === normalizedForm,
    );
    if (byName) return byName;
  }
  const storedId = parsePokemonFusionId(storedFusion?.fusion_id)
    ?? parsePokemonFusionId(storedFusion?.id);
  const storedIds = [storedId, ...Object.entries(storedFusion ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([id]) => parsePokemonFusionId(id))];
  for (const id of storedIds) {
    const stored = fusionEntries.find((entry) => entry.fusion_id === id);
    if (stored) return stored;
  }
  return fusionEntries.length === 1 ? fusionEntries[0] : undefined;
};

export const getPokemonCrownFormLabel = (
  form?: CrownForm | null,
): string | null => {
  if (!form) return null;
  const display = typeof form.display_form === 'string' ? form.display_form.trim() : '';
  if (display) return display;
  const fallback = typeof form.form === 'string' ? form.form.trim() : '';
  return fallback || null;
};

export const resolvePokemonActiveCrownForm = (
  crownForms: CrownForm[] | null | undefined,
  crownFormLabel: string | null | undefined,
): CrownForm | undefined => {
  if (!Array.isArray(crownForms) || crownForms.length === 0) return undefined;
  const normalizedLabel = normalizePokemonFormToken(crownFormLabel);
  if (!normalizedLabel) return crownForms[0];
  return crownForms.find((entry) => (
    normalizePokemonFormToken(getPokemonCrownFormLabel(entry)) === normalizedLabel
  )) ?? crownForms[0];
};

const firstPokemonImage = (
  ...values: Array<string | null | undefined>
): string | null => values.find((value): value is string => Boolean(value?.trim())) ?? null;

const resolveCostumeImage = ({
  costume,
  female,
  shadow,
  shiny,
}: {
  costume: Costume | null | undefined;
  female: boolean;
  shadow: boolean;
  shiny: boolean;
}): string | null => {
  if (!costume) return null;
  if (shadow && costume.shadow_costume) {
    return shiny
      ? firstPokemonImage(
        female ? costume.shadow_costume.image_url_female_shiny_shadow_costume : null,
        costume.shadow_costume.image_url_shiny_shadow_costume,
      )
      : firstPokemonImage(
        female ? costume.shadow_costume.image_url_female_shadow_costume : null,
        costume.shadow_costume.image_url_shadow_costume,
      );
  }
  return shiny
    ? firstPokemonImage(
      female ? costume.image_url_shiny_female : null,
      costume.image_url_shiny,
    )
    : firstPokemonImage(female ? costume.image_url_female : null, costume.image_url);
};

export type PokemonInstanceArtworkSource = Pick<
  BasePokemon,
  | 'pokemon_id'
  | 'image_url'
  | 'image_url_shadow'
  | 'image_url_shiny'
  | 'image_url_shiny_shadow'
> & Partial<Pick<
  BasePokemon,
  | 'costumes'
  | 'crownForms'
  | 'female_data'
  | 'fusion'
  | 'max'
  | 'megaEvolutions'
>>;

/** Resolve the canonical artwork for an owned collection instance. */
export const resolvePokemonInstanceImagePath = (
  instance: Partial<PokemonInstance>,
  pokemon: PokemonInstanceArtworkSource,
  fallbackImage?: string | null,
): string => {
  if (instance.disabled) return `/images/disabled/disabled_${pokemon.pokemon_id}.png`;

  const shiny = Boolean(instance.shiny);
  const female = instance.gender?.toLowerCase() === 'female';
  const purified = Boolean(instance.purified);
  const baseFallback = firstPokemonImage(fallbackImage, pokemon.image_url)
    ?? '/images/default_pokemon.png';

  // Apex shadow Pokémon keep their shadow artwork until explicitly purified.
  if ((pokemon.pokemon_id === 2301 || pokemon.pokemon_id === 2302) && !purified) {
    return firstPokemonImage(pokemon.image_url_shadow, baseFallback) ?? baseFallback;
  }

  const mega = resolvePokemonActiveMegaEvolution({
    // `mega` records that this specimen has registered a Mega evolution;
    // only `is_mega` means that form is active right now.
    isMega: Boolean(instance.is_mega),
    megaForm: instance.mega_form,
    megaEvolutions: pokemon.megaEvolutions,
  });
  if (mega) {
    const megaCostume = instance.costume_id == null
      ? null
      : mega.costumes?.find((entry) => entry.costume_id === instance.costume_id);
    const costumeImage = resolveCostumeImage({
      costume: megaCostume,
      female,
      shadow: Boolean(instance.shadow),
      shiny,
    });
    if (costumeImage) return costumeImage;
    const femaleData = female ? mega.female_data : null;
    return firstPokemonImage(
      shiny ? femaleData?.shiny_image_url : null,
      femaleData?.image_url,
      shiny ? mega.image_url_shiny : null,
      mega.image_url,
      baseFallback,
    ) ?? baseFallback;
  }

  const crown = instance.crown
    ? resolvePokemonActiveCrownForm(pokemon.crownForms, instance.fusion_form)
    : undefined;
  if (crown) {
    return firstPokemonImage(
      shiny ? crown.image_url_shiny : null,
      crown.image_url,
      baseFallback,
    ) ?? baseFallback;
  }

  const fusion = resolvePokemonActiveFusionEntry({
    isFused: instance.is_fused,
    fusionForm: instance.fusion_form,
    fusionEntries: pokemon.fusion,
    storedFusion: instance.fusion,
  });
  if (fusion) {
    return firstPokemonImage(
      shiny ? fusion.image_url_shiny : null,
      fusion.image_url,
      baseFallback,
    ) ?? baseFallback;
  }

  if (instance.gigantamax) {
    const maxForm = pokemon.max?.find((entry) => Boolean(entry.gigantamax));
    return firstPokemonImage(
      shiny ? maxForm?.shiny_gigantamax_image_url : null,
      maxForm?.gigantamax_image_url,
      shiny ? pokemon.image_url_shiny : null,
      baseFallback,
    ) ?? baseFallback;
  }

  // Purification removes the shadow artwork while preserving shiny state.
  if (purified) {
    return firstPokemonImage(
      shiny ? pokemon.image_url_shiny : null,
      baseFallback,
    ) ?? baseFallback;
  }

  const costume = instance.costume_id == null
    ? null
    : pokemon.costumes?.find((entry) => entry.costume_id === instance.costume_id);
  const costumeImage = resolveCostumeImage({
    costume,
    female,
    shadow: Boolean(instance.shadow),
    shiny,
  });
  if (costumeImage) return costumeImage;

  const femaleData = female ? pokemon.female_data : null;
  if (instance.shadow) {
    return firstPokemonImage(
      shiny ? femaleData?.shiny_shadow_image_url : null,
      shiny ? pokemon.image_url_shiny_shadow : null,
      femaleData?.shadow_image_url,
      pokemon.image_url_shadow,
      baseFallback,
    ) ?? baseFallback;
  }
  return firstPokemonImage(
    shiny ? femaleData?.shiny_image_url : null,
    shiny ? pokemon.image_url_shiny : null,
    femaleData?.image_url,
    baseFallback,
  ) ?? baseFallback;
};
