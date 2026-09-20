// src/pages/Pokemon/services/fusionSelection/resolveFusionSelection.ts

import type { Instances } from '@/types/instances';
import { Fusion } from '@/types/pokemonSubTypes';
import type { FusionSelectionResult } from '@/types/fusion';
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('resolveFusionSelection');

type FusionUpdatePatch = Record<string, Partial<Instances[string]>>;

type ResolveFusionParams = {
  choice: string;
  leftInstanceId: string;
  rightInstanceId: string;
  fusionData: Fusion;
  instances: Instances;
  updateDetails: (updates: FusionUpdatePatch) => Promise<void>;
  resolve?: (result: FusionSelectionResult) => void;
};

export async function resolveFusionSelection({
  choice,
  leftInstanceId,
  rightInstanceId,
  fusionData,
  instances,
  updateDetails,
  resolve,
}: ResolveFusionParams) {
  if (choice === 'confirmFuse' && leftInstanceId && rightInstanceId) {
    try {
      const fusionName = fusionData.name;
      const fusionId = fusionData.fusion_id;

      if (fusionId == null) {
        throw new Error('Missing fusion ID');
      }

      const changes = {
        [leftInstanceId]: {
          is_fused: true,
          fused_with: rightInstanceId,
          fusion_form: fusionName,
          fusion: {
            ...(instances[leftInstanceId]?.fusion || {}),
            [fusionId]: true,
          },
        },
        [rightInstanceId]: {
          is_fused: true,
          fused_with: leftInstanceId,
          fusion_form: fusionName,
          disabled: true,
        },
      };

      await updateDetails(changes);
      resolve?.({ action: 'fuseThis', instanceId: leftInstanceId });
    } catch (error) {
      log.error('Error during fusion resolution:', error);
    }
  } else {
    resolve?.({ action: 'cancel', instanceId: null });
  }
}
