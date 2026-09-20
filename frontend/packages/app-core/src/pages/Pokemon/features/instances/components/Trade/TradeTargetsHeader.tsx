import React from 'react';
import PreferenceEditAction from './PreferenceEditAction';

interface TradeTargetsHeaderProps {
  isMirror: boolean;
  isEditable: boolean;
  editMode: boolean;
  shouldShowFewLayout: boolean;
  filtersSlot?: React.ReactNode;
  toggleEditMode: () => void;
  saveStatus?: React.ComponentProps<typeof PreferenceEditAction>['saveStatus'];
}

const TradeTargetsHeader: React.FC<TradeTargetsHeaderProps> = ({
  isMirror,
  isEditable,
  editMode,
  filtersSlot,
  toggleEditMode,
  saveStatus,
}) => (
  <div className={`top-row ${isMirror ? 'few-wanted' : ''}`}>
    {isEditable && (
      <div className="trade-target-actions">
        <div className="edit-save-container">
          <PreferenceEditAction
            editMode={editMode}
            onToggle={toggleEditMode}
            saveStatus={saveStatus}
          />
        </div>
      </div>
    )}
    <div className="trade-target-filters-inline">{filtersSlot}</div>
  </div>
);

export default TradeTargetsHeader;
