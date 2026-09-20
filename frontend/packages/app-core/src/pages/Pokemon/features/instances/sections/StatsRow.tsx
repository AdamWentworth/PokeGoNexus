import React from 'react';
import './StatsRow.css';
import Weight from '@/components/pokemonComponents/Weight';
import Types from '@/components/pokemonComponents/Types';
import Height from '@/components/pokemonComponents/Height';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';

type PokemonWithInstance = {
  type1_name?: PokemonVariant['type1_name'];
  type2_name?: PokemonVariant['type2_name'];
  type_1_icon?: PokemonVariant['type_1_icon'];
  type_2_icon?: PokemonVariant['type_2_icon'];
  sizes?: PokemonVariant['sizes'];
  instanceData?: Pick<PokemonInstance, 'weight' | 'height'>;
};

interface StatsRowProps {
  pokemon: PokemonWithInstance;
  editMode: boolean;
  onWeightChange: (value: string | number) => void;
  onHeightChange: (value: string | number) => void;
  addBottomGap?: boolean;
  showTypes?: boolean;
}

const StatsRow: React.FC<StatsRowProps> = ({
  pokemon,
  editMode,
  onWeightChange,
  onHeightChange,
  addBottomGap = false,
  showTypes = true,
}) => {
  const showWeight = editMode || Boolean(pokemon.instanceData?.weight);
  const showHeight = editMode || Boolean(pokemon.instanceData?.height);
  if (!showWeight && !showTypes && !showHeight) return null;

  const containerClassName = `weight-type-height-container${
    !showWeight && !showHeight && showTypes ? ' only-type' : ''
  }${!showTypes ? ' without-types' : ''
  }${addBottomGap ? ' terminal-spacing' : ''}`;

  return (
    <div className={containerClassName}>
      {showWeight ? (
        <div className="weight-container">
          <Weight
            pokemon={pokemon}
            editMode={editMode}
            onWeightChange={onWeightChange}
          />
        </div>
      ) : null}
      {showWeight && showTypes ? (
        <span className="stats-pipe" aria-hidden="true">
          |
        </span>
      ) : null}
      {showTypes ? <Types pokemon={pokemon} /> : null}
      {showTypes && showHeight ? (
        <span className="stats-pipe" aria-hidden="true">
          |
        </span>
      ) : null}
      {showHeight ? (
        <div className="height-container">
          <Height
            pokemon={pokemon}
            editMode={editMode}
            onHeightChange={onHeightChange}
          />
        </div>
      ) : null}
    </div>
  );
};

export default StatsRow;
