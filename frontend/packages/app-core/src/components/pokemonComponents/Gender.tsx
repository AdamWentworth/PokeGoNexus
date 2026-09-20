// Gender.tsx
import React, { useState, useEffect, useRef } from 'react';
import './Gender.css';
import { getPokemonGenders } from '@pokemongonexus/shared-domain/pokemon-gender';

type GenderOption = 'Male' | 'Female' | 'Both' | 'Any' | 'Genderless' | null;

type PokemonWithGender = {
  instanceData?: {
    gender?: string | null;
  };
  gender_rate?: string;
};

const toGenderOption = (value: unknown): GenderOption => {
  if (
    value === 'Male' ||
    value === 'Female' ||
    value === 'Both' ||
    value === 'Any' ||
    value === 'Genderless'
  ) {
    return value;
  }
  return null;
};


type Props = {
  pokemon?: PokemonWithGender;
  gender?: GenderOption;
  genderRate?: string;
  editMode?: boolean;
  searchMode?: boolean;
  onGenderChange?: (gender: GenderOption) => void;
};

const Gender: React.FC<Props> = ({
  pokemon,
  gender: initialGenderProp = null,
  genderRate: genderRateProp,
  editMode = false,
  searchMode = false,
  onGenderChange,
}) => {
  const initialGender = toGenderOption(pokemon?.instanceData?.gender ?? initialGenderProp);
  const genderRate = pokemon?.gender_rate ?? genderRateProp;

  const [gender, setGender] = useState<GenderOption>(initialGender);
  const [availableGenders, setAvailableGenders] = useState<GenderOption[]>([]);
  const didMount = useRef(false);

  useEffect(() => {
    if (genderRate) {
      const genders = getPokemonGenders(genderRate, searchMode);
      setAvailableGenders(genders);

      if (!didMount.current) {
        if (genders.length === 1 && genders[0] === 'Genderless') {
          setGender('Genderless');
          onGenderChange?.('Genderless');
        } else if (!initialGender && genders.length > 0) {
          const defaultGender = searchMode
            ? (genders.includes('Any') ? 'Any' : genders[0])
            : (genders.includes('Both') ? 'Both' : genders[0]);
          setGender(defaultGender);
          onGenderChange?.(defaultGender);
        } else {
          setGender(toGenderOption(initialGender));
        }
        didMount.current = true;
      }
    }
  }, [genderRate, initialGender, onGenderChange, searchMode]);

  const toggleGender = () => {
    if (editMode && availableGenders.length > 1) {
      const togglable = searchMode
        ? availableGenders
        : availableGenders.includes('Both')
          ? availableGenders.filter(g => g !== 'Both')
          : availableGenders;
          
      const currentIndex = togglable.indexOf(gender);
      const nextIndex = (currentIndex + 1) % togglable.length;
      const newGender = togglable[nextIndex];
      setGender(newGender);
      onGenderChange?.(newGender);
    }
  };

  const getGenderIconUrl = (): string | null => {
    if (searchMode) {
      if (gender === 'Male') return '/images/male-icon.png';
      if (gender === 'Female') return '/images/female-icon.png';
      if (gender === 'Any') return '/images/neutral-icon.png';
    } else {
      if (gender === 'Male') return '/images/male-icon.png';
      if (gender === 'Female') return '/images/female-icon.png';
      if (gender === 'Both') return '/images/neutral-icon.png';
    }
    return null;
  };

  const iconUrl = getGenderIconUrl();
  const isClickable = editMode && availableGenders.length > 1;

  if (
    (availableGenders.length === 1 && availableGenders[0] === 'Genderless') ||
    (searchMode && gender === 'Any' && !editMode)
  ) {
    return (
      <div className="gender-container" style={{ visibility: 'hidden' }} />
    );
  }

  return (
    <div
      className="gender-container"
      onClick={isClickable ? toggleGender : undefined}
      role={isClickable ? 'button' : 'img'}
      aria-label={`Gender: ${gender}`}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      {iconUrl && (
        <img src={iconUrl} alt={gender ?? ''} className="gender-icon" />
      )}
    </div>
  );
};

export default Gender;
