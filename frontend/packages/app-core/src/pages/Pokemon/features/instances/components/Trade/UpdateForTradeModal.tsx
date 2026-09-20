// src/features/instances/components/UpdateForTradeModal.tsx
import React, { useEffect, useState } from 'react';
import './UpdateForTradeModal.css';

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { getVariantById } from '@/db/indexedDB';

import CaughtInstance from '../../CaughtInstance';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { createScopedLogger } from '@/utils/logger';
import { canMarkInstanceForTrade } from '@/features/trades/proposal/proposalCandidateHelpers';
import CloseButton from '@/components/CloseButton';
import OverlayPortal from '@/components/OverlayPortal';

const log = createScopedLogger('UpdateForTradeModal');

interface UpdateForTradeModalProps {
  caughtInstances: PokemonInstance[];
  baseKey?: string | null;
  onClose: () => void;
  onConfirm?: () => void;
}

type VariantWithInstance = PokemonVariant & { instanceData: PokemonInstance };

const UpdateForTradeModal: React.FC<UpdateForTradeModalProps> = ({
  caughtInstances,
  baseKey = null,
  onClose,
}) => {
  const updateDetails = useInstancesStore((s) => s.updateInstanceDetails);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [variantData, setVariantData] = useState<PokemonVariant | null>(null);
  const [restructuredData, setRestructuredData] = useState<VariantWithInstance[]>([]);


  useEffect(() => {
    const fetchVariant = async () => {
      if (!baseKey) return;

      setLoading(true);
      setError(null);

      try {
        const data = (await getVariantById(baseKey)) as PokemonVariant;
        setVariantData(data);
      } catch (err) {
        log.error('Failed to fetch variant data:', err);
        setError('Failed to fetch variant data.');
      } finally {
        setLoading(false);
      }
    };

    fetchVariant();
  }, [baseKey]);

  useEffect(() => {
    if (!variantData || caughtInstances.length === 0) return;

    const merged: VariantWithInstance[] = caughtInstances
      .filter(canMarkInstanceForTrade)
      .map((inst) => ({
        ...variantData,
        instanceData: { ...inst },
      }));

    setRestructuredData(merged);
  }, [variantData, caughtInstances]);

  const handleUpdateToTrade = async (instanceId: string | undefined) => {
    if (!instanceId) return;

    try {
      const current = restructuredData.find(
        (p) => p.instanceData.instance_id === instanceId,
      )?.instanceData;

      if (!current) return;
      if (!canMarkInstanceForTrade(current)) {
        setError('Lucky Pokémon cannot be marked For Trade.');
        return;
      }

      const updatedInstance: PokemonInstance = {
        ...current,
        is_for_trade: true,
      };

      await updateDetails({ [instanceId]: updatedInstance });

      setRestructuredData((prev) =>
        prev.map((p) =>
          p.instanceData.instance_id === instanceId
            ? { ...p, instanceData: updatedInstance }
            : p,
        ),
      );
    } catch (err) {
      log.error(`Failed to update instance ${instanceId} for trade:`, err);
      setError(`Failed to update instance ${instanceId} for trade.`);
    }
  };

  return (
    <OverlayPortal onClose={onClose} closeOnBackdrop>
      <div
        className="update-for-trade-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
      <div className="modal-content">
        <CloseButton onClick={onClose} />

        <h2 id="modal-title">Update Instances for Trade</h2>

        {loading && <p>Loading variant data…</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && restructuredData.length > 0 && (
          <div className="instances-list">
            {restructuredData.map((pokemon) => (
              <div
                className="instance-item"
                key={pokemon.instanceData.instance_id}
              >
                <CaughtInstance pokemon={pokemon} isEditable={false} />

                <button
                  onClick={() =>
                    handleUpdateToTrade(pokemon.instanceData.instance_id!)
                  }
                  className="update-button"
                  disabled={
                    pokemon.instanceData.is_for_trade ||
                    !canMarkInstanceForTrade(pokemon.instanceData)
                  }
                >
                  {pokemon.instanceData.lucky
                    ? 'Lucky Pokémon cannot be traded'
                    : pokemon.instanceData.is_for_trade
                    ? 'For Trade'
                    : 'Add to For Trade'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </OverlayPortal>
  );
};

export default UpdateForTradeModal;
