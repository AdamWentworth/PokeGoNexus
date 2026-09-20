import React, { useState } from 'react';
import CloseButton from '@/components/CloseButton';
import OverlayPortal from '@/components/OverlayPortal';
import { useModal } from '@/contexts/ModalContext';
import CaughtInstance from '../../instances/CaughtInstance';
import '@/components/pokemonComponents/BackgroundLocationOverlay.css';
import './FusionPokemonSelection.css';

import { Fusion } from '@/types/pokemonSubTypes';
import { PokemonVariant } from '@/types/pokemonVariants';

type FusionPokemonSelectionProps = {
  leftCandidatesList: PokemonVariant[];
  rightCandidatesList: PokemonVariant[];
  fusionData: Fusion;
  onConfirm: (
    action: 'confirmFuse',
    leftInstanceId: string,
    rightInstanceId: string
  ) => void;
  onCancel: () => void;
  onCreateNewLeft: () => void;
  onCreateNewRight: () => void;
  error?: string;
};

const FusionPokemonSelection: React.FC<FusionPokemonSelectionProps> = ({
  leftCandidatesList,
  rightCandidatesList,
  fusionData,
  onConfirm,
  onCancel,
  onCreateNewLeft,
  onCreateNewRight,
  error,
}) => {
  const { alert } = useModal();
  const [selectedLeftInstance, setSelectedLeftInstance] = useState<string | null>(null);
  const [selectedRightInstance, setSelectedRightInstance] = useState<string | null>(null);

  const handleFuse = () => {
    if (!selectedLeftInstance || !selectedRightInstance) {
      void alert('Please select one Pok\u00E9mon from each side before fusing.');
      return;
    }

    onConfirm('confirmFuse', selectedLeftInstance, selectedRightInstance);
  };

  return (
    <OverlayPortal onClose={onCancel} closeOnBackdrop>
      <div className="background-overlay fusion-pokemon-selection-overlay" onClick={onCancel}>
        <div
          className="background-overlay-content fusion-modal-content"
          onClick={(event) => event.stopPropagation()}
        >
          <h2>{fusionData.name}</h2>

          <button
            className="fuse-button"
            onClick={handleFuse}
            disabled={!selectedLeftInstance || !selectedRightInstance}
          >
            Fuse Selected Pok\u00E9mon
          </button>

          <div className="fusion-columns">
            <div className="left-column">
              {leftCandidatesList.length === 0 ? (
                <p>No candidates found.</p>
              ) : (
                leftCandidatesList.map((candidate) => {
                  const instanceId = candidate.instanceData?.instance_id ?? '';
                  const isSelected = selectedLeftInstance === instanceId;
                  return (
                    <div
                      key={instanceId}
                      className={`candidate-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedLeftInstance(isSelected ? null : instanceId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <CaughtInstance pokemon={candidate} isEditable={false} />
                    </div>
                  );
                })
              )}
              <button className="create-new-button" onClick={onCreateNewLeft}>
                Create New
              </button>
            </div>

            <div className="right-column">
              {rightCandidatesList.length === 0 ? (
                <p>No candidates found.</p>
              ) : (
                rightCandidatesList.map((candidate) => {
                  const instanceId = candidate.instanceData?.instance_id ?? '';
                  const isSelected = selectedRightInstance === instanceId;
                  return (
                    <div
                      key={instanceId}
                      className={`candidate-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedRightInstance(isSelected ? null : instanceId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <CaughtInstance pokemon={candidate} isEditable={false} />
                    </div>
                  );
                })
              )}
              <button className="create-new-button" onClick={onCreateNewRight}>
                Create New
              </button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}
        </div>
        <CloseButton
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
        />
      </div>
    </OverlayPortal>
  );
};

export default FusionPokemonSelection;
