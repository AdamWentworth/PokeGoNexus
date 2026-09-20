import React from 'react';
import './BackgroundSelector.css';

interface BackgroundSelectorProps {
  canPick: boolean;
  editMode: boolean;
  onToggle: () => void;
  variant?: 'row' | 'header';
}

const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({
  canPick,
  editMode,
  onToggle,
  variant = 'row',
}) => {
  if (!canPick || !editMode) return null;
  return (
    <div
      className={`background-select-row background-select-row--${variant} active`}
    >
      <button
        type="button"
        className="background-select-button"
        aria-label="Choose special background"
        onClick={onToggle}
      >
        <img
          src="/images/location.png"
          alt=""
          className="background-icon"
        />
      </button>
    </div>
  );
};

export default BackgroundSelector;
