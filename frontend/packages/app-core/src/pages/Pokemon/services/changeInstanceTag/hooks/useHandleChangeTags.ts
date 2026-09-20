// useHandleChangeTags.ts

import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useModal } from '../../../../../contexts/ModalContext';

import { getStatusFromInstance, getTransitionMessage } from '../utils/transitionMessages';
import { buildInstanceTagChangeMessage } from '../utils/buildInstanceTagChangeMessage';

import type { PokemonInstance } from '../../../../../types/pokemonInstance';
import type { PokemonVariant } from '../../../../../types/pokemonVariants';
import type { InstanceStatus } from '@/types/instances';
import type {
  InstanceStatusMutationOutcome,
  InstanceStatusResultPatch,
} from '@/types/instances';

import { categorizeVariantKeys } from '../logic/categorizeVariantKeys';
import { validateBlockedMoves } from '../logic/validateMoveToFilter';
import { getDisplayName } from '../logic/getDisplayName';
import { createScopedLogger } from '@/utils/logger';
import type { MegaSelectionResult } from '@/pages/Pokemon/features/mega/hooks/useMegaPokemonHandler';
import type { FusionSelectionResult } from '@/types/fusion';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';

const log = createScopedLogger('useHandleChangeTags');

interface useHandleChangeTagsProps {
  setTagFilter: (filter: string) => void;
  setHighlightedCards: (cards: Set<string>) => void;
  highlightedCards: Set<string>;
  updateInstanceStatus: (
    keys: string[],
    filter: InstanceStatus,
    resultPatch?: InstanceStatusResultPatch,
  ) => Promise<InstanceStatusMutationOutcome[]>;
  variants: PokemonVariant[];
  instances: Record<string, PokemonInstance>;
  updateInstanceDetails: (
    key: string,
    patch: Partial<PokemonInstance>,
  ) => Promise<void>;
  setIsUpdating: (value: boolean) => void;
  promptMegaPokemonSelection: (baseKey: string, megaForm?: string) => Promise<MegaSelectionResult>;
  promptFusionPokemonSelection: (baseKey: string) => Promise<FusionSelectionResult>;
  setIsFastSelectEnabled: (enabled: boolean) => void;
}

export interface ConfirmInstanceStatusOptions {
  targets?: Iterable<string>;
  resultPatch?: InstanceStatusResultPatch;
  additionalConfirmationDetails?: string[];
  destinationFilter?: string;
}

// Normalize legacy labels to current canonical ones.
function normalizeStatus(status: string | InstanceStatus): InstanceStatus {
  const s = String(status || '').trim().toLowerCase();
  switch (s) {
    case 'caught':
      return 'Caught' as InstanceStatus;
    case 'trade':
      return 'Trade' as InstanceStatus;
    case 'wanted':
      return 'Wanted' as InstanceStatus;
    case 'missing':
      return 'Missing' as InstanceStatus;
    default:
      return s as InstanceStatus;
  }
}

// Ensures the spinner renders before heavy work begins.
async function yieldToPaint() {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

function useHandleChangeTags({
  setTagFilter,
  setHighlightedCards,
  highlightedCards,
  updateInstanceStatus,
  variants,
  instances,
  updateInstanceDetails,
  setIsUpdating,
  promptMegaPokemonSelection,
  promptFusionPokemonSelection,
  setIsFastSelectEnabled,
}: useHandleChangeTagsProps) {
  const { confirm, alert } = useModal();

  const handleMoveHighlightedToFilter = useCallback(
    async (
      filter: InstanceStatus,
      cardsToMove: Set<string>,
      resultPatch?: InstanceStatusResultPatch,
      hasPriorChanges = false,
      destinationFilter?: string,
    ): Promise<InstanceStatusMutationOutcome[]> => {
      try {
        const targetFilter = normalizeStatus(filter);

        // Commit spinner immediately so it can paint
        flushSync(() => setIsUpdating(true));
        await yieldToPaint();

        let outcomes: InstanceStatusMutationOutcome[] = [];
        if (cardsToMove.size > 0) {
          outcomes = await updateInstanceStatus(
            [...cardsToMove],
            targetFilter,
            resultPatch,
          );
        }
        const changed = hasPriorChanges || outcomes.some((outcome) => outcome.changed);

        // Reflect successful changes in the destination context. When every
        // item is blocked, keep the selection intact so the user can revise it.
        if (changed && targetFilter !== 'Missing') {
          setTagFilter(destinationFilter ?? targetFilter);
        }

        if (changed) {
          setHighlightedCards(new Set());
          setIsFastSelectEnabled(false);
        }
        return outcomes;
      } catch (error) {
        log.error('Error updating instance:', error);
        throw error;
      } finally {
        setIsUpdating(false);
      }
    },
    [updateInstanceStatus, setHighlightedCards, setIsFastSelectEnabled, setIsUpdating, setTagFilter]
  );

  const handleConfirmChangeTags = useCallback(
    async (
      filter: InstanceStatus,
      options: ConfirmInstanceStatusOptions = {},
    ): Promise<InstanceStatusMutationOutcome[]> => {
      const targetFilter = normalizeStatus(filter);
      const displayFilterText = targetFilter; // already normalized
      const messageDetails: string[] = [];
      const targets = new Set(options.targets ?? highlightedCards);

      const { regular, mega, fusion } = categorizeVariantKeys(targets);

      const validation = validateBlockedMoves({
        filter: targetFilter,
        fusionKeys: fusion,
        megaKeys: mega,
        instances,
        displayFilterText,
        variants,
      });

      if (!validation.success && validation.message) {
        await alert(validation.message);
        return [];
      }

      const appendTransitionMessage = (
        key: string,
        baseKey: string,
        hasUUID: boolean,
      ) => {
        const instance = instances[key];
        if (hasUUID && instance) {
          const displayName =
            instance.nickname || getDisplayName(instance.variant_id || baseKey, variants);
          messageDetails.push(
            getTransitionMessage(
              getStatusFromInstance(instance),
              targetFilter,
              displayName,
            ),
          );
          return;
        }

        messageDetails.push(
          `Create ${getDisplayName(baseKey, variants)} as ${displayFilterText}`,
        );
      };

      for (const { key, parsed } of regular) {
        appendTransitionMessage(key, parsed.baseKey, parsed.hasUUID);
      }
      for (const { key, baseKey } of mega) {
        appendTransitionMessage(key, baseKey, Boolean(instances[key]));
      }
      for (const { key, baseKey } of fusion) {
        appendTransitionMessage(key, baseKey, Boolean(instances[key]));
      }

      for (const detail of options.additionalConfirmationDetails ?? []) {
        const normalized = detail.trim();
        if (normalized) messageDetails.push(normalized);
      }

      if (messageDetails.length > 0) {
        const userConfirmed = await confirm(buildInstanceTagChangeMessage(messageDetails));
        if (!userConfirmed) {
          log.debug('User canceled the operation.');
          return [];
        }
      }

      const skippedMegaVariantKeys: string[] = [];
      const skippedFusionVariantKeys: string[] = [];
      const remainingHighlightedCards = new Set(targets);
      const specialOutcomes: InstanceStatusMutationOutcome[] = [];

      const applySpecialPatch = async (
        sourceKey: string,
        resultingInstanceId: string,
        operation: 'created' | 'updated',
      ) => {
        const outcome = {
          sourceKey,
          sourceInstanceId: operation === 'updated' ? resultingInstanceId : null,
          resultingInstanceId,
          targetStatus: targetFilter,
          operation,
        } as const;
        const liveInstance = useInstancesStore.getState().instances[resultingInstanceId];
        if (liveInstance && options.resultPatch) {
          const patch = typeof options.resultPatch === 'function'
            ? options.resultPatch(outcome, liveInstance)
            : options.resultPatch;
          if (Object.keys(patch).length > 0) {
            await updateInstanceDetails(resultingInstanceId, patch);
          }
        }
        specialOutcomes.push({ ...outcome, changed: true });
      };

      for (const { key, baseKey, megaForm } of mega) {
        try {
          const result = await promptMegaPokemonSelection(baseKey, megaForm);
          await applySpecialPatch(
            key,
            result.instanceId,
            result.action === 'createNew' ? 'created' : 'updated',
          );
          remainingHighlightedCards.delete(key);
        } catch (error) {
          log.error(`Error handling Mega Pokemon (${baseKey}):`, error);
          skippedMegaVariantKeys.push(baseKey);
          remainingHighlightedCards.delete(key);
        }
      }

      for (const { key, baseKey } of fusion) {
        try {
          const result = await promptFusionPokemonSelection(baseKey);
          if (result.action !== 'fuseThis' || !result.instanceId) {
            skippedFusionVariantKeys.push(baseKey);
          } else {
            await applySpecialPatch(key, result.instanceId, 'updated');
          }
          remainingHighlightedCards.delete(key);
        } catch (error) {
          log.error(`Error handling Fusion Pokemon (${baseKey}):`, error);
          skippedFusionVariantKeys.push(baseKey);
          remainingHighlightedCards.delete(key);
        }
      }

      let outcomes: InstanceStatusMutationOutcome[] = [];
      try {
        if (
          remainingHighlightedCards.size > 0 ||
          specialOutcomes.some((outcome) => outcome.changed)
        ) {
          outcomes = await handleMoveHighlightedToFilter(
            targetFilter,
            remainingHighlightedCards,
            options.resultPatch,
            specialOutcomes.some((outcome) => outcome.changed),
            options.destinationFilter,
          );
        }
      } catch (error) {
        log.error('Error during instance update:', error);
        await alert('An error occurred while updating instance. Please try again.');
        return [];
      }

      if (skippedMegaVariantKeys.length > 0) {
        const names = skippedMegaVariantKeys.map((key) => getDisplayName(key, variants));
        const msg = `Skipped handling of Mega Pokémon: ${names.join(', ')}`;
        log.info(msg);
        await alert(msg);
      }

      if (skippedFusionVariantKeys.length > 0) {
        const names = skippedFusionVariantKeys.map((key) => getDisplayName(key, variants));
        const msg = `Skipped handling of Fusion Pokémon: ${names.join(', ')}`;
        log.info(msg);
        await alert(msg);
      }

      return [...specialOutcomes, ...outcomes];
    },
    [
      highlightedCards,
      instances,
      variants,
      updateInstanceDetails,
      confirm,
      alert,
      handleMoveHighlightedToFilter,
      promptMegaPokemonSelection,
      promptFusionPokemonSelection,
    ]
  );

  return {
    handleConfirmChangeTags,
  };
}

export default useHandleChangeTags;
