import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FaCheckCircle,
  FaCloudUploadAlt,
  FaExclamationTriangle,
  FaRedoAlt,
  FaWifi,
} from 'react-icons/fa';

import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePokemonSyncStore } from '@/stores/usePokemonSyncStore';
import { usePwaStatusStore } from '@/stores/usePwaStatusStore';
import {
  applyWaitingAppUpdate,
  retryAppServiceWorkerRegistration,
} from '@/utils/serviceWorker';

import './AppStatusCenter.css';

const RESTORED_MESSAGE_MS = 4_000;

const AppStatusCenter = () => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const retryPokemonQueue = useInstancesStore((state) => state.periodicUpdates);
  const syncStatus = usePokemonSyncStore((state) => state.status);
  const pendingCount = usePokemonSyncStore((state) => state.pendingCount);
  const isOnline = usePwaStatusStore((state) => state.isOnline);
  const isCheckingConnection = usePwaStatusStore((state) => state.isCheckingConnection);
  const updateAvailable = usePwaStatusStore((state) => state.updateAvailable);
  const updateDismissed = usePwaStatusStore((state) => state.updateDismissed);
  const isApplyingUpdate = usePwaStatusStore((state) => state.isApplyingUpdate);
  const updateError = usePwaStatusStore((state) => state.updateError);
  const setOnline = usePwaStatusStore((state) => state.setOnline);
  const setCheckingConnection = usePwaStatusStore((state) => state.setCheckingConnection);
  const dismissUpdate = usePwaStatusStore((state) => state.dismissUpdate);
  const markUpdateError = usePwaStatusStore((state) => state.markUpdateError);
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(!isOnline);

  const retrySync = useCallback(() => {
    retryPokemonQueue();
    window.dispatchEvent(new Event('pokemon-sync-reconcile-requested'));
  }, [retryPokemonQueue]);

  const markConnectionRestored = useCallback(() => {
    setOnline(true);
    setShowRestored(true);
    if (isLoggedIn) retrySync();
  }, [isLoggedIn, retrySync, setOnline]);

  useEffect(() => {
    const handleOffline = () => {
      wasOffline.current = true;
      setShowRestored(false);
      setOnline(false);
    };
    const handleOnline = () => {
      const shouldAnnounce = wasOffline.current;
      wasOffline.current = false;
      setOnline(true);
      if (shouldAnnounce) setShowRestored(true);
      if (isLoggedIn) retrySync();
    };

    setOnline(navigator.onLine);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [isLoggedIn, retrySync, setOnline]);

  useEffect(() => {
    if (!showRestored) return undefined;
    const timeout = window.setTimeout(() => setShowRestored(false), RESTORED_MESSAGE_MS);
    return () => window.clearTimeout(timeout);
  }, [showRestored]);

  const checkConnection = async () => {
    setCheckingConnection(true);
    try {
      const response = await fetch(`/favicon.ico?connection-check=${Date.now()}`, {
        cache: 'no-store',
        method: 'HEAD',
      });
      if (!response.ok) throw new Error(`Connection check returned ${response.status}`);
      wasOffline.current = false;
      markConnectionRestored();
    } catch {
      setOnline(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const applyUpdate = async () => {
    try {
      await applyWaitingAppUpdate();
    } catch (error) {
      markUpdateError(error);
    }
  };

  const retryUpdateRegistration = async () => {
    try {
      await retryAppServiceWorkerRegistration();
    } catch (error) {
      markUpdateError(error);
    }
  };

  if (!isOnline) {
    return (
      <div className="app-status-center app-status-center--offline" role="alert">
        <FaWifi aria-hidden="true" className="app-status-center__icon" />
        <div className="app-status-center__copy">
          <strong>You’re offline</strong>
          <span>
            {pendingCount > 0
              ? `${pendingCount} collection change${pendingCount === 1 ? ' is' : 's are'} safe on this device and will sync after reconnecting.`
              : 'Collection data already loaded on this device remains available, but searches and account actions need a connection.'}
          </span>
        </div>
        <button disabled={isCheckingConnection} onClick={checkConnection} type="button">
          <FaRedoAlt aria-hidden="true" />
          {isCheckingConnection ? 'Checking…' : 'Check again'}
        </button>
      </div>
    );
  }

  if (updateAvailable && !updateDismissed) {
    return (
      <div className="app-status-center app-status-center--update" role="status">
        <FaCloudUploadAlt aria-hidden="true" className="app-status-center__icon" />
        <div className="app-status-center__copy">
          <strong>App update ready</strong>
          <span>Reload to use the latest Pokémon Go Nexus version.</span>
        </div>
        <div className="app-status-center__actions">
          <button disabled={isApplyingUpdate} onClick={applyUpdate} type="button">
            {isApplyingUpdate ? 'Updating…' : 'Reload now'}
          </button>
          <button className="app-status-center__secondary" onClick={dismissUpdate} type="button">
            Later
          </button>
        </div>
      </div>
    );
  }

  if (updateError) {
    return (
      <div className="app-status-center app-status-center--warning" role="alert">
        <FaExclamationTriangle aria-hidden="true" className="app-status-center__icon" />
        <div className="app-status-center__copy">
          <strong>Automatic updates need attention</strong>
          <span>{updateError}</span>
        </div>
        <button onClick={retryUpdateRegistration} type="button">
          <FaRedoAlt aria-hidden="true" /> Retry
        </button>
      </div>
    );
  }

  if (isLoggedIn && syncStatus === 'error') {
    return (
      <div className="app-status-center app-status-center--warning" role="alert">
        <FaExclamationTriangle aria-hidden="true" className="app-status-center__icon" />
        <div className="app-status-center__copy">
          <strong>Collection sync needs attention</strong>
          <span>
            {pendingCount > 0
              ? `${pendingCount} local change${pendingCount === 1 ? ' is' : 's are'} still safe and waiting to sync.`
              : 'The server check failed. Your collection remains available on this device.'}
          </span>
        </div>
        <button onClick={retrySync} type="button">
          <FaRedoAlt aria-hidden="true" /> Retry sync
        </button>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div className="app-status-center app-status-center--success" role="status">
        <FaCheckCircle aria-hidden="true" className="app-status-center__icon" />
        <div className="app-status-center__copy">
          <strong>Back online</strong>
          <span>{isLoggedIn ? 'Resuming collection synchronization.' : 'Online features are available again.'}</span>
        </div>
      </div>
    );
  }

  return null;
};

export default AppStatusCenter;
