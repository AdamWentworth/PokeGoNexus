import { useState } from 'react';

import { useModal } from '@/contexts/ModalContext';
import PokemonLocationBackground from '@/features/pokemonDisplay/PokemonLocationBackground';
import UpdateForTradeModal from '@/pages/Pokemon/features/instances/components/Trade/UpdateForTradeModal';
import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

import TradeProposalComposer from './TradeProposalComposer';
import useTradeProposalFlow from './useTradeProposalFlow';
import type { SelectedPokemon } from './proposalCandidateHelpers';
import './CatalogWantedLauncherPanel.css';

interface CatalogWantedLauncherPanelProps {
  partnerUsername: string;
  wantedPokemon: PokemonVariant & { instanceData?: Partial<PokemonInstance> };
  partnerLists: Record<string, Record<string, unknown>>;
  partnerInstances: Instances;
}

type PartnerTradePokemon = PokemonVariant & {
  instanceData: PokemonInstance & {
    not_wanted_list?: Record<string, boolean>;
    wanted_filters?: Record<string, boolean>;
  };
};

const getPartnerTradePokemon = (
  lists: Record<string, Record<string, unknown>>,
  instances: Instances,
): PartnerTradePokemon[] => {
  const tradeEntries = lists.trade ?? Object.fromEntries(
    Object.entries(lists.caught ?? {}).filter(([instanceId, value]) => {
      const listValue = value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {};
      const instance = instances[instanceId];
      return Boolean(listValue.is_for_trade ?? instance?.is_for_trade);
    }),
  );

  return Object.entries(tradeEntries).flatMap(([instanceId, value]) => {
    if (!value || typeof value !== 'object') return [];
    const instance = instances[instanceId];
    if (!instance || !instance.is_caught || !instance.is_for_trade) return [];
    return [{
      ...(value as unknown as PokemonVariant),
      instanceData: instance as PartnerTradePokemon['instanceData'],
    }];
  });
};

const CatalogWantedLauncherPanel = ({
  partnerUsername,
  wantedPokemon,
  partnerLists,
  partnerInstances,
}: CatalogWantedLauncherPanelProps) => {
  const { alert } = useModal();
  const [selectedReturn, setSelectedReturn] = useState<PartnerTradePokemon | null>(null);
  const returnOptions = getPartnerTradePokemon(partnerLists, partnerInstances);
  const suggestedTarget: SelectedPokemon = {
    ...(wantedPokemon as unknown as SelectedPokemon),
    key: wantedPokemon.instanceData?.instance_id ?? wantedPokemon.variant_id,
  };
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
    selectedPokemon: suggestedTarget,
    closeOverlay: () => undefined,
    alert,
  });

  const chooseReturn = (pokemon: PartnerTradePokemon) => {
    setSelectedReturn(pokemon);
    void proposeTrade(suggestedTarget);
  };

  return (
    <section className="catalog-wanted-launcher" aria-label={`Offer Pokémon to ${partnerUsername}`}>
      <header>
        <div className="catalog-wanted-launcher__heading-meta">
          <span>For Trade offers</span>
          <strong>{returnOptions.length}</strong>
        </div>
        <h2>Choose what you want</h2>
      </header>

      {returnOptions.length > 0 ? (
        <div className="catalog-wanted-launcher__returns">
          {returnOptions.map((pokemon) => (
            <button
              type="button"
              key={pokemon.instanceData.instance_id}
              onClick={() => chooseReturn(pokemon)}
            >
              <span className="catalog-wanted-launcher__media">
                <PokemonLocationBackground pokemon={pokemon} />
                {pokemon.currentImage ? <img src={pokemon.currentImage} alt="" /> : null}
              </span>
              <span className="catalog-wanted-launcher__label">
                {pokemon.name ?? pokemon.species_name ?? 'Unknown Pokémon'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="catalog-wanted-launcher__empty">
          {partnerUsername} does not currently have a caught Pokémon marked For Trade,
          so there is no complete exchange to propose yet.
        </p>
      )}

      {isTradeProposalOpen && selectedReturn ? (
        <TradeProposalComposer
          context={{
            partnerUsername,
            requestedPokemon: selectedReturn,
            candidateOffers: tradeClickedPokemon,
            requestedPreferences: wantedPokemon.instanceData as {
              friendship_level?: number;
              pref_lucky?: boolean;
            },
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

export default CatalogWantedLauncherPanel;
