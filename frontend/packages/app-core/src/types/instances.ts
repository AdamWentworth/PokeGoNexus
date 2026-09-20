// src/types/instances.ts

import type { PokemonInstance } from './pokemonInstance';
import type { InstancesMap } from '@pokemongonexus/shared-contracts/instances';

/* -------------------------------------------------------------------------- */
/*  Instance-centric helpers                                                 */
/* -------------------------------------------------------------------------- */

export type InstanceStatus = 'Caught' | 'Trade' | 'Wanted' | 'Missing';

export type InstanceStatusMutationOperation =
  | 'created'
  | 'cloned'
  | 'converted'
  | 'updated'
  | 'unchanged';

export interface InstanceStatusMutationOutcome {
  sourceKey: string;
  sourceInstanceId: string | null;
  resultingInstanceId: string;
  targetStatus: InstanceStatus;
  operation: InstanceStatusMutationOperation;
  changed: boolean;
}

export type InstanceStatusResultPatch =
  | Partial<PokemonInstance>
  | ((
      outcome: Omit<InstanceStatusMutationOutcome, 'changed'>,
      instance: PokemonInstance,
    ) => Partial<PokemonInstance>);

export type Instances        = InstancesMap;
export type MutableInstances = Record<string, Partial<PokemonInstance>>;

/* async helpers ----------------------------------------------------------- */
export type UpdateInstanceStatusFn = (
  instanceIds: string | string[],
  newStatus: InstanceStatus,
  onAlert?: (message: string) => void,
  resultPatch?: InstanceStatusResultPatch,
) => Promise<InstanceStatusMutationOutcome[]>;

export type UpdateInstanceDetailsFn = (
  keysOrObject: string | string[] | Record<string, PokemonInstance>,
  details?: Record<string, PokemonInstance>
) => Promise<void>;

export type SetInstancesFn = (
  updater: (
    prevData: { instances: MutableInstances }
  ) => { instances: MutableInstances }
) => void;
