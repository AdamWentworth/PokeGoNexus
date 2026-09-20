import { create } from 'zustand';

type PwaStatusState = {
  isOnline: boolean;
  isCheckingConnection: boolean;
  updateAvailable: boolean;
  updateDismissed: boolean;
  isApplyingUpdate: boolean;
  updateError: string | null;
  setOnline(isOnline: boolean): void;
  setCheckingConnection(isCheckingConnection: boolean): void;
  markUpdateAvailable(): void;
  dismissUpdate(): void;
  markApplyingUpdate(): void;
  markUpdateError(error: unknown): void;
  clearUpdateError(): void;
};

const browserIsOnline = () =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

export const usePwaStatusStore = create<PwaStatusState>((set) => ({
  isOnline: browserIsOnline(),
  isCheckingConnection: false,
  updateAvailable: false,
  updateDismissed: false,
  isApplyingUpdate: false,
  updateError: null,
  setOnline: (isOnline) => set({ isOnline, isCheckingConnection: false }),
  setCheckingConnection: (isCheckingConnection) => set({ isCheckingConnection }),
  markUpdateAvailable: () => set({
    updateAvailable: true,
    updateDismissed: false,
    updateError: null,
  }),
  dismissUpdate: () => set({ updateDismissed: true }),
  markApplyingUpdate: () => set({ isApplyingUpdate: true, updateError: null }),
  markUpdateError: (error) => set({
    isApplyingUpdate: false,
    updateError: error instanceof Error
      ? error.message
      : 'The app update could not be prepared.',
  }),
  clearUpdateError: () => set({ updateError: null }),
}));
