import React from 'react';

import './PokemonArtwork.css';

type PokemonArtworkProps = {
  alt: string;
  className?: string;
  decoding?: 'async' | 'auto' | 'sync';
  dynamax?: boolean;
  gigantamax?: boolean;
  imageClassName?: string;
  imageUrl: string;
  loading?: 'eager' | 'lazy';
  onError?: React.ReactEventHandler<HTMLImageElement>;
};

const joinClassNames = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(' ');

const PokemonArtwork: React.FC<PokemonArtworkProps> = ({
  alt,
  className,
  decoding = 'async',
  dynamax = false,
  gigantamax = false,
  imageClassName,
  imageUrl,
  loading,
  onError,
}) => {
  const maxForm = gigantamax ? 'gigantamax' : dynamax ? 'dynamax' : null;

  return (
    <div className={joinClassNames('pokemon-artwork', className)}>
      <img
        alt={alt}
        className={joinClassNames('pokemon-artwork__image', imageClassName)}
        decoding={decoding}
        draggable={false}
        loading={loading}
        onError={onError}
        src={imageUrl}
      />
      {maxForm ? (
        <img
          alt={maxForm === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
          className="pokemon-artwork__max-badge"
          decoding="async"
          draggable={false}
          src={`/images/${maxForm}.png`}
        />
      ) : null}
    </div>
  );
};

export default PokemonArtwork;
