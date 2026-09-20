import React from 'react';

import CP from '@/components/pokemonComponents/CP';
import DateCaughtComponent from '@/components/pokemonComponents/DateCaught';
import LocationCaught from '@/components/pokemonComponents/LocationCaught';
import Moves from '@/components/pokemonComponents/Moves';
import PokemonLocationBackground from '@/features/pokemonDisplay/PokemonLocationBackground';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

export type TradeProposalPokemon = PokemonVariant & { instanceData: PokemonInstance };

const noop = () => undefined;

type TradeProposalPokemonDetailsProps = {
  pokemon: TradeProposalPokemon;
  showNickname?: boolean;
};

export const TradeProposalPokemonDetails: React.FC<TradeProposalPokemonDetailsProps> = ({
  pokemon,
  showNickname = false,
}) => (
  <div className="pokemon-details">
    {showNickname && pokemon.instanceData.nickname ? (
      <p>Nickname: {pokemon.instanceData.nickname}</p>
    ) : null}
    <CP cp={pokemon.instanceData.cp ?? null} editMode={false} onCPChange={noop} />
    <Moves
      pokemon={pokemon}
      editMode={false}
      onMovesChange={noop}
      isShadow={pokemon.instanceData.shadow}
      isPurified={pokemon.instanceData.purified}
    />
    <LocationCaught pokemon={pokemon} editMode={false} onLocationChange={noop} />
    <DateCaughtComponent pokemon={pokemon} editMode={false} onDateChange={noop} />
  </div>
);

type TradeProposalPokemonCardProps = {
  pokemon?: TradeProposalPokemon;
  prefLucky: boolean;
  fallbackAlt: string;
};

export const TradeProposalPokemonCard: React.FC<TradeProposalPokemonCardProps> = ({
  pokemon,
  prefLucky,
  fallbackAlt,
}) => {
  const variantType = pokemon?.variantType ?? '';

  return (
    <div className="trade-proposal-image-container">
      <div className="image-wrapper">
        <PokemonLocationBackground pokemon={pokemon} />
        {prefLucky && <img src="/images/lucky.png" alt="Lucky" className="lucky-backdrop" />}
        {variantType.includes('dynamax') && (
          <img src="/images/dynamax.png" alt="Dynamax" className="max-icon" />
        )}
        {variantType.includes('gigantamax') && (
          <img src="/images/gigantamax.png" alt="G-max" className="max-icon" />
        )}
        <img
          src={pokemon?.currentImage ?? '/images/default/placeholder.png'}
          alt={pokemon?.name ?? fallbackAlt}
          className="trade-proposal-pokemon-img"
        />
      </div>
      {pokemon ? <h3 className="trade-proposal-name">{pokemon.name}</h3> : null}
    </div>
  );
};

type TradeProposalInstancePickerProps = {
  matchedInstances: PokemonVariant[];
  selectedInstanceId: string;
  onInstanceChange: (instanceId: string) => void;
};

export const TradeProposalInstancePicker: React.FC<TradeProposalInstancePickerProps> = ({
  matchedInstances,
  selectedInstanceId,
  onInstanceChange,
}) => {
  if (matchedInstances.length <= 1) return null;

  return (
    <div className="trade-instance-picker">
      <label htmlFor="instance-selector">Choose the instance to trade:</label>
      <select
        id="instance-selector"
        value={selectedInstanceId}
        onChange={(event) => onInstanceChange(event.target.value)}
      >
        {matchedInstances.map((instance, index) => (
          <option
            key={instance.instanceData?.instance_id ?? `${instance.variant_id}-${index}`}
            value={instance.instanceData?.instance_id ?? ''}
          >
            {instance.instanceData?.nickname ?? `${instance.name} ${index + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
};

type TradeProposalMatchedDetailsProps = {
  pokemon?: TradeProposalPokemon;
  matchedInstances: PokemonVariant[];
  onInstanceChange: (instanceId: string) => void;
};

export const TradeProposalMatchedDetails: React.FC<TradeProposalMatchedDetailsProps> = ({
  pokemon,
  matchedInstances,
  onInstanceChange,
}) => (
  <div className="trade-proposal-details trade-proposal-instance-choice">
    {matchedInstances.length > 1 ? (
      <TradeProposalInstancePicker
        matchedInstances={matchedInstances}
        selectedInstanceId={pokemon?.instanceData.instance_id ?? ''}
        onInstanceChange={onInstanceChange}
      />
    ) : (
      pokemon?.instanceData.nickname && <p>Nickname: {pokemon.instanceData.nickname}</p>
    )}
  </div>
);

type TradeProposalActionRowProps = {
  disabled: boolean;
  isSubmitting: boolean;
  formattedStardustCost: string;
  isSpecialTrade: boolean;
  isRemoteTrade: boolean;
  onProposeTrade: () => void;
};

export const TradeProposalActionRow: React.FC<TradeProposalActionRowProps> = ({
  disabled,
  isSubmitting,
  formattedStardustCost,
  isSpecialTrade,
  isRemoteTrade,
  onProposeTrade,
}) => (
  <div className="trade-proposal-row trade-proposal-row-middle">
    <div className="trade-proposal-stardust">
      <span>Estimated cost</span>
      <strong>{formattedStardustCost} Stardust</strong>
      <img src="/images/stardust.png" alt="" className="stardust-icon" />
      <div className="trade-proposal-flags">
        {isSpecialTrade && <span className="special-trade-warning">Special trade</span>}
        {isRemoteTrade && <span className="remote-trade-status">Remote trade available</span>}
      </div>
    </div>

    <button
      className="trade-proposal-propose-button"
      onClick={onProposeTrade}
      disabled={disabled}
      aria-busy={isSubmitting}
    >
      {isSubmitting ? 'Sending proposal…' : 'Propose trade'}
    </button>
  </div>
);
