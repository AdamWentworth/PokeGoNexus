import React, { useId } from 'react';
import OverlayDismissButton from '../OverlayDismissButton';
import OverlayPortal from '../OverlayPortal';
import './ModalStyles.css';

type ConfirmDialogProps = {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, onConfirm, onCancel }) => {
  const titleId = useId();
  const descriptionId = useId();
  const lines = message.split('\n');

  return (
    <OverlayPortal onClose={onCancel} closeOnBackdrop>
      <div className="modal-overlay confirm-modal-overlay">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal confirm-modal"
        role="dialog"
      >
        <div className="confirm-modal__header">
          <span aria-hidden="true" className="confirm-modal__icon">
            !
          </span>
          <div className="confirm-modal__heading">
            <p className="confirm-modal__eyebrow">Trainer action</p>
            <h2 className="confirm-modal__title" id={titleId}>
              Confirm action
            </h2>
          </div>
        </div>

        <div className="modal-content confirm-modal__content" id={descriptionId}>
          {lines.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>

        <div className="modal-actions confirm-modal__actions">
          <OverlayDismissButton
            className="btn btn-secondary confirm-modal__button confirm-modal__button--secondary"
            onDismiss={onCancel}
          >
            Cancel
          </OverlayDismissButton>
          <OverlayDismissButton
            className="btn btn-primary confirm-modal__button confirm-modal__button--primary"
            onDismiss={onConfirm}
          >
            OK
          </OverlayDismissButton>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
};

export default ConfirmDialog;
