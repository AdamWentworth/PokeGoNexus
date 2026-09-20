import type { InstancesMap, PokemonInstance } from "../../../types/pokemonInstance";
import type { PokemonVariant } from "../../../types/pokemonVariants";
import {
  getLegalRaidChargedMoves,
  getLegalRaidFastMoves,
  isEligibleRaidAttacker,
} from "./raidCatalog";
import { resolveRaidRosterFormProjections } from "./raidRosterForms";
import { getInstanceVariantResolver } from '@pokemongonexus/shared-domain/instance-variant';

export type RaidRosterScope = "catalog" | "owned";

export type RaidRosterSummary = {
  attackers: PokemonVariant[];
  caughtCount: number;
  eligibleCount: number;
  incompleteMoveCount: number;
  incompleteLevelCount: number;
  incompleteIvCount: number;
  incompleteEntryCount: number;
  hiddenPowerEstimatedCount: number;
  unmappedCount: number;
  projectedFormCount: number;
};

const hasRecordedIvs = (instance: PokemonInstance): boolean =>
  [instance.attack_iv, instance.defense_iv, instance.stamina_iv].every(
    (value) => value != null && Number.isFinite(Number(value)),
  );

const hasRecordedLevel = (instance: PokemonInstance): boolean =>
  Number.isFinite(Number(instance.level)) && Number(instance.level) > 0;

const canInferLevel = (instance: PokemonInstance): boolean =>
  Number.isFinite(Number(instance.cp)) &&
  Number(instance.cp) > 0 &&
  hasRecordedIvs(instance);

const moveIdsContain = (
  moves: ReturnType<typeof getLegalRaidFastMoves>,
  moveId: number | null,
): boolean =>
  moveId != null && moves.some((move) => move.move_id === moveId);

const getInstanceId = (key: string, instance: PokemonInstance): string =>
  String(instance.instance_id || key);

export const buildRaidRoster = (
  variants: PokemonVariant[],
  instances: InstancesMap,
): RaidRosterSummary => {
  const resolveVariant = getInstanceVariantResolver(variants);
  const caught = Object.entries(instances).filter(
    ([, instance]) => instance.is_caught && !instance.disabled,
  );

  let incompleteMoveCount = 0;
  let incompleteLevelCount = 0;
  let incompleteIvCount = 0;
  let hiddenPowerEstimatedCount = 0;
  let unmappedCount = 0;
  let projectedFormCount = 0;
  const incompleteEntryIds = new Set<string>();
  const attackers: PokemonVariant[] = [];

  caught.forEach(([key, instance]) => {
    const base = resolveVariant(instance);
    if (!base) {
      unmappedCount += 1;
      return;
    }

    const instanceId = getInstanceId(key, instance);
    const recordedIvs = hasRecordedIvs(instance);
    const levelSource = hasRecordedLevel(instance)
      ? "recorded"
      : canInferLevel(instance)
        ? "inferred"
        : "estimated";
    if (levelSource === "estimated") {
      incompleteLevelCount += 1;
      incompleteEntryIds.add(instanceId);
    }
    if (!recordedIvs) {
      incompleteIvCount += 1;
      incompleteEntryIds.add(instanceId);
    }

    if (levelSource === "estimated" || !recordedIvs) {
      return;
    }

    const projections = resolveRaidRosterFormProjections(
      variants,
      base,
      instance,
    );
    if (projections.length === 0) {
      unmappedCount += 1;
      return;
    }

    let hasRecordedForm = false;
    projections.forEach(({ variant, formSource, useRecordedCp }) => {
      const probe: PokemonVariant = {
        ...variant,
        variant_id: `${variant.variant_id}::caught::${instanceId}::${formSource}`,
        instanceData: { ...instance, instance_id: instanceId },
        raidRoster: {
          source: "caught",
          instanceId,
          moveSource: "estimated",
          levelSource,
          ivSource: "recorded",
          formSource,
          cpSource: useRecordedCp ? "recorded" : "calculated",
        },
      };
      const legalFastMoves = getLegalRaidFastMoves(probe);
      const legalChargedMoves = getLegalRaidChargedMoves(probe);
      const recordedFastMove = legalFastMoves.find(
        (move) => move.move_id === instance.fast_move_id,
      );
      const hiddenPowerTypeEstimated =
        recordedFastMove?.name.toLowerCase().startsWith("hidden power") ??
        false;
      const recordedMoves =
        moveIdsContain(legalFastMoves, instance.fast_move_id) &&
        [instance.charged_move1_id, instance.charged_move2_id].some((moveId) =>
          moveIdsContain(legalChargedMoves, moveId),
        );
      if (!recordedMoves) return;

      hasRecordedForm = true;
      const attacker: PokemonVariant = {
        ...probe,
        raidRoster: {
          ...probe.raidRoster!,
          moveSource: "recorded",
          hiddenPowerTypeEstimated,
        },
      };

      if (hiddenPowerTypeEstimated) hiddenPowerEstimatedCount += 1;
      if (isEligibleRaidAttacker(attacker)) {
        attackers.push(attacker);
        if (formSource !== "base") projectedFormCount += 1;
      }
    });

    if (!hasRecordedForm) {
      incompleteMoveCount += 1;
      incompleteEntryIds.add(instanceId);
    }
  });

  return {
    attackers,
    caughtCount: caught.length,
    eligibleCount: attackers.length,
    incompleteMoveCount,
    incompleteLevelCount,
    incompleteIvCount,
    incompleteEntryCount: incompleteEntryIds.size,
    hiddenPowerEstimatedCount,
    unmappedCount,
    projectedFormCount,
  };
};
