import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation, type Location } from 'react-router';

export type ContextBackBehavior = 'all' | 'mobile';

type ContextBackHandler = () => boolean | void;

type ContextBackEntry = {
  behavior: ContextBackBehavior;
  handler: ContextBackHandler;
  id: symbol;
};

type ContextBackContextValue = {
  registerBackHandler: (
    handler: ContextBackHandler,
    label?: string,
    behavior?: ContextBackBehavior,
  ) => () => void;
};

type GuardState = {
  token: number;
  url: string;
};

const CONTEXT_BACK_GUARD_KEY = '__pgnContextBackGuard';
const MOBILE_BACK_QUERY = '(max-width: 767px), (pointer: coarse)';

const ContextBackContext = createContext<ContextBackContextValue | undefined>(
  undefined,
);

function getLocationUrl(location: Location) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function isMobileContextBackEnvironment() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_BACK_QUERY).matches
  );
}

function getGuardState(state: unknown): GuardState | null {
  if (!state || typeof state !== 'object') return null;
  const guard = (state as Record<string, unknown>)[CONTEXT_BACK_GUARD_KEY];
  if (!guard || typeof guard !== 'object') return null;

  const candidate = guard as Partial<GuardState>;
  return typeof candidate.token === 'number' && typeof candidate.url === 'string'
    ? (candidate as GuardState)
    : null;
}

function withGuardState(state: unknown, guard: GuardState) {
  const current = state && typeof state === 'object' ? state : {};
  return {
    ...current,
    [CONTEXT_BACK_GUARD_KEY]: guard,
  };
}

export function ContextBackProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const currentUrlRef = useRef(getLocationUrl(location));
  const entriesRef = useRef<ContextBackEntry[]>([]);
  const guardArmedRef = useRef(false);
  const guardedUrlRef = useRef<string | null>(null);
  const guardTokenRef = useRef(0);
  const suppressNextPopRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const [registrationVersion, notifyRegistrationChange] = useReducer(
    (version) => version + 1,
    0,
  );

  const eligibleEntries = useCallback(() => {
    const mobile = isMobileContextBackEnvironment();
    return entriesRef.current.filter(
      (entry) => entry.behavior === 'all' || mobile,
    );
  }, []);

  const armGuard = useCallback(() => {
    if (guardArmedRef.current || eligibleEntries().length === 0) return;

    const url = currentUrlRef.current;
    const guard = {
      token: guardTokenRef.current + 1,
      url,
    };
    guardTokenRef.current = guard.token;
    window.history.pushState(withGuardState(window.history.state, guard), '', url);
    guardArmedRef.current = true;
    guardedUrlRef.current = url;
  }, [eligibleEntries]);

  const disarmGuard = useCallback(() => {
    if (!guardArmedRef.current) return;
    guardArmedRef.current = false;
    guardedUrlRef.current = null;
    suppressNextPopRef.current = true;
    window.history.back();
  }, []);

  const syncGuard = useCallback(() => {
    if (eligibleEntries().length > 0) {
      armGuard();
      return;
    }
    disarmGuard();
  }, [armGuard, disarmGuard, eligibleEntries]);

  const scheduleGuardSync = useCallback(() => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      syncGuard();
    }, 0);
  }, [syncGuard]);

  const registerBackHandler = useCallback(
    (
      handler: ContextBackHandler,
      label?: string,
      behavior: ContextBackBehavior = 'all',
    ) => {
      const entry: ContextBackEntry = {
        behavior,
        handler,
        id: Symbol(label ?? 'context-back-handler'),
      };

      entriesRef.current = [...entriesRef.current, entry];
      notifyRegistrationChange();

      return () => {
        entriesRef.current = entriesRef.current.filter(
          (candidate) => candidate.id !== entry.id,
        );
        notifyRegistrationChange();
      };
    },
    [],
  );

  const handleContextBack = useCallback(() => {
    const entries = eligibleEntries();

    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const handled = entries[index].handler();
      if (handled !== false) return true;
    }

    return false;
  }, [eligibleEntries]);

  useLayoutEffect(() => {
    const locationUrl = getLocationUrl(location);
    currentUrlRef.current = locationUrl;

    if (!guardArmedRef.current) return;
    const activeGuard = getGuardState(window.history.state);
    if (guardedUrlRef.current !== locationUrl) {
      guardArmedRef.current = false;
      guardedUrlRef.current = null;
      return;
    }

    if (activeGuard?.token === guardTokenRef.current) return;

    // BrowserRouter may publish the underlying same-URL entry before our
    // popstate listener gets its turn. Defer guard recovery so that Back can
    // close the active layer first; if a replaceState genuinely removed the
    // guard, restore it after the event dispatch instead.
    const expectedToken = guardTokenRef.current;
    window.setTimeout(() => {
      if (
        !guardArmedRef.current ||
        guardTokenRef.current !== expectedToken ||
        guardedUrlRef.current !== currentUrlRef.current
      ) {
        return;
      }

      const currentGuard = getGuardState(window.history.state);
      if (currentGuard?.token === expectedToken) return;

      guardArmedRef.current = false;
      guardedUrlRef.current = null;
      scheduleGuardSync();
    }, 0);
  }, [location, scheduleGuardSync]);

  useEffect(() => {
    syncGuard();
  }, [registrationVersion, syncGuard]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BACK_QUERY);
    const handleEnvironmentChange = () => scheduleGuardSync();
    mediaQuery.addEventListener?.('change', handleEnvironmentChange);
    return () => mediaQuery.removeEventListener?.('change', handleEnvironmentChange);
  }, [scheduleGuardSync]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (suppressNextPopRef.current) {
        suppressNextPopRef.current = false;
        return;
      }

      if (!guardArmedRef.current) {
        if (getGuardState(event.state)) {
          suppressNextPopRef.current = true;
          window.history.back();
        }
        return;
      }

      guardArmedRef.current = false;
      guardedUrlRef.current = null;

      if (handleContextBack()) {
        scheduleGuardSync();
        return;
      }

      window.history.back();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [handleContextBack, scheduleGuardSync]);

  useEffect(
    () => () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    },
    [],
  );

  const value = useMemo<ContextBackContextValue>(
    () => ({ registerBackHandler }),
    [registerBackHandler],
  );

  return (
    <ContextBackContext.Provider value={value}>
      {children}
    </ContextBackContext.Provider>
  );
}

export function useContextBackHandler(
  enabled: boolean,
  onBack: ContextBackHandler,
  label?: string,
  behavior: ContextBackBehavior = 'all',
) {
  const context = useContext(ContextBackContext);
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!context || !enabled) return undefined;
    return context.registerBackHandler(
      () => onBackRef.current(),
      label,
      behavior,
    );
  }, [behavior, context, enabled, label]);
}
