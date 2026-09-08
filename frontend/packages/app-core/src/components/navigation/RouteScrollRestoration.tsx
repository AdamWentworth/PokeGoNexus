import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

const ROUTE_SCROLL_STATE_KEY = '__pgnRouteScrollPosition';
const RESTORE_RETRY_DELAYS_MS = [100, 300, 700];
const RESTORE_TOLERANCE_PX = 2;

export type RouteScrollPosition = {
  x: number;
  y: number;
};

type StoredRouteScrollState = Record<string, unknown> & {
  [ROUTE_SCROLL_STATE_KEY]?: RouteScrollPosition;
};

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function readRouteScrollPosition(
  state: unknown,
): RouteScrollPosition | null {
  if (!state || typeof state !== 'object') return null;

  const position = (state as StoredRouteScrollState)[ROUTE_SCROLL_STATE_KEY];
  if (
    !position ||
    !isFiniteCoordinate(position.x) ||
    !isFiniteCoordinate(position.y)
  ) {
    return null;
  }

  return position;
}

export function withRouteScrollPosition(
  state: unknown,
  position: RouteScrollPosition,
): StoredRouteScrollState {
  const currentState =
    state && typeof state === 'object'
      ? (state as Record<string, unknown>)
      : {};

  return {
    ...currentState,
    [ROUTE_SCROLL_STATE_KEY]: position,
  };
}

function currentScrollPosition(): RouteScrollPosition {
  return {
    x: Math.max(
      0,
      window.scrollX,
      document.scrollingElement?.scrollLeft ?? 0,
      document.documentElement.scrollLeft,
      document.body.scrollLeft,
    ),
    y: Math.max(
      0,
      window.scrollY,
      document.scrollingElement?.scrollTop ?? 0,
      document.documentElement.scrollTop,
      document.body.scrollTop,
    ),
  };
}

function historyEntryKey(state: unknown): string {
  if (!state || typeof state !== 'object') return 'default';
  const key = (state as { key?: unknown }).key;
  // React Router calls the initial entry "default" without storing its key.
  return typeof key === 'string' ? key : 'default';
}

function persistPosition(
  expectedLocationKey: string,
  position: RouteScrollPosition,
) {
  const state = window.history.state;
  const stateKey = historyEntryKey(state);

  // A navigation can update window.history before React publishes the next
  // location. Never write the previous page's coordinates into the new entry.
  if (stateKey !== expectedLocationKey) return;

  window.history.replaceState(
    withRouteScrollPosition(state, position),
    '',
  );
}

function applyScrollPosition(position: RouteScrollPosition) {
  window.scrollTo({
    behavior: 'auto',
    left: position.x,
    top: position.y,
  });

  // JSDOM and a few embedded browser hosts do not fully reflect scrollTo in
  // scrollingElement. Keeping all three in sync also makes PWA restoration
  // more reliable while a lazy route grows to its final height.
  if (document.scrollingElement) {
    document.scrollingElement.scrollLeft = position.x;
    document.scrollingElement.scrollTop = position.y;
  }
  document.documentElement.scrollLeft = position.x;
  document.documentElement.scrollTop = position.y;
  document.body.scrollLeft = position.x;
  document.body.scrollTop = position.y;
}

function scheduleScrollRestore(position: RouteScrollPosition) {
  let cancelled = false;
  let frameId: number | null = null;
  const timeoutIds = new Set<number>();

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    if (frameId !== null) window.cancelAnimationFrame(frameId);
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIds.clear();
    window.removeEventListener('wheel', cancel);
    window.removeEventListener('touchstart', cancel);
    window.removeEventListener('pointerdown', cancel);
    window.removeEventListener('keydown', cancel);
  };

  const requestRestore = () => {
    if (cancelled) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      if (cancelled) return;
      applyScrollPosition(position);
    });
  };

  requestRestore();

  // Lazy routes and async page content may initially be too short to reach the
  // saved coordinate. A top-of-page navigation never needs retries: repeating
  // a zero restore can pull someone back to the top after they have already
  // started scrolling the newly rendered page.
  const retryDelays = position.x > 0 || position.y > 0
    ? RESTORE_RETRY_DELAYS_MS
    : [];
  for (const delayMs of retryDelays) {
    const timeoutId = window.setTimeout(() => {
      timeoutIds.delete(timeoutId);
      const currentPosition = currentScrollPosition();
      if (
        cancelled ||
        (Math.abs(currentPosition.x - position.x) <= RESTORE_TOLERANCE_PX &&
          Math.abs(currentPosition.y - position.y) <= RESTORE_TOLERANCE_PX)
      ) {
        return;
      }
      requestRestore();
    }, delayMs);
    timeoutIds.add(timeoutId);
  }

  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('pointerdown', cancel, { passive: true });
  window.addEventListener('keydown', cancel);

  return cancel;
}

/**
 * Gives every browser-history entry its own document scroll position.
 * POP navigation restores that entry; a new PUSH/REPLACE route starts at the
 * top. Same-entry history guards used by stacked overlays keep their context.
 */
const RouteScrollRestoration = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const currentLocationKeyRef = useRef(location.key);
  const knownPositionsRef = useRef(new Map<string, RouteScrollPosition>());
  const previousLocationKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    let persistTimer: number | null = null;
    let pendingKey = currentLocationKeyRef.current;
    let pendingPosition = currentScrollPosition();

    const persistPendingPosition = () => {
      persistTimer = null;
      persistPosition(pendingKey, pendingPosition);
    };

    const savePosition = () => {
      const position = currentScrollPosition();
      const locationKey = currentLocationKeyRef.current;
      if (historyEntryKey(window.history.state) !== locationKey) return;
      knownPositionsRef.current.set(locationKey, position);
      pendingKey = locationKey;
      pendingPosition = position;

      // Writing history state on every scroll event can make lower-powered
      // phones stutter. Keep the in-memory position exact and persist at a
      // small bounded cadence for reload/session recovery.
      if (persistTimer === null) {
        persistTimer = window.setTimeout(persistPendingPosition, 80);
      }
    };

    const flushPosition = () => {
      if (persistTimer !== null) {
        window.clearTimeout(persistTimer);
        persistTimer = null;
      }
      const position = currentScrollPosition();
      const locationKey = currentLocationKeyRef.current;
      if (historyEntryKey(window.history.state) !== locationKey) return;
      knownPositionsRef.current.set(locationKey, position);
      persistPosition(locationKey, position);
    };

    const handleLinkClick = (event: MouseEvent) => {
      // Scroll events can arrive after a link has already replaced the page.
      // Accessibility and programmatic clicks need not emit pointerdown first.
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        flushPosition();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPosition();
    };

    savePosition();
    window.addEventListener('scroll', savePosition, { passive: true });
    document.addEventListener('scroll', savePosition, {
      capture: true,
      passive: true,
    });
    window.addEventListener('pointerdown', flushPosition, {
      capture: true,
      passive: true,
    });
    window.addEventListener('keydown', flushPosition, { capture: true });
    window.addEventListener('click', handleLinkClick, { capture: true });
    window.addEventListener('pagehide', flushPosition);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      flushPosition();
      if (persistTimer !== null) window.clearTimeout(persistTimer);
      window.removeEventListener('scroll', savePosition);
      document.removeEventListener('scroll', savePosition, { capture: true });
      window.removeEventListener('pointerdown', flushPosition, {
        capture: true,
      });
      window.removeEventListener('keydown', flushPosition, { capture: true });
      window.removeEventListener('click', handleLinkClick, { capture: true });
      window.removeEventListener('pagehide', flushPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const previousLocationKey = previousLocationKeyRef.current;
    previousLocationKeyRef.current = location.key;
    currentLocationKeyRef.current = location.key;

    // ContextBackProvider creates same-location guard entries for overlays.
    // Their key stays the same, so closing a layer must not move the document.
    if (previousLocationKey === location.key) return undefined;

    let targetPosition: RouteScrollPosition;
    if (navigationType === 'POP') {
      targetPosition =
        knownPositionsRef.current.get(location.key) ??
        readRouteScrollPosition(window.history.state) ??
        { x: 0, y: 0 };
    } else {
      targetPosition = { x: 0, y: 0 };
    }

    knownPositionsRef.current.set(location.key, targetPosition);
    return scheduleScrollRestore(targetPosition);
  }, [location.key, navigationType]);

  return null;
};

export default RouteScrollRestoration;
