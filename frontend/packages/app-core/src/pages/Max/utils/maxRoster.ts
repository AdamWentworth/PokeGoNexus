import type { InstancesMap, PokemonInstance } from '../../../types/pokemonInstance';
import type { PokemonVariant } from '../../../types/pokemonVariants';

import { isSpecialMaxAttacker } from '../../../features/max/specialMaxPokemon';
import { resolveRaidRosterFormProjections } from '../../Raid/utils/raidRosterForms';
import { getInstanceVariantResolver } from '@pokemongonexus/shared-domain/instance-variant';

export type MaxRosterScope = 'catalog' | 'owned';

export type MaxRosterSummary = {
  pokemon: PokemonVariant[];
  caughtCount: number;
  eligibleCount: number;
  incompleteEntryCount: number;
  unmappedCount: number;
};

const hasRecordedIvs = (instance: PokemonInstance): boolean =>
  [instance.attack_iv, instance.defense_iv, instance.stamina_iv].every(
    (value) => value != null && Number.isFinite(Number(value)),
  );

const hasUsableLevel = (instance: PokemonInstance): boolean => {
  const level = Number(instance.level);
  if (Number.isFinite(level) && level > 0) return true;

  const cp = Number(instance.cp);
  return Number.isFinite(cp) && cp > 0 && hasRecordedIvs(instance);
};

const isShiny = (variant: PokemonVariant, instance: PokemonInstance): boolean =>
  Boolean(instance.shiny) || variant.variantType.toLowerCase().includes('shiny');

const matchesShiny = (variant: PokemonVariant, shiny: boolean): boolean =>
  variant.variantType.toLowerCase().includes('shiny') === shiny;

const isMaxVariant = (variant: PokemonVariant): boolean => {
  const type = variant.variantType.toLowerCase();
  return type.includes('dynamax') || type.includes('gigantamax');
};

const resolveMaxVariant = (
  variants: PokemonVariant[],
  base: PokemonVariant,
  instance: PokemonInstance,
): PokemonVariant | null => {
  const projectedBase = instance.crown
    ? (resolveRaidRosterFormProjections(variants, base, instance)[0]?.variant ??
      base)
    : base;

  if (isSpecialMaxAttacker(projectedBase)) return projectedBase;

  const wantsGigantamax = Boolean(instance.gigantamax);
  const wantsDynamax = Boolean(instance.dynamax) || wantsGigantamax;
  if (!wantsDynamax && !isMaxVariant(projectedBase)) return null;

  const wantsShiny = isShiny(projectedBase, instance);
  const candidates = variants.filter((variant) => {
    if (variant.pokemon_id !== projectedBase.pokemon_id) return false;
    const type = variant.variantType.toLowerCase();
    return wantsGigantamax
      ? type.includes('gigantamax')
      : type.includes('dynamax') && !type.includes('gigantamax');
  });

  return (
    candidates.find((variant) => matchesShiny(variant, wantsShiny)) ??
    candidates[0] ??
    (isMaxVariant(projectedBase) ? projectedBase : null)
  );
};

const getRecordedFastMove = (
  variant: PokemonVariant,
  instance: PokemonInstance,
) =>
  (variant.moves ?? []).find(
    (move) =>
      Number(move.is_fast) === 1 && move.move_id === instance.fast_move_id,
  );

export const buildMaxRoster = (
  variants: PokemonVariant[],
  instances: InstancesMap,
): MaxRosterSummary => {
  const resolveVariant = getInstanceVariantResolver(variants);
  const caught = Object.entries(instances).filter(
    ([, instance]) => instance.is_caught && !instance.disabled,
  );
  const pokemon: PokemonVariant[] = [];
  let caughtCount = 0;
  let incompleteEntryCount = 0;
  let unmappedCount = 0;

  caught.forEach(([key, instance]) => {
    const base = resolveVariant(instance);
    if (!base) {
      unmappedCount += 1;
      return;
    }

    const maxVariant = resolveMaxVariant(variants, base, instance);
    if (!maxVariant) return;
    caughtCount += 1;

    if (!hasRecordedIvs(instance) || !hasUsableLevel(instance)) {
      incompleteEntryCount += 1;
      return;
    }

    const fastMove = getRecordedFastMove(maxVariant, instance);
    if (!fastMove) {
      incompleteEntryCount += 1;
      return;
    }

    const instanceId = String(instance.instance_id || key);
    pokemon.push({
      ...maxVariant,
      variant_id: `${maxVariant.variant_id}::max-caught::${instanceId}`,
      moves: [
        fastMove,
        ...(maxVariant.moves ?? []).filter((move) => Number(move.is_fast) === 0),
      ],
      instanceData: { ...instance, instance_id: instanceId },
      raidRoster: {
        source: 'caught',
        instanceId,
        moveSource: 'recorded',
        levelSource:
          Number.isFinite(Number(instance.level)) && Number(instance.level) > 0
            ? 'recorded'
            : 'inferred',
        ivSource: 'recorded',
        formSource: instance.crown ? 'crown' : 'base',
        cpSource: 'recorded',
      },
    });
  });

  return {
    pokemon,
    caughtCount,
    eligibleCount: pokemon.length,
    incompleteEntryCount,
    unmappedCount,
  };
};
