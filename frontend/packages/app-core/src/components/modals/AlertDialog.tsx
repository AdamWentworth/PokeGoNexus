// AlertDialog.tsx

import React from 'react';
import OverlayPortal, { useOverlayMotion } from '../OverlayPortal';
import './AlertDialog.css';

type AlertDialogProps = {
  message: string;
  onClose: () => void;
};

type AlertSurfaceProps = AlertDialogProps & React.HTMLAttributes<HTMLDivElement>;

const AlertSurface: React.FC<AlertSurfaceProps> = ({ message, onClose, ...rootProps }) => {
  const overlayMotion = useOverlayMotion();
  return (
    <div {...rootProps} className="alert-modal-overlay" onClick={() => overlayMotion?.requestClose(onClose)}>
      <div className="alert-modal">
        <p>{message}</p>
      </div>
    </div>
  );
};

const AlertDialog: React.FC<AlertDialogProps> = ({ message, onClose }) => (
  <OverlayPortal onClose={onClose}>
    <AlertSurface message={message} onClose={onClose} />
  </OverlayPortal>
);

export default AlertDialog;
