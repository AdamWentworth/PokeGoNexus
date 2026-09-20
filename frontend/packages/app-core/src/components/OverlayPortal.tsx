// OverlayPortal.tsx

import React, {
  HTMLAttributes,
  ReactElement,
  ReactNode,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import './OverlayPortal.css';
import {
  isTopmostMotionOverlay,
  registerMotionOverlay,
} from './overlayMotionStack';
import {
  useContextBackHandler,
  type ContextBackBehavior,
} from '@/contexts/ContextBackContext';

export const OVERLAY_MOTION_DURATION_MS = 280;

type OverlayMotionPhase = 'entering' | 'entered' | 'exiting';
type AfterOverlayExit = () => void;

type OverlayMotionControls = {
  phase: OverlayMotionPhase;
  requestClose: (afterExit?: AfterOverlayExit) => void;
};

const OverlayMotionContext = createContext<OverlayMotionControls | null>(null);

export const useOverlayMotion = (): OverlayMotionControls | null =>
  useContext(OverlayMotionContext);

type OverlayRootProps = HTMLAttributes<HTMLElement> & {
  'data-overlay-motion'?: OverlayMotionPhase;
};

type Props = {
  backBehavior?: ContextBackBehavior;
  children: ReactNode;
  closeOnBackdrop?: boolean;
  dismissible?: boolean;
  onClose?: () => void;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const OverlayPortal: React.FC<Props> = ({
  backBehavior = 'all',
  children,
  closeOnBackdrop = false,
  dismissible = true,
  onClose,
}) => {
  const [phase, setPhase] = useState<OverlayMotionPhase>('entering');
  const closingRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPhase('entered'));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    },
    [],
  );

  const requestClose = useCallback((afterExit?: AfterOverlayExit) => {
    if (!dismissible) return;
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase('exiting');

    const finishClose = afterExit ?? onCloseRef.current;
    const delay = prefersReducedMotion() ? 0 : OVERLAY_MOTION_DURATION_MS;
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      finishClose?.();
    }, delay);
  }, [dismissible]);

  const controls = useMemo<OverlayMotionControls>(
    () => ({ phase, requestClose }),
    [phase, requestClose],
  );

  const handleContextBack = useCallback(() => {
    requestClose();
    return true;
  }, [requestClose]);

  useContextBackHandler(
    dismissible,
    handleContextBack,
    'motion-overlay',
    backBehavior,
  );

  useEffect(() => registerMotionOverlay(requestClose), [requestClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isTopmostMotionOverlay(requestClose)) return;
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

  if (!isValidElement(children)) {
    return createPortal(
      <OverlayMotionContext.Provider value={controls}>
        {children}
      </OverlayMotionContext.Provider>,
      document.body,
    );
  }

  const root = children as ReactElement<OverlayRootProps>;
  const originalCapture = root.props.onClickCapture;
  const handleClickCapture: React.MouseEventHandler<HTMLElement> | undefined =
    closeOnBackdrop
      ? (event) => {
          originalCapture?.(event);
          if (event.defaultPrevented || event.target !== event.currentTarget) return;
          event.preventDefault();
          event.stopPropagation();
          requestClose();
        }
      : originalCapture;
  const animatedRoot = React.cloneElement(root, {
    'data-overlay-motion': phase,
    onClickCapture: handleClickCapture,
  });

  return createPortal(
    <OverlayMotionContext.Provider value={controls}>
      {animatedRoot}
    </OverlayMotionContext.Provider>,
    document.body,
  );
};

export default OverlayPortal;
