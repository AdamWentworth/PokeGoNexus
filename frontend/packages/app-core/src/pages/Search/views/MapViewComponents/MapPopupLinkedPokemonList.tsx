import React from 'react';

export type MapPopupLinkedEntry = {
  match?: boolean;
  form?: string;
  name?: string;
  [key: string]: unknown;
};

type MatchedPokemon = {
  currentImage?: string;
  name?: string;
  form?: string | null;
};

type MapPopupLinkedPokemonListProps = {
  title: string;
  entries?: Record<string, MapPopupLinkedEntry> | null;
  findPokemonByKey: (
    keyOrInstanceId?: string | null,
    instanceLike?: Record<string, unknown> | null,
  ) => MatchedPokemon | null;
};

const MapPopupLinkedPokemonList: React.FC<MapPopupLinkedPokemonListProps> = ({
  title,
  entries,
  findPokemonByKey,
}) => {
  if (!entries) return null;

  const resolvedEntries = Object.entries(entries).flatMap(([entryId, entry]) => {
    const matchedPokemon = findPokemonByKey(entryId, entry ?? null);
    return matchedPokemon ? [{ entryId, entry, matchedPokemon }] : [];
  });
  const visibleEntries = resolvedEntries.slice(0, 3);
  const remainingCount = Math.max(0, resolvedEntries.length - visibleEntries.length);

  if (resolvedEntries.length === 0) return null;

  return (
    <section className="map-popup-linked">
      <header className="map-popup-linked__header">
        <h4>{title}</h4>
        <strong>{resolvedEntries.length}</strong>
      </header>
      <div className="map-popup-linked__list">
        {visibleEntries.map(({ entryId, entry, matchedPokemon }) => (
          <div className="map-popup-linked__item" key={entryId}>
            <img
              src={matchedPokemon.currentImage}
              alt={matchedPokemon.name}
              className={entry?.match ? 'glowing-pokemon' : undefined}
              title={`${matchedPokemon.form ? `${matchedPokemon.form} ` : ''}${matchedPokemon.name ?? ''}`}
            />
            <span>{matchedPokemon.name || 'Unknown Pokémon'}</span>
          </div>
        ))}
      </div>
      {remainingCount > 0 ? (
        <p className="map-popup-linked__more">+{remainingCount} more</p>
      ) : null}
    </section>
  );
};

export default MapPopupLinkedPokemonList;
