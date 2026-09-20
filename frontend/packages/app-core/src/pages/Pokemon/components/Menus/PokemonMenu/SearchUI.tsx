// SearchUI.tsx

import React, { useState, useEffect, type ChangeEvent } from 'react';
import './SearchUI.css';

export interface SearchUIProps {
  /** current search term from parent state */
  searchTerm: string;
  /** callback when search term should update */
  onSearchChange: (value: string) => void;
  /** whether to show the evolutionary line checkbox */
  showEvolutionaryLine: boolean;
  /** handler for evolutionary line checkbox change */
  toggleEvolutionaryLine: () => void;
  /** optional callback when input focus changes */
  onFocusChange?: (isFocused: boolean) => void;
  /** optional handler when arrow icon is clicked */
  onArrowClick?: () => void;
}

const SearchUI: React.FC<SearchUIProps> = ({
  searchTerm,
  onSearchChange,
  showEvolutionaryLine,
  toggleEvolutionaryLine,
  onFocusChange,
  onArrowClick,
}) => {
  const [inputValue, setInputValue] = useState<string>(searchTerm);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  // Sync local input when external searchTerm changes
  useEffect(() => {
    setInputValue((current) => (current === searchTerm ? current : searchTerm));
  }, [searchTerm]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onSearchChange(value);
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocusChange?.(true);
  };

  const handleClearInput = () => {
    setInputValue('');
    onSearchChange('');
    onFocusChange?.(true);
    setIsFocused(true);
  };

  const handleArrowClick = () => {
    setIsFocused(false);
    onFocusChange?.(false);
    onArrowClick?.();
  };

  const getLayoutClass = (): string => {
    if (inputValue.trim() !== '') return 'search-layout--with-text';
    if (isFocused) return 'search-layout--focused';
    return 'search-layout--base';
  };

  const layoutClass = getLayoutClass();

  return (
    <div className={`header-section search-section ${layoutClass}`}>
      <div className="search-row">
        <div className="arrow-input-wrapper">
          <img
            src="/images/arrow_right.png"
            alt="Arrow Left"
            className="arrow-icon"
            onClick={handleArrowClick}
          />

          <div className="search-input-wrapper">
            <input
              type="text"
              value={inputValue}
              aria-label="Search Pokémon"
              onFocus={handleFocus}
              onChange={handleInputChange}
              className="search-input"
            />
            {inputValue.trim() !== '' && (
              <div className="clear-button-container" onClick={handleClearInput}>
                <img src="/images/close.png" alt="Clear input" className="clear-icon" />
              </div>
            )}
            <img
              src="/images/search_icon.png"
              alt="Search Icon"
              className="search-icon-left"
            />
            {layoutClass === 'search-layout--base' && (
              <div className="placeholder-container">
                <img
                  src="/images/search_icon.png"
                  alt="Search Icon"
                  className="search-icon"
                />
                <span className="placeholder-text">Search</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {inputValue.trim() !== '' && (
        <label className="evo-line-checkbox">
          <div className="checkbox-container">
            <input
              id="evolutionaryLineCheckbox"
              type="checkbox"
              className="evo-checkbox"
              checked={showEvolutionaryLine}
              onChange={() => toggleEvolutionaryLine()}
            />
            <span className="evo-line-custom-checkbox" />
          </div>
          SHOW EVOLUTIONARY LINE
        </label>
      )}
    </div>
  );
};

export default SearchUI;
