type MotionOverlayEntry = {
  id: symbol;
  requestClose: () => void;
};

let entries: MotionOverlayEntry[] = [];

export const registerMotionOverlay = (requestClose: () => void) => {
  const entry: MotionOverlayEntry = {
    id: Symbol('motion-overlay'),
    requestClose,
  };
  entries = [...entries, entry];

  return () => {
    entries = entries.filter((candidate) => candidate.id !== entry.id);
  };
};

export const requestCloseTopmostMotionOverlay = (): boolean => {
  const topmost = entries.at(-1);
  if (!topmost) return false;
  topmost.requestClose();
  return true;
};

export const isTopmostMotionOverlay = (requestClose: () => void): boolean =>
  entries.at(-1)?.requestClose === requestClose;
