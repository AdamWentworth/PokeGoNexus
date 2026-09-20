// FriendshipLevel.tsx

import React from 'react';
import './FriendshipLevel.css';

type FriendshipLevelProps = {
  level: number;
  prefLucky: boolean;
};

const FriendshipLevel: React.FC<FriendshipLevelProps> = ({ level, prefLucky }) => {
  const hearts = [];

  for (let i = 0; i < 5; i++) {
    hearts.push(
      <img
        key={`heart-${i}`}
        src={`/images/${i < level ? 'heart-filled' : 'heart-unfilled'}.png`}
        alt={`Friendship Level ${i < level ? 'Filled' : 'Unfilled'}`}
        title={i === 4 ? 'Forever Friends — remote trade eligible' : undefined}
        className="heart"
      />
    );
  }

  return (
    <div className="hearts-lucky-container">
      <div
        className="hearts"
        aria-label={`${Math.min(Math.max(level, 0), 5)} of 5 friendship hearts${level >= 5 ? ', Forever Friends remote trade eligible' : ''}`}
      >
        {hearts}
      </div>
      <img
        src="/images/lucky_friend_icon.png"
        alt="Lucky Friend"
        className={`lucky-icon ${prefLucky ? '' : 'grey-out'}`}
      />
    </div>
  );
};

export default FriendshipLevel;
