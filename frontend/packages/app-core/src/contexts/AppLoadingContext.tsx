import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import LoadingSpinner from '@/components/LoadingSpinner';

type LoadingSource = string;

interface AppLoadingContextValue {
  setLoadingSource: (source: LoadingSource, active: boolean) => void;
}

const AppLoadingContext = createContext<AppLoadingContextValue>({
  setLoadingSource: () => undefined,
});

export const AppLoadingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeSources, setActiveSources] = useState<Set<LoadingSource>>(
    () => new Set(),
  );
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setLoadingSource = useCallback(
    (source: LoadingSource, active: boolean) => {
      setActiveSources((prev) => {
        const alreadyActive = prev.has(source);
        if (alreadyActive === active) return prev;

        const next = new Set(prev);
        if (active) {
          next.add(source);
        } else {
          next.delete(source);
        }
        return next;
      });
    },
    [],
  );

  const hasActiveSources = activeSources.size > 0;

  useLayoutEffect(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (hasActiveSources) {
      setIsVisible(true);
      return undefined;
    }

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      hideTimerRef.current = null;
    }, 150);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [hasActiveSources]);

  const value = useMemo(() => ({ setLoadingSource }), [setLoadingSource]);

  return (
    <AppLoadingContext.Provider value={value}>
      {children}
      {isVisible && (
        <div
          className="app-loading-overlay"
          role="status"
          aria-label="Loading"
          aria-live="polite"
        >
          <LoadingSpinner />
        </div>
      )}
    </AppLoadingContext.Provider>
  );
};

export const AppLoadingFallback: React.FC<{ source: LoadingSource }> = ({
  source,
}) => {
  const { setLoadingSource } = useContext(AppLoadingContext);

  useLayoutEffect(() => {
    setLoadingSource(source, true);
    return () => setLoadingSource(source, false);
  }, [setLoadingSource, source]);

  return null;
};

export const useAppLoading = (): AppLoadingContextValue =>
  useContext(AppLoadingContext);
