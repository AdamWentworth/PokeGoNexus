// Favorite.tsx

import React, { useState, useEffect } from 'react';
import CollectionPriorityStar from './CollectionPriorityStar';
import './Favorite.css';
import type { PokemonInstance } from '@/types/pokemonInstance';

type FavoriteProps = {
  pokemon: {
    instanceData: Pick<PokemonInstance, 'favorite'>;
  };
  editMode: boolean;
  onFavoriteChange: (value: boolean) => void;
};

const FavoriteComponent: React.FC<FavoriteProps> = ({ pokemon, editMode, onFavoriteChange }) => {
  const [isFavorite, setIsFavorite] = useState(pokemon.instanceData.favorite);

  const toggleFavorite = () => {
    if (editMode) {
      const newFavoriteStatus = !isFavorite;
      setIsFavorite(newFavoriteStatus);
      onFavoriteChange(newFavoriteStatus);
    }
  };

  useEffect(() => {
    setIsFavorite(pokemon.instanceData.favorite);
  }, [pokemon]);

  return (
    <button
      type="button"
      className={`favorite-component ${editMode ? 'editable' : ''} ${
        isFavorite ? 'filled' : 'not-filled'
      }`}
      onClick={toggleFavorite}
      disabled={!editMode}
      aria-label={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
      aria-pressed={isFavorite}
    >
      <CollectionPriorityStar
        filled={isFavorite}
        tone={isFavorite ? 'favorite' : 'inherit'}
      />
    </button>
  );
};

export default FavoriteComponent;
