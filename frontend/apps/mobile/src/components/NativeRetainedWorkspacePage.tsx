import { useState, type PropsWithChildren } from 'react';

/** Open expensive tools on first use, then keep their local state mounted. */
export const NativeRetainedWorkspacePage = ({ active, children }: PropsWithChildren<{ active: boolean }>) => {
  const [hasOpened, setHasOpened] = useState(active);
  if (active && !hasOpened) setHasOpened(true);
  return active || hasOpened ? children : null;
};
