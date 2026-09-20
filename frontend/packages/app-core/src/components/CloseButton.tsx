// src/components/CloseButton.tsx
import React, { ButtonHTMLAttributes } from 'react';
import './CloseButton.css';
import { useTheme } from '../contexts/ThemeContext';
import { useIsTopmostCloseButton } from './closeButtonStack';
import { useOverlayMotion } from './OverlayPortal';

export type CloseButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const CloseButton: React.FC<CloseButtonProps> = ({
  onClick,
  className = '',
  style,
  disabled,
  ...buttonProps
}) => {
  const { isLightMode } = useTheme();
  const isTopmost = useIsTopmostCloseButton();
  const overlayMotion = useOverlayMotion();

  const imageSrc = isLightMode
    ? '/images/close-button-light.png'
    : '/images/close-button.png';

  return (
    <button
      {...buttonProps}
      className={`close-button${isTopmost ? '' : ' close-button--stacked-beneath'} ${className}`}
      type="button"
      onClick={(event) => {
        if (!overlayMotion) {
          onClick?.(event);
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        overlayMotion.requestClose(() => onClick?.(event));
      }}
      style={style}
      disabled={disabled || !isTopmost}
      aria-hidden={!isTopmost || undefined}
      tabIndex={isTopmost ? buttonProps.tabIndex : -1}
      aria-label="Close"
    >
      <img
        src={imageSrc}
        alt="Close"
        className="close-button-image"
      />
    </button>
  );
};

export default CloseButton;
