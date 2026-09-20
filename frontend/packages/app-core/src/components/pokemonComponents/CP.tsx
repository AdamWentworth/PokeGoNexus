// CP.tsx

import React, { useRef } from 'react';
import './CP.css';

type Props = {
  cp: string | number | null;
  editMode: boolean;
  onCPChange: (value: string) => void;
  errors?: {
    cp?: string;
  };
};

const CP: React.FC<Props> = ({ cp, editMode, onCPChange, errors = {} }) => {
  const editableRef = useRef<HTMLInputElement>(null);
  const cpString = cp != null ? cp.toString() : '';

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.currentTarget.value;
    if (/^\d{0,5}$/.test(newValue)) {
      onCPChange(newValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      editableRef.current?.blur();
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onCPChange(event.currentTarget.value.trim());
  };

  if ((!cpString || cpString.trim() === '') && !editMode) {
    return (
      <div className="cp-unified-container">
        <div className="cp-unified-display" style={{ visibility: 'hidden' }}>
          <span className="cp-label">CP</span>
          <span className="cp-value">000</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cp-unified-container"
      onClick={() => {
        if (editMode && editableRef.current) {
          editableRef.current.focus();
        }
      }}
    >
      <div className="cp-unified-display">
        <span className="cp-label">CP</span>
        {editMode ? (
          <div className="cp-editable-container editable">
            <input
              aria-label="Combat Power"
              autoComplete="off"
              inputMode="numeric"
              maxLength={5}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              pattern="[0-9]*"
              ref={editableRef}
              className="cp-editable-content"
              style={{ '--cp-character-count': Math.max(1, cpString.length) } as React.CSSProperties}
              type="text"
              value={cpString}
            />
          </div>
        ) : (
          <span className="cp-value">{cpString}</span>
        )}
      </div>
      {!editMode && errors.cp && <div className="error">{errors.cp}</div>}
    </div>
  );
};

export default CP;
