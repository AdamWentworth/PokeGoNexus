import React, { useEffect, useId, useState } from 'react';
import { FaTimes } from 'react-icons/fa';

export type PokemonSearchSuggestion = {
  imageUrl?: string | null;
  name: string;
  pokedexNumber?: number | null;
  types?: string[];
};

interface VariantSearchInputProps {
  inputId?: string;
  pokemon: string;
  suggestions: PokemonSearchSuggestion[];
  onPokemonChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  onClear: () => void;
  onDismissSuggestions: () => void;
  onSuggestionClick: (suggestion: string) => void;
}

const formatPokedexNumber = (value?: number | null): string | null => {
  if (!Number.isFinite(value)) return null;
  return `#${String(value).padStart(4, '0')}`;
};

const VariantSearchInput: React.FC<VariantSearchInputProps> = ({
  inputId,
  pokemon,
  suggestions,
  onPokemonChange,
  onInputFocus,
  onInputBlur,
  onClear,
  onDismissSuggestions,
  onSuggestionClick,
}) => {
  const generatedId = useId();
  const resolvedInputId = inputId ?? `${generatedId}-input`;
  const listboxId = `${resolvedInputId}-suggestions`;
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [suggestions]);

  const chooseSuggestion = (index: number) => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    onSuggestionClick(suggestion.name);
    setActiveSuggestionIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && suggestions.length > 0) {
      event.preventDefault();
      onDismissSuggestions();
      setActiveSuggestionIndex(-1);
      return;
    }

    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(activeSuggestionIndex);
    }
  };

  return (
    <div className="pokemon-search-row">
      <div className="pokemon-search-input-control">
        <input
          aria-activedescendant={
            activeSuggestionIndex >= 0
              ? `${listboxId}-${activeSuggestionIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={suggestions.length > 0 ? listboxId : undefined}
          aria-expanded={suggestions.length > 0}
          autoComplete="off"
          id={resolvedInputId}
          onBlur={onInputBlur}
          onChange={onPokemonChange}
          onFocus={onInputFocus}
          onKeyDown={handleKeyDown}
          placeholder="Enter Pokemon name"
          role="combobox"
          type="text"
          value={pokemon}
        />
        {pokemon ? (
          <button
            aria-label="Clear Pokémon"
            className="pokemon-search-input-clear"
            onClick={onClear}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            <FaTimes aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div
          aria-label="Pokémon suggestions"
          className="autocomplete-suggestions"
          id={listboxId}
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
          tabIndex={-1}
        >
          {suggestions.map((suggestion, index) => {
            const pokedexNumber = formatPokedexNumber(
              suggestion.pokedexNumber,
            );
            const typeLabel = suggestion.types?.filter(Boolean).join(' · ');

            return (
              <button
                aria-selected={activeSuggestionIndex === index}
                className="autocomplete-suggestion-button"
                id={`${listboxId}-${index}`}
                key={suggestion.name}
                onClick={() => chooseSuggestion(index)}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                role="option"
                type="button"
              >
                <span className="autocomplete-suggestion-visual">
                  {suggestion.imageUrl ? (
                    <img alt="" src={suggestion.imageUrl} />
                  ) : (
                    <span aria-hidden="true">?</span>
                  )}
                </span>
                <span className="autocomplete-suggestion-copy">
                  <strong>{suggestion.name}</strong>
                  {typeLabel ? <small>{typeLabel}</small> : null}
                </span>
                {pokedexNumber ? (
                  <span className="autocomplete-suggestion-number">
                    {pokedexNumber}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default VariantSearchInput;
