// EditSaveComponent.tsx

import React from 'react';
import './EditSaveComponent.css';

type Props = {
  editMode: boolean;
  toggleEditMode: () => void;
  isEditable: boolean;
  label?: string;
};

const EditSaveComponent: React.FC<Props> = ({
  editMode,
  toggleEditMode,
  isEditable,
  label,
}) => {
  if (!isEditable) return null;

  const editIcon = `/images/edit-icon.png`;
  const saveIcon = `/images/save-icon.png`;

  return (
    <div className="edit-save-container">
      <button
        type="button"
        onClick={toggleEditMode}
        className="icon-button"
        aria-label={label}
        title={label}
      >
        <img src={editMode ? saveIcon : editIcon} alt={editMode ? 'Save' : 'Edit'} />
      </button>
    </div>
  );
};

export default EditSaveComponent;
