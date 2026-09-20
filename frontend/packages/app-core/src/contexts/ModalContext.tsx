import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import ConfirmDialog from '../components/modals/ConfirmDialog';
import AlertDialog from '../components/modals/AlertDialog';

type ConfirmModalContent = {
  type: 'confirm';
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

type AlertModalContent = {
  type: 'alert';
  message: string;
  onClose: () => void;
};

type ModalContent = ConfirmModalContent | AlertModalContent;

type ModalContextValue = {
  confirm: (message: string) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
};

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

export const useModal = (): ModalContextValue => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setModalContent({
        type: 'confirm',
        message,
        onConfirm: () => {
          resolve(true);
          setModalContent(null);
        },
        onCancel: () => {
          resolve(false);
          setModalContent(null);
        },
      });
    });
  }, []);

  const alert = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      setModalContent({
        type: 'alert',
        message,
        onClose: () => {
          resolve();
          setModalContent(null);
        },
      });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}
      {modalContent ? <ModalRenderer modal={modalContent} /> : null}
    </ModalContext.Provider>
  );
};

const ModalRenderer = ({ modal }: { modal: ModalContent }) => {
  switch (modal.type) {
    case 'confirm':
      return (
        <ConfirmDialog
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={modal.onCancel}
        />
      );
    case 'alert':
      return <AlertDialog message={modal.message} onClose={modal.onClose} />;
    default:
      return null;
  }
};
