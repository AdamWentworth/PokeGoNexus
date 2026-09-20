// HeaderUI.tsx

import React, { useRef, useState, useEffect } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import './HeaderUI.css';
import type { ActiveView } from '../../utils/pokemonPageHelpers';

export interface HeaderUIProps {
  onWishlistClick: () => void;
  onHaveTagsClick: () => void;
  onPokemonClick: () => void;
  catalogOwner?: string;
  onReturnToContext?: () => void;
  totalPokemon: number;
  highlightedCards?: Set<string | number>;
  onClearSelection: () => void;
  onSelectAll: () => void;
  activeView: ActiveView;
  haveTagsSubLabel?: string;
  wishlistSubLabel?: string;
}

const HeaderUI: React.FC<HeaderUIProps> = ({
  onWishlistClick,
  onHaveTagsClick,
  onPokemonClick,
  catalogOwner,
  onReturnToContext,
  totalPokemon,
  highlightedCards,
  onClearSelection,
  onSelectAll,
  activeView,
  haveTagsSubLabel,
  wishlistSubLabel,
}) => {
  const hasSelection = Boolean(highlightedCards && highlightedCards.size > 0);

  // Refs for header and each column
  const headerRef = useRef<HTMLElement>(null);         // ← use HTMLElement here
  const colRef0 = useRef<HTMLDivElement>(null);
  const colRef1 = useRef<HTMLDivElement>(null);
  const colRef2 = useRef<HTMLDivElement>(null);

  const [underlineLeft, setUnderlineLeft] = useState(0);

  const isHaveTagsActive = activeView === 'inventory';
  const isPokemonActive = activeView === 'pokemon';
  const isWishlistActive = activeView === 'wishlist';
  const activeIndex = isHaveTagsActive ? 0 : isPokemonActive ? 1 : 2;

  useEffect(() => {
    const updateUnderline = () => {
      const activeCol =
        activeIndex === 0 ? colRef0.current : activeIndex === 1 ? colRef1.current : colRef2.current;
      const headerEl = headerRef.current;
      if (!activeCol || !headerEl) return;

      const colRect = activeCol.getBoundingClientRect();
      const headerRect = headerEl.getBoundingClientRect();
      const colCenter = colRect.left + colRect.width / 2;
      setUnderlineLeft(colCenter - headerRect.left);
    };

    updateUnderline();
    window.addEventListener('resize', updateUnderline);
    return () => window.removeEventListener('resize', updateUnderline);
  }, [activeIndex]);

  const headerClassName = `header${hasSelection ? ' header-fast-select' : ''}`;

  const renderHaveTagsToggle = () => {
    if (hasSelection) {
      return (
        <div className="free-toggle" onClick={onClearSelection}>
          <span className="free-toggle-text">X</span>
        </div>
      );
    }

    return (
      <div className="toggle-button" onClick={onHaveTagsClick}>
        <span className={`toggle-text ${isHaveTagsActive ? 'active' : ''}`}>
          TAGS
        </span>

        {haveTagsSubLabel && (
          <span className={`toggle-text toggle-subtext ${isHaveTagsActive ? 'active' : ''}`}>
            {haveTagsSubLabel}
          </span>
        )}
      </div>
    );
  };

  const renderWishlistToggle = () => {
    if (hasSelection) {
      return (
        <div className="free-toggle" onClick={onSelectAll}>
          <span className="free-toggle-text">SELECT ALL</span>
        </div>
      );
    }
    return (
      <div className="toggle-button" onClick={onWishlistClick}>
        <span className={`toggle-text ${isWishlistActive ? 'active' : ''}`}>
          WISHLIST
        </span>
        {wishlistSubLabel && (
          <span className={`toggle-text toggle-subtext ${isWishlistActive ? 'active' : ''}`}>
            {wishlistSubLabel}
          </span>
        )}
      </div>
    );
  };

  return (
    <header className={headerClassName} ref={headerRef}>
      {!hasSelection && catalogOwner && (
        <div className="catalog-context">
          {onReturnToContext ? (
            <button
              className="catalog-context-back"
              onClick={onReturnToContext}
              type="button"
            >
              <FaArrowLeft aria-hidden="true" />
              <span>Back to results</span>
            </button>
          ) : null}
          <div
            className="catalog-owner"
            role="status"
            aria-label={`Viewing ${catalogOwner}'s catalog`}
          >
            <span className="catalog-owner-label">Viewing catalog</span>
            <strong className="catalog-owner-username">{catalogOwner}</strong>
          </div>
        </div>
      )}

      <div className="controls-row">
        <div className="toggle-col" ref={colRef0}>
          {renderHaveTagsToggle()}
        </div>

        <div className="toggle-col" ref={colRef1} onClick={onPokemonClick}>
          <div className="toggle-button">
            <span className={`toggle-text ${isPokemonActive ? 'active' : ''}`}>
              Pokémon
            </span>
            <span className={`toggle-text ${isPokemonActive ? 'active' : ''}`}>
              ({totalPokemon})
            </span>
          </div>
        </div>

        <div className="toggle-col" ref={colRef2}>
          {renderWishlistToggle()}
        </div>
      </div>

      <div
        className="header-underline"
        style={{ left: underlineLeft }}
      />
    </header>
  );
};

export default React.memo(HeaderUI);
