import React, { useMemo, useState } from 'react';

import HighlightActionButton from './Menus/PokemonMenu/HighlightActionButton';
import FusionPokemonModal from '../features/fusion/components/FusionPokemonModal';
import MegaPokemonModal from '../features/mega/components/MegaPokemonModal';
import type {
  MegaSelectionData,
  MegaSelectionResult,
} from '../features/mega/hooks/useMegaPokemonHandler';
import type { FusionSelectionData } from '@/types/fusion';
import type { InstanceStatus, InstanceStatusMutationOutcome } from '@/types/instances';
import PokemonOrganizerSheet from '@/features/tags/components/PokemonOrganizerSheet';
import { summarizeOrganizerSelection } from '@/features/tags/utils/pokemonOrganizer';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import type { ConfirmInstanceStatusOptions } from '../services/changeInstanceTag/hooks/useHandleChangeTags';

type PokemonPageOverlaysProps = {
  isEditable: boolean;
  highlightedCards: Set<string>;
  onConfirmChangeTags: (
    filter: InstanceStatus,
    options?: ConfirmInstanceStatusOptions,
  ) => Promise<InstanceStatusMutationOutcome[]>;
  onClearSelection: () => void;
  isUpdating: boolean;
  isMegaSelectionOpen: boolean;
  megaSelectionData: MegaSelectionData | null;
  onMegaResolve: (result: MegaSelectionResult) => void;
  onMegaReject: (reason?: unknown) => void;
  isFusionSelectionOpen: boolean;
  fusionSelectionData: FusionSelectionData | null;
  onFusionResolve: (choice: string, leftInstanceId: string, rightInstanceId: string) => void;
  onFusionCancel: () => void;
  onCreateNewLeft: () => void;
  onCreateNewRight: () => void;
};

const PokemonPageOverlays: React.FC<PokemonPageOverlaysProps> = ({
  isEditable,
  highlightedCards,
  onConfirmChangeTags,
  onClearSelection,
  isUpdating,
  isMegaSelectionOpen,
  megaSelectionData,
  onMegaResolve,
  onMegaReject,
  isFusionSelectionOpen,
  fusionSelectionData,
  onFusionResolve,
  onFusionCancel,
  onCreateNewLeft,
  onCreateNewRight,
}) => {
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);
  const instances = useInstancesStore((state) => state.instances);
  const selectionSummary = useMemo(
    () => summarizeOrganizerSelection(highlightedCards, instances),
    [highlightedCards, instances],
  );

  return (
  <>
    {isEditable && highlightedCards.size > 0 && (
      <HighlightActionButton
        action={selectionSummary.kind === 'catalog' ? 'add' : 'organize'}
        count={highlightedCards.size}
        isUpdating={isUpdating}
        onOpen={() => setIsOrganizerOpen(true)}
      />
    )}

    {isOrganizerOpen ? (
      <PokemonOrganizerSheet
        selectionKeys={highlightedCards}
        onChangeStatus={onConfirmChangeTags}
        onClearSelection={onClearSelection}
        onClose={() => setIsOrganizerOpen(false)}
      />
    ) : null}

    <MegaPokemonModal
      open={isMegaSelectionOpen}
      data={megaSelectionData}
      onResolve={onMegaResolve}
      onReject={onMegaReject}
    />

    {isFusionSelectionOpen && fusionSelectionData && (
      <FusionPokemonModal
        isOpen={isFusionSelectionOpen}
        fusionSelectionData={fusionSelectionData}
        onConfirm={onFusionResolve}
        onCancel={onFusionCancel}
        onCreateNewLeft={onCreateNewLeft}
        onCreateNewRight={onCreateNewRight}
      />
    )}
  </>
  );
};

export default PokemonPageOverlays;
