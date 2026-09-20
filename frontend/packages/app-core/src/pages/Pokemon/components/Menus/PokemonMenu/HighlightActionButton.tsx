import React from 'react';
import { FaPlus, FaTags } from 'react-icons/fa';

import './HighlightActionButton.css';

export interface HighlightActionButtonProps {
  action: 'add' | 'organize';
  count: number;
  isUpdating: boolean;
  onOpen: () => void;
}

const HighlightActionButton: React.FC<HighlightActionButtonProps> = ({
  action,
  count,
  isUpdating,
  onOpen,
}) => (
  <div className="highlight-action-container">
    <button className="main-button" disabled={isUpdating} onClick={onOpen} type="button">
      {action === 'add' ? <FaPlus aria-hidden="true" /> : <FaTags aria-hidden="true" />}
      <span>{action === 'add' ? 'Add' : 'Organize'} ({count})</span>
    </button>
  </div>
);

export default React.memo(HighlightActionButton);
