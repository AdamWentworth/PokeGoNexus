// src/pages/Pokemon/components/Menus/PokemonMenu/SortMenu.tsx
import React, { useState, useEffect, CSSProperties } from 'react';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import OverlayPortal from '@/components/OverlayPortal';
import WindowOverlay from '@/components/WindowOverlay';
import CloseButton from '@/components/CloseButton';
import { SortType, SortMode } from '@/types/sort';
import './SortMenu.css';

interface SortMenuProps {
  sortType: SortType;
  setSortType: React.Dispatch<React.SetStateAction<SortType>>;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
}

const sortTypeDisplayNames: Record<SortType, string> = {
  releaseDate: 'RECENT',
  hp: 'HP',
  combatPower: 'COMBAT POWER',
  favorite: 'FAVORITE',
  number: 'NUMBER',
  name: 'NAME',
};

const getImagePath = (type: SortType): string => {
  switch (type) {
    case 'releaseDate':
      return '/images/sorting/recent.png';
    case 'favorite':
      return '/images/sorting/favorite.png';
    case 'number':
      return '/images/sorting/number.png';
    case 'hp':
      return '/images/sorting/hp.png';
    case 'name':
      return '/images/sorting/name.png';
    case 'combatPower':
      return '/images/sorting/cp.png';
    default:
      return '/images/sorting/number.png';
  }
};

const SortMenu: React.FC<SortMenuProps> = ({
  sortType,
  setSortType,
  sortMode,
  setSortMode,
}) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const getArrowStyle = (): CSSProperties => ({
    transform: sortMode === 'ascending' ? 'rotate(0deg)' : 'rotate(180deg)',
    transition: 'transform 0.2s',
  });

  const handleToggleSortMenu = () => {
    if (isMenuVisible) {
      setIsAnimating(false);
    } else {
      setIsMenuVisible(true);
      setTimeout(() => setIsAnimating(true), 10);
    }
  };

  const handleSortTypeChange = (newSortType: SortType) => {
    if (sortType === newSortType) {
      setSortMode(sortMode === 'ascending' ? 'descending' : 'ascending');
    } else {
      setSortType(newSortType);
      setSortMode(newSortType === 'favorite' ? 'descending' : 'ascending');
    }
    setIsAnimating(false);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsAnimating(false);
    }
  };

  useEffect(() => {
    if (!isAnimating && isMenuVisible) {
      const timer = setTimeout(
        () => setIsMenuVisible(false),
        collectionExperienceParityContract.sortMenuMotion.overlayTransitionMs,
      );
      return () => clearTimeout(timer);
    }
  }, [isAnimating, isMenuVisible]);

  return (
    <>
      {/* Sort Overlay Button */}
      <div className="sort-overlay">
        <button onClick={handleToggleSortMenu} className="sort-button">
          <div className="icon-circle sort-type-circle">
            <img
              src={getImagePath(sortType)}
              alt={sortTypeDisplayNames[sortType]}
              className="sort-button-img"
            />
          </div>
          <div className="icon-circle sort-mode-circle">
            <img
              src="/images/sorting/arrow.png"
              alt="Sort Direction"
              className="sort-arrow-img"
              style={getArrowStyle()}
            />
          </div>
        </button>
      </div>

      {/* Sort Menu */}
      {isMenuVisible && (
        <OverlayPortal
          backBehavior="mobile"
          onClose={() => setIsAnimating(false)}
        >
          <div
            className={`sort-menu-overlay ${isAnimating ? 'visible' : ''}`}
            onClick={handleBackdropClick}
          >
            <WindowOverlay
              onClose={() => setIsAnimating(false)}
              className="sort-menu-content"
            >
              <div className={`sort-menu ${isAnimating ? 'open' : ''}`}>
                {(
                  [
                    'releaseDate',
                    'favorite',
                    'number',
                    'hp',
                    'name',
                    'combatPower',
                  ] as SortType[]
                ).map((type, i) => (
                  <button
                    key={type}
                    onClick={() => handleSortTypeChange(type)}
                    className="sort-type-button"
                    style={{ transitionDelay: `${i * 0.05}s` }}
                  >
                    <span className="sort-type-text">
                      {sortTypeDisplayNames[type]}
                    </span>
                    <img
                      className="sort-type-image"
                      src={getImagePath(type)}
                      alt={sortTypeDisplayNames[type]}
                    />
                    {sortType === type ? (
                      <img
                        className="sort-type-arrow"
                        src="/images/sorting/arrow.png"
                        alt="Sort Direction"
                        style={getArrowStyle()}
                      />
                    ) : (
                      <span className="sort-type-arrow" />
                    )}
                  </button>
                ))}
              </div>
              <CloseButton
                onClick={() => setIsAnimating(false)}
                className="sort-menu-close-button"
              />
            </WindowOverlay>
          </div>
        </OverlayPortal>
      )}
    </>
  );
};

export default React.memo(SortMenu);
