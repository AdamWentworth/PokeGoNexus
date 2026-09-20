import { useEffect, useRef, useSyncExternalStore } from 'react';

let nextId = 0;
let activeIds: number[] = [];
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getTopId = () => activeIds.at(-1) ?? null;

export const useIsTopmostCloseButton = (): boolean => {
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) idRef.current = ++nextId;
  const id = idRef.current;

  useEffect(() => {
    activeIds = [...activeIds, id];
    emit();

    return () => {
      activeIds = activeIds.filter((activeId) => activeId !== id);
      emit();
    };
  }, [id]);

  const topId = useSyncExternalStore(subscribe, getTopId, getTopId);
  return topId === null || topId === id;
};
