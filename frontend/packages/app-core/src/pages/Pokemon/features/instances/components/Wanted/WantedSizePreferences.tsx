import React from 'react';
import './WantedSizePreferences.css';

import type { WantedSizePreference } from './wantedSizePreferences';

const SIZE_OPTIONS: Array<{
  value: WantedSizePreference;
  label: string;
}> = [
  { value: 'XXS', label: 'XXS' },
  { value: 'XS', label: 'XS' },
  { value: null, label: 'Any' },
  { value: 'XL', label: 'XL' },
  { value: 'XXL', label: 'XXL' },
];

interface SizePreferenceGroupProps {
  label: 'Weight' | 'Height';
  icon: string;
  value: WantedSizePreference;
  editMode: boolean;
  onChange: (value: WantedSizePreference) => void;
}

const SizePreferenceGroup: React.FC<SizePreferenceGroupProps> = ({
  label,
  icon,
  value,
  editMode,
  onChange,
}) => {
  if (!editMode && value == null) return null;

  return (
    <div className="wanted-size-preference">
      <div className="wanted-size-preference__label">
        <img src={icon} alt="" aria-hidden="true" />
        <span>{label}</span>
      </div>
      {editMode ? (
        <div
          className="wanted-size-preference__options"
          role="group"
          aria-label={`Wanted ${label.toLowerCase()}`}
        >
          {SIZE_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.label}
                type="button"
                className={`wanted-size-preference__option${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                aria-label={`${option.label} ${label.toLowerCase()}`}
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : (
        <span className="wanted-size-preference__value">{value}</span>
      )}
    </div>
  );
};

interface WantedSizePreferencesProps {
  weight: WantedSizePreference;
  height: WantedSizePreference;
  editMode: boolean;
  onWeightChange: (value: WantedSizePreference) => void;
  onHeightChange: (value: WantedSizePreference) => void;
}

const WantedSizePreferences: React.FC<WantedSizePreferencesProps> = ({
  weight,
  height,
  editMode,
  onWeightChange,
  onHeightChange,
}) => {
  if (!editMode && weight == null && height == null) return null;

  return (
    <div className={`wanted-size-preferences${editMode ? ' is-editing' : ''}`}>
      <SizePreferenceGroup
        label="Weight"
        icon="/images/weight.png"
        value={weight}
        editMode={editMode}
        onChange={onWeightChange}
      />
      <SizePreferenceGroup
        label="Height"
        icon="/images/height.png"
        value={height}
        editMode={editMode}
        onChange={onHeightChange}
      />
    </div>
  );
};

export default WantedSizePreferences;

