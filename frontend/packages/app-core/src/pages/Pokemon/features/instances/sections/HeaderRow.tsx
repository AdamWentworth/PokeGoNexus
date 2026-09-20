import React from 'react';
import './HeaderRow.css';
import EditSaveComponent from '@/components/EditSaveComponent';
import CP from '@/components/pokemonComponents/CP';
import FavoriteComponent from '@/components/pokemonComponents/Favorite';

interface HeaderRowProps {
  editMode: boolean;
  toggleEditMode: () => void | Promise<void>;
  isEditable: boolean;
  cp: string | number;
  isFavorite?: boolean;
  onCPChange: (value: string) => void;
  onFavoriteChange: (value: boolean) => void;
  showFavorite?: boolean;
  showCP?: boolean;
  rightSlot?: React.ReactNode;
}

const HeaderRow: React.FC<HeaderRowProps> = ({
  editMode,
  toggleEditMode,
  isEditable,
  cp,
  isFavorite = false,
  onCPChange,
  onFavoriteChange,
  showFavorite = true,
  showCP = true,
  rightSlot,
}) => (
  <div className="top-row">
    <EditSaveComponent
      editMode={editMode}
      toggleEditMode={toggleEditMode}
      isEditable={isEditable}
    />

    {showCP ? (
      <div className="cp-component-container">
        <CP editMode={editMode} onCPChange={onCPChange} cp={cp} />
      </div>
    ) : null}

    {rightSlot ?? (showFavorite ? (
      <FavoriteComponent
        pokemon={{ instanceData: { favorite: isFavorite } }}
        editMode={editMode}
        onFavoriteChange={onFavoriteChange}
      />
    ) : (
      <div className="top-row-favorite-spacer" aria-hidden="true" />
    ))}
  </div>
);

export default HeaderRow;
