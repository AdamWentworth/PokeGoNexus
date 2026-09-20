import React, { useMemo, useState } from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import MoveDisplay from '../../../components/pokemonComponents/MoveDisplay';
import IV from '../../../components/pokemonComponents/IV';
import Gender from '../../../components/pokemonComponents/Gender';
import { TRADE_FRIENDSHIP_LEVELS } from '../../../db/indexedDB';
import { formatDate } from '../../../utils/formattingHelpers';
import { hasDetails } from '../helpers/hasDetails';
import type {
  TradeMove,
  TradePokemonDetails,
  TradeViewTrade,
} from './types';
import TradeExchangeSummary from '@/pages/Trades/components/TradeExchangeSummary';
import './ProposedTradeView.css';

type DetailSection = 'offering' | 'received';

interface ProposedTradeViewProps {
  trade: TradeViewTrade;
  currentUserDetails: TradePokemonDetails | null;
  partnerDetails: TradePokemonDetails | null;
  loading: boolean;
  offeringHeading: string;
  receivingHeading: string;
  handleCancel: () => void;
}

const hasVariantTag = (
  variantType: TradePokemonDetails['variantType'],
  tag: string,
): boolean => {
  if (!variantType) return false;
  if (Array.isArray(variantType)) {
    return variantType.includes(tag);
  }
  return variantType.includes(tag);
};

const toMoveList = (moves: TradePokemonDetails['moves']): TradeMove[] => {
  if (!Array.isArray(moves)) return [];
  return moves as TradeMove[];
};

const ProposedTradeView: React.FC<ProposedTradeViewProps> = ({
  trade,
  currentUserDetails,
  partnerDetails,
  loading,
  offeringHeading,
  receivingHeading,
  handleCancel,
}) => {
  const [visibleDetails, setVisibleDetails] = useState<Record<DetailSection, boolean>>({
    offering: false,
    received: false,
  });

  const reversedFriendshipLevels = useMemo(
    () =>
      Object.entries(TRADE_FRIENDSHIP_LEVELS).reduce<Record<string, number>>(
        (acc, [key, value]) => {
          acc[value] = Number.parseInt(key, 10);
          return acc;
        },
        {},
      ),
    [],
  );

  const friendshipLevel =
    reversedFriendshipLevels[trade.trade_friendship_level ?? ''] ?? 0;

  const toggleDetails = (section: DetailSection) => {
    setVisibleDetails((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderPokemonDetails = (
    details: TradePokemonDetails | null,
    isVisible: boolean,
  ): React.ReactNode => {
    if (!details) return null;
    if (!hasDetails(details)) {
      return isVisible ? <p>No additional details available.</p> : null;
    }

    const hasWeightOrHeight = Boolean(details.weight || details.height);
    const hasMoves = Boolean(
      details.fast_move_id ||
        details.charged_move1_id ||
        details.charged_move2_id,
    );

    return (
      <>
        {(hasWeightOrHeight || hasMoves) && (
          <div className="weight-height-move-container">
            {details.weight && (
              <p className="stat">
                <strong>{details.weight}kg</strong>
                <br />
                WEIGHT
              </p>
            )}
            {hasMoves && (
              <MoveDisplay
                fastMoveId={details.fast_move_id ?? null}
                chargedMove1Id={details.charged_move1_id ?? null}
                chargedMove2Id={details.charged_move2_id ?? null}
                moves={toMoveList(details.moves)}
              />
            )}
            {details.height && (
              <p className="stat">
                <strong>{details.height}m</strong>
                <br />
                HEIGHT
              </p>
            )}
          </div>
        )}
        <IV
          ivs={{
            Attack: details.attack_iv ?? null,
            Defense: details.defense_iv ?? null,
            Stamina: details.stamina_iv ?? null,
          }}
        />
        {details.location_caught && (
          <p>
            <strong>Location Caught:</strong> {details.location_caught}
          </p>
        )}
        {details.date_caught && (
          <p>
            <strong>Date Caught:</strong> {formatDate(details.date_caught)}
          </p>
        )}
      </>
    );
  };

  const renderPokemonSection = (
    details: TradePokemonDetails | null,
    section: DetailSection,
    heading: string,
    username?: string | null,
  ) => {
    const hasDetailsToShow = Boolean(details && hasDetails(details));
    const sectionClass = `pokemon ${section} ${
      hasDetailsToShow ? 'has-details' : 'no-details'
    }`;

    return (
      <div className={sectionClass}>
        <div className="headers">
          {username && <p className="receiving-username">{username}</p>}
          <h4>{heading}</h4>
        </div>

        <div className="pokemon-content">
          <div className="static-content">
            {details ? (
              <>
                <div className="pokemon-image-container">
                  <div className="image-wrapper">
                    {trade.is_lucky_trade &&
                    (details.currentImage || details.pokemon_image_url) ? (
                      <div className="lucky-backdrop-wrapper">
                        <img
                          src="/images/lucky.png"
                          alt="Lucky backdrop"
                          className="lucky-backdrop"
                        />
                      </div>
                    ) : null}
                    {hasVariantTag(details.variantType, 'dynamax') && (
                      <img
                        src="/images/dynamax.png"
                        alt="Dynamax"
                        style={{
                          position: 'absolute',
                          top: '0',
                          right: '3%',
                          width: '30%',
                          height: 'auto',
                          zIndex: 0,
                        }}
                      />
                    )}
                    {hasVariantTag(details.variantType, 'gigantamax') && (
                      <img
                        src="/images/gigantamax.png"
                        alt="Gigantamax"
                        style={{
                          position: 'absolute',
                          top: '0',
                          right: '3%',
                          width: '30%',
                          height: 'auto',
                          zIndex: 0,
                        }}
                      />
                    )}
                    {details.currentImage || details.pokemon_image_url ? (
                      <img
                        src={details.currentImage || details.pokemon_image_url || ''}
                        alt={details.name || `${section} Pokemon`}
                        className="pokemon-image"
                      />
                    ) : (
                      <p>No image available.</p>
                    )}
                    {details.gender && <Gender gender={details.gender} />}
                  </div>
                </div>
                <p className="pokemon-name">{details.name || 'Unknown Pokemon'}</p>
                <div className="pokemon-types">
                  {details.type_1_icon && (
                    <img
                      src={details.type_1_icon}
                      alt="Type 1"
                      className="type-icon"
                    />
                  )}
                  {details.type_2_icon && (
                    <img
                      src={details.type_2_icon}
                      alt="Type 2"
                      className="type-icon"
                    />
                  )}
                </div>
              </>
            ) : loading ? (
              <LoadingSpinner />
            ) : (
              <p>Could not load {section} details.</p>
            )}
            {details && (
              <button
                className="toggle-details-button"
                onClick={() => toggleDetails(section)}
              >
                {visibleDetails[section] ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>

          <div
            className={`details-content ${section}-details ${
              visibleDetails[section] ? 'visible' : ''
            }`}
          >
            {renderPokemonDetails(details, visibleDetails[section])}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="trade-card proposed-trade-view">
      <div className="trade-pokemon">
        {renderPokemonSection(
          currentUserDetails,
          'offering',
          offeringHeading,
          trade.username_proposed,
        )}

        <TradeExchangeSummary
          friendshipLevel={friendshipLevel}
          isLuckyTrade={Boolean(trade.is_lucky_trade)}
          stardustCost={trade.trade_dust_cost}
        >
          <button className="delete-button" onClick={handleCancel}>
            Cancel proposal
          </button>
        </TradeExchangeSummary>

        {renderPokemonSection(
          partnerDetails,
          'received',
          receivingHeading,
          trade.username_accepting,
        )}
      </div>
    </div>
  );
};

export default ProposedTradeView;
