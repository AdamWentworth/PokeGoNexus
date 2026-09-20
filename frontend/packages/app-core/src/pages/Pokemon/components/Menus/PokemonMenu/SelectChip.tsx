// SelectChip.tsx
import React from 'react';
import './SelectChip.css';

interface SelectChipProps {
  selected: boolean;
  /** kept for backward-compat; ignored */
  tooltip?: string;
  labelSelected?: string;
  labelUnselected?: string;
  /** hover reveal delay (ms) */
  delayMs?: number;
  onToggle: () => void;
  className?: string;
}

type CSSVars = React.CSSProperties & { ['--reveal-delay']?: string };

const SelectChip: React.FC<SelectChipProps> = ({
  selected,
  labelSelected = 'Selected',
  labelUnselected = 'Select',
  delayMs = 500,
  onToggle,
  className = '',
}) => {
  const style: CSSVars = { ['--reveal-delay']: `${delayMs}ms` };

  return (
    <span
      className={`select-chip ${selected ? 'selected' : ''} ${className}`}
      aria-hidden="true"
      // prevent mouse clicks from leaving focus (so chip won’t “stick” via focus)
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={style}
    >
      <span className="select-chip-icon">✓</span>
      <span className="select-chip-text">
        {selected ? labelSelected : labelUnselected}
      </span>
    </span>
  );
};

export default SelectChip;
