import React, { useMemo } from 'react';

import type { UseVariantSearchControllerResult } from './useVariantSearchController';
import VariantSearchInput, {
  type PokemonSearchSuggestion,
} from './VariantSearchInput';
import SelectedPokemonPreview from './SelectedPokemonPreview';
import type { PokemonVariant } from '@/types/pokemonVariants';

type VariantSearchPrimaryInputProps = {
  controller: UseVariantSearchControllerResult;
  dynamax: boolean;
  gigantamax: boolean;
  pokemon: string;
  pokemonCache: PokemonVariant[] | null;
};

export const VariantSearchPrimaryInput: React.FC<
  VariantSearchPrimaryInputProps
> = ({ controller, dynamax, gigantamax, pokemon, pokemonCache }) => {
  const hasPreview = Boolean(controller.imageUrl && !controller.imageError);
  const suggestionOptions = useMemo<PokemonSearchSuggestion[]>(
    () =>
      controller.suggestions.map((name) => {
        const representative = pokemonCache?.find(
          (variant) => variant.name.toLowerCase() === name.toLowerCase(),
        );
        const types = [
          representative?.type1_name,
          representative?.type2_name,
        ].filter((type): type is string => Boolean(type));

        return {
          imageUrl:
            representative?.image_url || representative?.currentImage || null,
          name,
          pokedexNumber: representative?.pokedex_number,
          types,
        };
      }),
    [controller.suggestions, pokemonCache],
  );

  return (
    <div className="search-primary-pokemon-field">
      <label htmlFor="pokemon-search-primary-input">Pokémon</label>
      <div
        className={`search-primary-pokemon-control${hasPreview ? ' has-preview' : ''}`}
      >
        <SelectedPokemonPreview
          controller={controller}
          dynamax={dynamax}
          gigantamax={gigantamax}
          pokemon={pokemon}
        />
        <VariantSearchInput
          inputId="pokemon-search-primary-input"
          pokemon={pokemon}
          suggestions={suggestionOptions}
          onClear={controller.handleClearPokemon}
          onDismissSuggestions={controller.handleInputBlur}
          onPokemonChange={controller.handlePokemonChange}
          onInputFocus={controller.handleInputFocus}
          onInputBlur={controller.handleInputBlur}
          onSuggestionClick={controller.handleSuggestionClick}
        />
      </div>
    </div>
  );
};
