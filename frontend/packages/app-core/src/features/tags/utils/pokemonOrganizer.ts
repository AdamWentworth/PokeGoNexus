import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';

export type OrganizerSelectionKind = 'catalog' | 'caught' | 'wanted' | 'mixed';
export type BulkToggleState = 'checked' | 'mixed' | 'unchecked';

export interface OrganizerSelectionSummary {
  kind: OrganizerSelectionKind;
  catalogKeys: string[];
  caughtInstanceIds: string[];
  wantedInstanceIds: string[];
  unavailableKeys: string[];
  selectedCount: number;
}

const normalizeTagIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string =>
    typeof entry === 'string' && entry.trim().length > 0,
  ).map((entry) => entry.trim()))];
};

const resolveSavedInstance = (
  instances: Instances,
  requestedKey: string,
): [string, PokemonInstance] | null => {
  const direct = instances[requestedKey];
  if (direct) return [requestedKey, direct];
  for (const [instanceId, instance] of Object.entries(instances)) {
    if (instance.instance_id === requestedKey) return [instanceId, instance];
  }
  return null;
};

export const summarizeOrganizerSelection = (
  selectionKeys: Iterable<string>,
  instances: Instances,
): OrganizerSelectionSummary => {
  const catalogKeys: string[] = [];
  const caughtInstanceIds: string[] = [];
  const wantedInstanceIds: string[] = [];
  const unavailableKeys: string[] = [];

  for (const requestedKey of selectionKeys) {
    const saved = resolveSavedInstance(instances, requestedKey);
    if (!saved) {
      catalogKeys.push(requestedKey);
      continue;
    }

    const [instanceId, instance] = saved;
    if (instance.disabled) {
      unavailableKeys.push(requestedKey);
    } else if (instance.is_wanted) {
      wantedInstanceIds.push(instanceId);
    } else if (instance.is_caught || instance.is_for_trade) {
      caughtInstanceIds.push(instanceId);
    } else {
      // Baseline rows are blueprints. Treating them as catalog selections keeps
      // creation semantics even if the cache happens to expose their UUID.
      catalogKeys.push(instance.variant_id || requestedKey);
    }
  }

  const populatedKinds = [
    catalogKeys.length > 0,
    caughtInstanceIds.length > 0,
    wantedInstanceIds.length > 0,
  ].filter(Boolean).length;
  const kind: OrganizerSelectionKind = populatedKinds > 1
    ? 'mixed'
    : catalogKeys.length > 0
      ? 'catalog'
      : wantedInstanceIds.length > 0
        ? 'wanted'
        : 'caught';

  return {
    kind,
    catalogKeys,
    caughtInstanceIds,
    wantedInstanceIds,
    unavailableKeys,
    selectedCount:
      catalogKeys.length +
      caughtInstanceIds.length +
      wantedInstanceIds.length +
      unavailableKeys.length,
  };
};

export const getBulkToggleState = (
  instanceIds: string[],
  instances: Instances,
  predicate: (instance: PokemonInstance) => boolean,
): BulkToggleState => {
  if (instanceIds.length === 0) return 'unchecked';
  const selected = instanceIds.reduce(
    (count, instanceId) => count + (predicate(instances[instanceId]) ? 1 : 0),
    0,
  );
  if (selected === 0) return 'unchecked';
  if (selected === instanceIds.length) return 'checked';
  return 'mixed';
};

export const applyCustomTagChanges = (
  currentValue: unknown,
  changes: Record<string, boolean>,
): string[] => {
  const next = new Set(normalizeTagIds(currentValue));
  for (const [tagId, shouldApply] of Object.entries(changes)) {
    if (shouldApply) next.add(tagId);
    else next.delete(tagId);
  }
  return [...next];
};

