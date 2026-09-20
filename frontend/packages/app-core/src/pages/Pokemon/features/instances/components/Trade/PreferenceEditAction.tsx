import React from 'react';

type PreferenceEditActionProps = {
  editMode: boolean;
  onToggle: () => void;
  saveStatus?: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
};

const PreferenceEditAction: React.FC<PreferenceEditActionProps> = ({
  editMode,
  onToggle,
  saveStatus = 'idle',
}) => (
  <button
    type="button"
    className={`preference-edit-action ${editMode ? 'is-saving-action' : ''}`}
    onClick={onToggle}
  >
    <img
      src={editMode ? '/images/save-icon.png' : '/images/edit-icon.png'}
      alt=""
    />
    <span className="preference-edit-action__label">
      {saveStatus === 'saving'
        ? 'Saving…'
        : saveStatus === 'saved'
          ? 'Saved'
          : saveStatus === 'error'
            ? 'Save failed — edit again'
            : editMode
              ? 'Save changes'
              : 'Edit preferences'}
    </span>
    {saveStatus === 'dirty' ? (
      <small className="preference-edit-action__status">Unsaved</small>
    ) : null}
  </button>
);

export default PreferenceEditAction;
