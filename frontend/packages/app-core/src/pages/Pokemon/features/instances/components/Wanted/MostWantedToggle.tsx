import React from 'react';
import CollectionPriorityStar from '@/components/pokemonComponents/CollectionPriorityStar';
import './MostWantedToggle.css';

interface MostWantedToggleProps {
  active: boolean;
  editMode: boolean;
  onChange: (active: boolean) => void;
}

const MostWantedToggle: React.FC<MostWantedToggleProps> = ({
  active,
  editMode,
  onChange,
}) => {
  const actionLabel = active ? 'Remove from Most Wanted' : 'Mark as Most Wanted';

  return (
    <button
      type="button"
      className={`most-wanted-toggle${active ? ' is-active' : ''}`}
      aria-label={editMode ? actionLabel : active ? 'Most Wanted' : 'Not marked Most Wanted'}
      aria-pressed={active}
      disabled={!editMode}
      title={editMode ? actionLabel : active ? 'Most Wanted' : 'Edit this listing to mark it Most Wanted'}
      onClick={() => onChange(!active)}
    >
      <CollectionPriorityStar
        className="most-wanted-toggle__star"
        filled={active}
        tone={active ? 'most-wanted' : 'inherit'}
      />
      <span className="most-wanted-toggle__label">Most Wanted</span>
    </button>
  );
};

export default MostWantedToggle;
