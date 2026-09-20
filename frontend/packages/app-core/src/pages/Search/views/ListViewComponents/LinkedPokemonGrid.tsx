import React, { useMemo } from 'react';

export type LinkedPokemonGridEntry = {
  id: string;
  currentImage?: string;
  name?: string;
  form?: string | null;
  dynamax?: boolean;
  gigantamax?: boolean;
  match?: boolean;
};

type LinkedPokemonGridProps = {
  title: string;
  sectionClassName: string;
  gridClassName: string;
  containerClassName: string;
  imageClassName: string;
  entries: LinkedPokemonGridEntry[];
};

const LinkedPokemonGrid: React.FC<LinkedPokemonGridProps> = ({
  title,
  sectionClassName,
  gridClassName,
  containerClassName,
  imageClassName,
  entries,
}) => {
  const orderedEntries = useMemo(
    () =>
      entries
        .map((entry, originalIndex) => ({ entry, originalIndex }))
        .sort(
          (a, b) =>
            Number(Boolean(b.entry.match)) - Number(Boolean(a.entry.match)) ||
            a.originalIndex - b.originalIndex,
        )
        .map(({ entry }) => entry),
    [entries],
  );

  return (
    <div className={sectionClassName}>
      <header className="linked-pokemon-grid__header">
        <div>
          <span>Trade compatibility</span>
          <h4>{title}</h4>
        </div>
        <strong>{entries.length}</strong>
      </header>
      <div
        aria-label={`${title}: ${orderedEntries.length} Pokémon`}
        className={`${gridClassName} linked-pokemon-grid`}
        tabIndex={orderedEntries.length > 6 ? 0 : undefined}
      >
        {orderedEntries.map((entry) => (
          <div
            key={entry.id}
            className={`${containerClassName} linked-pokemon-grid__item${entry.match ? ' linked-pokemon-grid__item--match' : ''}`}
          >
            {entry.dynamax && (
              <img
                src="/images/dynamax.png"
                alt="Dynamax"
                className="linked-pokemon-grid__max-badge"
              />
            )}

            {entry.gigantamax && (
              <img
                src="/images/gigantamax.png"
                alt="Gigantamax"
                className="linked-pokemon-grid__max-badge"
              />
            )}

            <img
              src={entry.currentImage}
              alt={entry.name || 'Pokémon'}
              className={`${imageClassName} ${entry.match ? 'glowing-pokemon' : ''}`}
              title={`${entry.form ? `${entry.form} ` : ''}${entry.name ?? ''}`}
            />
            <span>{entry.name || 'Unknown Pokémon'}</span>
            {entry.match ? <small>Mutual match</small> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LinkedPokemonGrid;
