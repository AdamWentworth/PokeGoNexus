import React from 'react';
import { FaArrowRight, FaMapMarkerAlt, FaTimes, FaUser } from 'react-icons/fa';

import IV from '@/components/pokemonComponents/IV';
import MoveDisplay from '@/components/pokemonComponents/MoveDisplay';
import MapPopupLinkedPokemonList, {
  type MapPopupLinkedEntry,
} from './MapPopupLinkedPokemonList';
import type { MapPopupMove } from './mapPopupHelpers';
import './MapResultPopup.css';

export type MapResultKind = 'caught' | 'trade' | 'wanted';

export type MapResultPopupItem = {
  username: string;
  instance_id: string;
  distance?: number | null;
  attack_iv?: number | string | null;
  defense_iv?: number | string | null;
  stamina_iv?: number | string | null;
  fast_move_id?: number | null;
  charged_move1_id?: number | null;
  charged_move1Id?: number | null;
  charged_move2_id?: number | null;
  pokemonInfo?: {
    moves?: MapPopupMove[] | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type MatchedPokemon = {
  currentImage?: string;
  name?: string;
  form?: string | null;
};

type MapResultPopupProps = {
  item: MapResultPopupItem;
  kind: MapResultKind;
  imageUrl?: string | null;
  pokemonDisplayName: string;
  relatedEntries?: Record<string, MapPopupLinkedEntry> | null;
  relatedTitle?: string;
  findPokemonByKey?: (
    keyOrInstanceId?: string | null,
    instanceLike?: Record<string, unknown> | null,
  ) => MatchedPokemon | null;
  onClose: () => void;
  onViewListing: () => void;
  onViewTrainer: () => void;
};

const listingLabels: Record<MapResultKind, string> = {
  caught: 'Caught',
  trade: 'For Trade',
  wanted: 'Wanted',
};

const MapResultPopup: React.FC<MapResultPopupProps> = ({
  item,
  kind,
  imageUrl,
  pokemonDisplayName,
  relatedEntries,
  relatedTitle,
  findPokemonByKey,
  onClose,
  onViewListing,
  onViewTrainer,
}) => {
  const distance = Number(item.distance);
  const hasDetails = Boolean(
    item.fast_move_id ||
      item.charged_move1_id ||
      item.charged_move1Id ||
      item.charged_move2_id ||
      item.attack_iv != null ||
      item.defense_iv != null ||
      item.stamina_iv != null,
  );

  return (
    <article
      className={`map-result-popup map-result-popup--${kind}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        aria-label="Close map result"
        className="map-result-popup__close"
        onClick={onClose}
        type="button"
      >
        <FaTimes aria-hidden="true" />
      </button>

      <header className="map-result-popup__header">
        <span>{listingLabels[kind]}</span>
        <strong>{item.username || 'Unknown trainer'}</strong>
        {Number.isFinite(distance) ? (
          <small>
            <FaMapMarkerAlt aria-hidden="true" />
            {distance <= 0.01 ? 'Nearby' : `${distance.toFixed(1)} km away`}
          </small>
        ) : null}
      </header>

      <section
        aria-label={`${pokemonDisplayName} listing`}
        className="map-result-popup__pokemon"
      >
        <div className="map-result-popup__image-frame">
          {imageUrl ? (
            <img src={imageUrl} alt={pokemonDisplayName} />
          ) : (
            <span>Image unavailable</span>
          )}
        </div>
        <h3>{pokemonDisplayName}</h3>
      </section>

      {relatedEntries && relatedTitle && findPokemonByKey ? (
        <MapPopupLinkedPokemonList
          entries={relatedEntries}
          findPokemonByKey={findPokemonByKey}
          title={relatedTitle}
        />
      ) : null}

      {hasDetails ? (
        <details className="map-result-popup__details">
          <summary>Pokémon details</summary>
          <MoveDisplay
            fastMoveId={item.fast_move_id ?? null}
            chargedMove1Id={
              item.charged_move1_id ?? item.charged_move1Id ?? null
            }
            chargedMove2Id={item.charged_move2_id ?? null}
            moves={item.pokemonInfo?.moves ?? []}
          />
          <IV item={item} />
        </details>
      ) : null}

      <footer className="map-result-popup__actions">
        <button onClick={onViewTrainer} type="button">
          <FaUser aria-hidden="true" />
          View trainer
        </button>
        <button
          className="map-result-popup__primary-action"
          onClick={onViewListing}
          type="button"
        >
          {kind === 'caught' ? 'View Pokémon' : 'Open listing'}
          <FaArrowRight aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
};

export default MapResultPopup;
