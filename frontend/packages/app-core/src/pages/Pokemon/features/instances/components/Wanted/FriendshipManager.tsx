// FriendshipManager.tsx

import React from 'react';
import './FriendshipManager.css';

interface FriendshipManagerProps {
  // Original props
  friendship?: number;
  setFriendship?: (val: number) => void;
  isLucky?: boolean;
  setIsLucky?: (val: boolean) => void;

  // New props
  friendship_level?: number;
  setFriendshipLevel?: (val: number) => void;
  pref_lucky?: boolean;
  setPrefLucky?: (val: boolean) => void;

  // Common
  editMode: boolean;
}

const FriendshipManager: React.FC<FriendshipManagerProps> = ({
  friendship,
  setFriendship,
  isLucky,
  setIsLucky,
  friendship_level,
  setFriendshipLevel,
  pref_lucky,
  setPrefLucky,
  editMode,
}) => {
  // 1) DERIVED STATE:
  const actualFriendshipLevel = 
    friendship_level !== undefined 
      ? friendship_level 
      : (friendship || 0);

  const actualIsLucky = 
    pref_lucky !== undefined 
      ? pref_lucky 
      : (isLucky || false);

  // 2) DERIVED SETTERS:
  const handleSetFriendshipLevel = (newVal: number) => {
    if (setFriendshipLevel) {
      setFriendshipLevel(newVal);
    } else if (setFriendship) {
      setFriendship(newVal);
    }
  };

  const handleSetIsLucky = (newVal: boolean) => {
    if (setPrefLucky) {
      setPrefLucky(newVal);
    } else if (setIsLucky) {
      setIsLucky(newVal);
    }
  };

  // 3) HANDLERS:
  const handleFriendshipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLevel = parseInt(e.target.value, 10);

    if (actualIsLucky && newLevel < 4) {
      handleSetIsLucky(false);
    }
    handleSetFriendshipLevel(newLevel);
  };

  const toggleLucky = () => {
    if (editMode) {
      const newLuckyStatus = !actualIsLucky;
      handleSetIsLucky(newLuckyStatus);
      if (newLuckyStatus) {
        handleSetFriendshipLevel(Math.max(actualFriendshipLevel, 4));
      }
    }
  };

  // 4) RENDER HEARTS:
  const hearts = [];
  for (let i = 0; i < 5; i++) {
    const level = i + 1;
    hearts.push(
      <button
        type="button"
        key={`heart-${i}`}
        className="heart-button"
        aria-label={`Set friendship to ${level} heart${level === 1 ? '' : 's'}${
          level === 5 ? ' and enable remote trading' : ''
        }`}
        aria-pressed={actualFriendshipLevel === level}
        disabled={!editMode}
        onClick={() => handleFriendshipChange({
          target: { value: String(level) },
        } as React.ChangeEvent<HTMLInputElement>)}
      >
        <img
          src={`/images/${i < actualFriendshipLevel ? 'heart-filled' : 'heart-unfilled'}.png`}
          alt=""
          title={i === 4 ? 'Forever Friends — remote trade eligible' : undefined}
          className="heart"
        />
      </button>
    );
  }

  return (
    <div className="friendship-level-container">
      <div className="hearts-lucky-container">
        <div
          className="hearts"
          aria-label={`${actualFriendshipLevel} of 5 friendship hearts${actualFriendshipLevel >= 5 ? ', Forever Friends remote trade eligible' : ''}`}
        >
          {hearts}
        </div>

        <img
          src={`/images/lucky_friend_icon.png`}
          alt="Lucky Friend"
          className={`lucky-icon ${actualIsLucky ? '' : 'grey-out'}`}
          onClick={toggleLucky}
          style={{ cursor: editMode ? 'pointer' : 'default' }}
          role={editMode ? 'button' : undefined}
          tabIndex={editMode ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleLucky();
            }
          }}
        />

        <img
          src="/images/remote_trade_icon.png"
          alt={
            actualFriendshipLevel >= 5
              ? 'Remote trade available'
              : 'Remote trade unlocks at five hearts'
          }
          title={
            actualFriendshipLevel >= 5
              ? 'Forever Friends — remote trade available'
              : 'Remote trade unlocks at five hearts'
          }
          className={`remote-trade-icon ${
            actualFriendshipLevel >= 5 ? '' : 'grey-out'
          }`}
        />
      </div>

      <div className="friendship-status" aria-live="polite">
        <span>{actualFriendshipLevel === 5 ? 'Remote trade available' : `${actualFriendshipLevel}/5 hearts`}</span>
        <span>{actualIsLucky ? 'Lucky trade requested' : actualFriendshipLevel >= 4 ? 'Lucky Friends eligible' : 'Lucky unlocks at 4 hearts'}</span>
      </div>

      {editMode && (
        <input
          type="range"
          min="0"
          max="5"
          value={actualFriendshipLevel}
          onChange={handleFriendshipChange}
          className="friendship-slider"
        />
      )}
    </div>
  );
};

export default FriendshipManager;
