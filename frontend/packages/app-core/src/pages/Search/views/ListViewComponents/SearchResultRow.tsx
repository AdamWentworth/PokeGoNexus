import React from 'react';
import { FaArrowRight, FaMapMarkerAlt, FaUser } from 'react-icons/fa';
import { useNavigate } from 'react-router';
import { buildPokemonCatalogPath } from '@/pages/Pokemon/utils/pokemonCatalogNavigation';

type SearchResultNavigationInstance = 'Caught' | 'Trade' | 'Wanted';

type SearchResultRowProps = {
  className?: string;
  username?: string;
  instanceId?: string;
  distance?: number;
  navigationInstanceData: SearchResultNavigationInstance;
  pokemonDisplayName: string;
  rightColumn?: React.ReactNode;
  children: React.ReactNode;
};

const SearchResultRow: React.FC<SearchResultRowProps> = ({
  className,
  username,
  instanceId,
  distance,
  navigationInstanceData,
  pokemonDisplayName,
  rightColumn,
  children,
}) => {
  const navigate = useNavigate();
  const encodedUsername = encodeURIComponent(username ?? '');
  const listingType = navigationInstanceData.toLowerCase();
  const listingLabel =
    navigationInstanceData === 'Trade' ? 'For Trade' : navigationInstanceData;

  const handleViewListing = () => {
    navigate(
      buildPokemonCatalogPath({
        username: username ?? '',
        filter: navigationInstanceData,
      }),
      {
        state: {
          instanceId: instanceId ?? '',
          instanceData: navigationInstanceData,
          contextBackTo: '/search',
        },
      },
    );
  };

  const handleViewTrainer = () => {
    navigate(`/profile/${encodedUsername}`, {
      state: { contextBackTo: '/search' },
    });
  };

  return (
    <article
      className={[
        'list-view-row',
        'search-result-card',
        `search-result-card--${listingType}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="search-result-card__header">
        <div className="search-result-card__trainer">
          <span className="search-result-card__trainer-icon" aria-hidden="true">
            <FaUser />
          </span>
          <div>
            <span className="search-result-card__listing-type">{listingLabel}</span>
            <h3>{username || 'Unknown trainer'}</h3>
          </div>
        </div>
        {typeof distance === 'number' && Number.isFinite(distance) ? (
          <span className="search-result-card__distance">
            <FaMapMarkerAlt aria-hidden="true" />
            {distance <= 0.01 ? 'Nearby' : `${distance.toFixed(1)} km away`}
          </span>
        ) : null}
      </header>

      <div
        className={`search-result-card__content${rightColumn ? ' has-related-content' : ''}`}
      >
        <section
          aria-label={`${pokemonDisplayName} listing`}
          className="center-column search-result-card__listing"
        >
          {children}
        </section>

        {rightColumn ? (
          <aside className="right-column search-result-card__related">
            {rightColumn}
          </aside>
        ) : null}
      </div>

      <footer className="search-result-card__actions">
        <button
          className="search-result-card__trainer-action"
          onClick={handleViewTrainer}
          type="button"
        >
          View trainer
        </button>
        <button
          className="search-result-card__listing-action"
          onClick={handleViewListing}
          type="button"
        >
          {navigationInstanceData === 'Caught' ? 'View Pokémon' : 'Open listing'}
          <FaArrowRight aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
};

export default SearchResultRow;
