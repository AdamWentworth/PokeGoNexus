import React from 'react';
import './LevelGenderRow.css';
import Level from '@/components/pokemonComponents/Level';
import Gender from '@/components/pokemonComponents/Gender';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';

type PokemonWithInstance = {
  gender_rate?: PokemonVariant['gender_rate'];
  instanceData?: Pick<PokemonInstance, 'gender'>;
};

interface LevelGenderRowProps {
  pokemon: PokemonWithInstance;
  editMode: boolean;
  level: number | null;
  onLevelChange: (value: string) => void;
  gender: string | null;
  onGenderChange: (value: string | null) => void;
  showLevel?: boolean;
  showGenderWhenUnset?: boolean;
  searchMode?: boolean;
}

const isGenderlessRate = (genderRate: string | undefined): boolean => {
  if (!genderRate) return false;
  const [, , genderlessRate] = genderRate.split('_');
  return Number.parseInt(genderlessRate ?? '', 10) === 100;
};

const LevelGenderRow: React.FC<LevelGenderRowProps> = ({
  pokemon,
  editMode,
  level,
  onLevelChange,
  gender,
  onGenderChange,
  showLevel = true,
  showGenderWhenUnset = false,
  searchMode = false,
}) => {
  const hasDefinedGender =
    gender !== null && gender !== '' && (!searchMode || gender !== 'Any');
  const showGender =
    showGenderWhenUnset || hasDefinedGender || isGenderlessRate(pokemon.gender_rate);

  if (!showLevel && !showGender) return null;

  return (
    <div className="level-gender-row">
      {showLevel ? (
        <Level
          editMode={editMode}
          level={level}
          onLevelChange={onLevelChange}
        />
      ) : null}
      {showGender ? (
        <div className="gender-wrapper">
          <Gender
            pokemon={pokemon}
            editMode={editMode}
            searchMode={searchMode}
            onGenderChange={onGenderChange}
          />
        </div>
      ) : null}
    </div>
  );
};

export default LevelGenderRow;
