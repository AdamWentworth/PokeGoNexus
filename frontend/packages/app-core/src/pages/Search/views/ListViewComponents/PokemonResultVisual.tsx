import React from 'react';

import Gender from '@/components/pokemonComponents/Gender';

export type PokemonResultGender = React.ComponentProps<typeof Gender>['gender'];

const allowedGenders: NonNullable<PokemonResultGender>[] = [
  'Male',
  'Female',
  'Both',
  'Any',
  'Genderless',
];

export const toPokemonResultGender = (
  gender?: string | null,
): PokemonResultGender =>
  gender && allowedGenders.includes(gender as NonNullable<PokemonResultGender>)
    ? (gender as PokemonResultGender)
    : null;

type PokemonResultVisualProps = {
  imageUrl?: string | null;
  pokemonDisplayName: string;
  genderValue: PokemonResultGender;
  lucky?: boolean;
  wrapLuckyBackdrop?: boolean;
  dynamax?: boolean;
  gigantamax?: boolean;
  nameLayout?: 'inline' | 'stacked';
  beforeImage?: React.ReactNode;
};

const PokemonResultVisual: React.FC<PokemonResultVisualProps> = ({
  imageUrl,
  pokemonDisplayName,
  genderValue,
  lucky = false,
  wrapLuckyBackdrop = false,
  dynamax = false,
  gigantamax = false,
  nameLayout = 'inline',
  beforeImage,
}) => {
  const luckyImage = (
    <img src="/images/lucky.png" alt="Lucky backdrop" className="lucky-backdrop" />
  );

  return (
    <div
      className={`pokemon-image-container${beforeImage ? ' pokemon-image-container--with-detail' : ''}`}
    >
      {beforeImage}
      {lucky &&
        (wrapLuckyBackdrop ? (
          <div className="lucky-backdrop-wrapper">{luckyImage}</div>
        ) : (
          luckyImage
        ))}
      {imageUrl ? (
        <img src={imageUrl} alt={pokemonDisplayName} className="pokemon-image" />
      ) : (
        <span className="pokemon-image-unavailable">Image unavailable</span>
      )}
      {dynamax && (
        <img src="/images/dynamax.png" alt="Dynamax Badge" className="max-badge" />
      )}
      {gigantamax && (
        <img
          src="/images/gigantamax.png"
          alt="Gigantamax Badge"
          className="max-badge"
        />
      )}
      {nameLayout === 'stacked' ? (
        <div className="pokemon-name">
          <p>{pokemonDisplayName}</p>
          {genderValue ? <Gender gender={genderValue} /> : null}
        </div>
      ) : (
        <div className="pokemon-name">
          {pokemonDisplayName}
          {genderValue ? <Gender gender={genderValue} /> : null}
        </div>
      )}
    </div>
  );
};

export default PokemonResultVisual;
