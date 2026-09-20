import { resolveFusionMovePool } from "../../../features/pokemonDisplay/fusionMovePool";
import {
  normalizeFormToken,
  resolvePokemonDisplayActiveMegaEvolution,
} from "../../../features/pokemonDisplay/displayHelpers";
import { resolveCrownMovePool } from "../../../features/pokemonDisplay/crownMovePool";
import type { PokemonInstance } from "../../../types/pokemonInstance";
import type { CrownForm } from "../../../types/pokemonSubTypes";
import type { PokemonVariant } from "../../../types/pokemonVariants";
import { getCrownFormLabel, resolveActiveCrownForm } from "../../../utils/crownHelpers";

export type RaidRosterFormSource = "base" | "fusion" | "crown" | "mega";

export type RaidRosterFormProjection = {
  variant: PokemonVariant;
  formSource: RaidRosterFormSource;
  useRecordedCp: boolean;
  formPokemonId?: number;
};

const isShiny = (variant: PokemonVariant, instance: PokemonInstance): boolean =>
  Boolean(instance.shiny) || variant.variantType.toLowerCase().includes("shiny");

const isShadow = (variant: PokemonVariant, instance: PokemonInstance): boolean =>
  Boolean(instance.shadow) || variant.variantType.toLowerCase().includes("shadow");

const isMegaVariant = (variant: PokemonVariant): boolean => {
  const variantType = variant.variantType.toLowerCase();
  return (
    variantType === "primal" ||
    variantType === "shiny_primal" ||
    variantType.startsWith("mega") ||
    variantType.startsWith("shiny_mega")
  );
};

const matchesShinyState = (
  variant: PokemonVariant,
  wantsShiny: boolean,
): boolean =>
  variant.variantType.toLowerCase().includes("shiny") === wantsShiny;

const resolveFusionProjection = (
  variants: PokemonVariant[],
  base: PokemonVariant,
  instance: PokemonInstance,
): RaidRosterFormProjection | null => {
  const movePool = resolveFusionMovePool({
    pokemon: base,
    fusion: {
      is_fused: instance.is_fused,
      fusion_form: instance.fusion_form,
      storedFusionObject: instance.fusion,
    },
  });
  if (movePool.fusionId == null) return null;

  const wantsShiny = isShiny(base, instance);
  const candidates = variants.filter(
    (variant) =>
      variant.pokemon_id === base.pokemon_id &&
      variant.fusion_id === movePool.fusionId &&
      variant.variantType.toLowerCase().includes("fusion"),
  );
  const selected =
    candidates.find((variant) => matchesShinyState(variant, wantsShiny)) ??
    candidates[0];
  if (!selected) return null;

  return {
    variant: {
      ...selected,
      moves: movePool.moves.length > 0 ? movePool.moves : selected.moves,
    },
    formSource: "fusion",
    useRecordedCp: true,
  };
};

const getCrownFormName = (
  base: PokemonVariant,
  crown: CrownForm,
): string => {
  const label = getCrownFormLabel(crown);
  const species = base.species_name || base.name;
  return label ? `${label} ${species}` : species;
};

const resolveCrownProjection = (
  variants: PokemonVariant[],
  base: PokemonVariant,
  instance: PokemonInstance,
): RaidRosterFormProjection => {
  const crownFormLabel =
    typeof instance.crown_form === "string" ? instance.crown_form : null;
  const selected = resolveActiveCrownForm(base.crownForms, crownFormLabel);

  // Some catalog rows, including the current Crowned Sword and Crowned Shield
  // records, are already modeled as their battle form at the top level.
  if (!selected) {
    return { variant: base, formSource: "crown", useRecordedCp: true };
  }

  const related = variants.find(
    (variant) =>
      variant.pokemon_id === selected.crown_pokemon_id &&
      variant.variantType === "default",
  );
  const crownMoves = resolveCrownMovePool({
    pokemon: base,
    baseMoves: base.moves ?? [],
    crown: { is_crown: true, crown_form: crownFormLabel },
  }).moves;
  const source = related ?? base;

  return {
    variant: {
      ...source,
      variant_id: `${base.variant_id}::crown::${selected.id}`,
      pokemon_id: base.pokemon_id,
      pokedex_number: base.pokedex_number,
      name: getCrownFormName(base, selected),
      species_name: getCrownFormName(base, selected),
      form: selected.form ?? selected.display_form,
      attack: selected.attack ?? source.attack,
      defense: selected.defense ?? source.defense,
      stamina: selected.stamina ?? source.stamina,
      type_1_id: selected.type_1_id,
      type_2_id: selected.type_2_id ?? source.type_2_id,
      type1_name: selected.type1_name ?? source.type1_name,
      type2_name: selected.type2_name ?? source.type2_name,
      currentImage:
        (isShiny(base, instance)
          ? selected.image_url_shiny ?? selected.image_url
          : selected.image_url) ?? source.currentImage,
      cp40: selected.cp40 ?? source.cp40,
      cp50: selected.cp50 ?? source.cp50,
      moves: crownMoves.length > 0 ? crownMoves : source.moves,
    },
    formSource: "crown",
    useRecordedCp: true,
    formPokemonId: selected.crown_pokemon_id,
  };
};

const isCurrentMegaProjection = (
  variant: PokemonVariant,
  instance: PokemonInstance,
  megaEvolutionCount: number,
): boolean => {
  if (!instance.is_mega) return false;
  if (megaEvolutionCount === 1) return true;
  return (
    normalizeFormToken(variant.megaForm) ===
    normalizeFormToken(instance.mega_form)
  );
};

const resolveMegaProjections = (
  variants: PokemonVariant[],
  base: PokemonVariant,
  instance: PokemonInstance,
): RaidRosterFormProjection[] => {
  if ((!instance.mega && !instance.is_mega) || isShadow(base, instance)) {
    return [];
  }

  const megaEvolutions = base.megaEvolutions ?? [];
  if (megaEvolutions.length === 0) return [];
  const wantsShiny = isShiny(base, instance);
  const selectedIds = new Set<string>();
  const projections: RaidRosterFormProjection[] = [];

  for (const megaEvolution of megaEvolutions) {
    const activeMega = resolvePokemonDisplayActiveMegaEvolution({
      isMega: true,
      megaForm: megaEvolution.form,
      megaEvolutions,
    });
    if (!activeMega) continue;

    const requestedForm = normalizeFormToken(activeMega.form);
    const candidates = variants.filter(
      (variant) =>
        variant.pokemon_id === base.pokemon_id &&
        isMegaVariant(variant) &&
        normalizeFormToken(variant.megaForm) === requestedForm,
    );
    const selected =
      candidates.find((variant) => matchesShinyState(variant, wantsShiny)) ??
      candidates[0];
    if (!selected || selectedIds.has(selected.variant_id)) continue;

    selectedIds.add(selected.variant_id);
    projections.push({
      variant: selected,
      formSource: "mega",
      useRecordedCp: isCurrentMegaProjection(
        selected,
        instance,
        megaEvolutions.length,
      ),
    });
  }

  return projections;
};

export const resolveRaidRosterFormProjections = (
  variants: PokemonVariant[],
  base: PokemonVariant,
  instance: PokemonInstance,
): RaidRosterFormProjection[] => {
  if (instance.is_fused) {
    const fusion = resolveFusionProjection(variants, base, instance);
    return fusion ? [fusion] : [];
  }

  if (instance.crown) {
    return [resolveCrownProjection(variants, base, instance)];
  }

  const baseProjection: RaidRosterFormProjection = {
    variant: base,
    formSource: "base",
    useRecordedCp: !instance.is_mega,
  };

  return [
    baseProjection,
    ...resolveMegaProjections(variants, base, instance),
  ];
};
