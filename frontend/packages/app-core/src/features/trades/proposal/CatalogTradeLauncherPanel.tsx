import { useState } from 'react';

import { useModal } from '@/contexts/ModalContext';
import PokemonLocationBackground from '@/features/pokemonDisplay/PokemonLocationBackground';
import UpdateForTradeModal from '@/pages/Pokemon/features/instances/components/Trade/UpdateForTradeModal';
import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

import { resolveCatalogTradeTargets } from './catalogTradeTargets';
import TradeProposalComposer from './TradeProposalComposer';
import useTradeProposalFlow from './useTradeProposalFlow';
import type { SelectedPokemon } from './proposalCandidateHelpers';
import './CatalogTradeLauncherPanel.css';

interface CatalogTradeLauncherPanelProps {
  partnerUsername: string;
  partnerPokemon: PokemonVariant & {
    instanceData: Partial<PokemonInstance> & {
      not_wanted_list?: Record<string, boolean>;
      wanted_filters?: Record<string, boolean>;
      mirror?: boolean;
    };
  };
  partnerLists: Record<string, Record<string, unknown>>;
  partnerInstances: Instances;
  suggestedTarget?: SelectedPokemon | null;
}

const targetName = (target: SelectedPokemon) =>
  String(target.name ?? target.species_name ?? 'Unknown Pokémon');

const CatalogTradeLauncherPanel = ({
  partnerUsername,
  partnerPokemon,
  partnerLists,
  partnerInstances,
  suggestedTarget,
}: CatalogTradeLauncherPanelProps) => {
  const { alert } = useModal();
  const resolvedTargets = resolveCatalogTradeTargets(
    partnerLists.wanted,
    partnerPokemon.instanceData.wanted_filters,
    partnerPokemon.instanceData.not_wanted_list,
  );
  const acceptableTargets = partnerPokemon.instanceData.mirror
    ? resolvedTargets.filter((target) => {
        const targetVariantId = String(target.variant_id ?? '');
        const targetKey = String(target.key ?? '');
        return targetVariantId === partnerPokemon.variant_id ||
          targetKey === partnerPokemon.variant_id ||
          targetKey.startsWith(`${partnerPokemon.variant_id}_`);
      })
    : resolvedTargets;
  const suggestedTargetKey = String(suggestedTarget?.key ?? suggestedTarget?.variant_id ?? '');
  const suggestedAcceptableTarget =
    acceptableTargets.find(
      (target) => String(target.key ?? target.variant_id ?? '') === suggestedTargetKey,
    ) ?? null;
  const [selectedTarget, setSelectedTarget] = useState<SelectedPokemon | null>(
    suggestedAcceptableTarget,
  );
  const {
    myInstances,
    isTradeProposalOpen,
    tradeClickedPokemon,
    isUpdateForTradeModalOpen,
    caughtInstancesToTrade,
    currentBaseKey,
    proposeTrade,
    closeTradeProposal,
    closeTradeSelectionModal,
  } = useTradeProposalFlow({
    selectedPokemon: selectedTarget,
    closeOverlay: () => undefined,
    alert,
  });

  const selectTarget = (target: SelectedPokemon) => {
    setSelectedTarget(target);
    void proposeTrade(target);
  };

  return (
    <section className="catalog-trade-launcher" aria-label={`Trade with ${partnerUsername}`}>
      <div className="catalog-trade-launcher__heading">
        <div className="catalog-trade-launcher__heading-meta">
          <span>Wanted targets</span>
          <strong className="catalog-trade-launcher__count">
            {acceptableTargets.length}
          </strong>
        </div>
        <h2>Choose what to offer</h2>
      </div>

      {acceptableTargets.length > 0 ? (
        <>
          <div className="catalog-trade-launcher__picker" role="listbox" aria-label="Pokémon to offer">
            {acceptableTargets.map((target) => {
              const key = String(target.key ?? target.variant_id ?? targetName(target));
              const selected = String(selectedTarget?.key ?? '') === key;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  key={key}
                  className={selected ? 'selected' : ''}
                  onClick={() => selectTarget(target)}
                >
                  <span className="catalog-trade-launcher__media">
                    <PokemonLocationBackground pokemon={target} />
                    {typeof target.currentImage === 'string' ? (
                      <img src={target.currentImage} alt="" />
                    ) : null}
                  </span>
                  <span className="catalog-trade-launcher__label">
                    {targetName(target)}
                  </span>
                </button>
              );
            })}
          </div>

        </>
      ) : null}

      {isTradeProposalOpen ? (
        <TradeProposalComposer
          context={{
            partnerUsername,
            requestedPokemon:
              partnerPokemon as PokemonVariant & { instanceData?: PokemonInstance },
            candidateOffers: tradeClickedPokemon,
            requestedPreferences: selectedTarget as {
              friendship_level?: number;
              pref_lucky?: boolean;
            } | null,
            ownedInstances: myInstances,
            relatedInstances: partnerInstances,
          }}
          onClose={closeTradeProposal}
        />
      ) : null}

      {isUpdateForTradeModalOpen ? (
        <UpdateForTradeModal
          caughtInstances={caughtInstancesToTrade}
          baseKey={currentBaseKey}
          onClose={closeTradeSelectionModal}
        />
      ) : null}
    </section>
  );
};

export default CatalogTradeLauncherPanel;
