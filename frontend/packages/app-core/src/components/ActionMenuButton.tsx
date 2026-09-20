// ActionMenuButton.tsx

import React from 'react';
import './ActionMenuButton.css';

type ActionMenuButtonProps = {
  onClick: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  ariaHidden?: boolean;
};

const ActionMenuButton: React.FC<ActionMenuButtonProps> = ({
  onClick,
  style = {},
  disabled = false,
  ariaHidden = false,
}) => {
  return (
    <button 
      className="action-menu-button" 
      type="button" 
      aria-label="Action Menu"
      aria-hidden={ariaHidden}
      disabled={disabled}
      onClick={onClick} 
      style={style}
    >
      <img
        src="/images/btn_action_menu.png"
        alt=""
        className="action-menu-button-image"
      />
    </button>
  );
};

export default ActionMenuButton;
