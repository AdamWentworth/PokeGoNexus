import React, { ButtonHTMLAttributes } from 'react';

import { useOverlayMotion } from './OverlayPortal';

export interface OverlayDismissButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  onDismiss: () => void;
}

const OverlayDismissButton: React.FC<OverlayDismissButtonProps> = ({
  onDismiss,
  type = 'button',
  ...buttonProps
}) => {
  const overlayMotion = useOverlayMotion();

  return (
    <button
      {...buttonProps}
      type={type}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (overlayMotion) {
          overlayMotion.requestClose(onDismiss);
        } else {
          onDismiss();
        }
      }}
    />
  );
};

export default OverlayDismissButton;
