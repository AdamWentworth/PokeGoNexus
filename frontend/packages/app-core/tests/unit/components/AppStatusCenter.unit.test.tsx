import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppStatusCenter from '@/components/status/AppStatusCenter';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePokemonSyncStore } from '@/stores/usePokemonSyncStore';
import { usePwaStatusStore } from '@/stores/usePwaStatusStore';

const mocks = vi.hoisted(() => ({
  applyWaitingAppUpdate: vi.fn(),
  retryAppServiceWorkerRegistration: vi.fn(),
  retryPokemonQueue: vi.fn(),
}));

vi.mock('@/utils/serviceWorker', () => ({
  applyWaitingAppUpdate: mocks.applyWaitingAppUpdate,
  retryAppServiceWorkerRegistration: mocks.retryAppServiceWorkerRegistration,
}));

const setBrowserOnline = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: online,
  });
};

describe('AppStatusCenter', () => {
  beforeEach(() => {
    setBrowserOnline(true);
    mocks.applyWaitingAppUpdate.mockReset();
    mocks.retryAppServiceWorkerRegistration.mockReset();
    mocks.retryPokemonQueue.mockReset();
    useInstancesStore.setState({ periodicUpdates: mocks.retryPokemonQueue });
    useAuthStore.setState({ isLoggedIn: false, user: null });
    usePokemonSyncStore.setState({
      pendingCount: 0,
      status: 'idle',
      lastSuccessfulSync: null,
      error: null,
    });
    usePwaStatusStore.setState({
      isOnline: true,
      isCheckingConnection: false,
      updateAvailable: false,
      updateDismissed: false,
      isApplyingUpdate: false,
      updateError: null,
    });
    vi.restoreAllMocks();
  });

  it('explains offline cache behavior and confirms reconnection', async () => {
    setBrowserOnline(false);
    usePwaStatusStore.setState({ isOnline: false });
    usePokemonSyncStore.setState({ pendingCount: 3 });
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    const { container } = render(<AppStatusCenter />);

    expect(screen.getByRole('alert')).toHaveTextContent('You’re offline');
    expect(screen.getByRole('alert')).toHaveTextContent('3 collection changes are safe');
    await expect(container).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: /Check again/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Back online'));
  });

  it('offers explicit activation when an app update is waiting', async () => {
    mocks.applyWaitingAppUpdate.mockResolvedValue(undefined);
    usePwaStatusStore.setState({ updateAvailable: true });
    const { container } = render(<AppStatusCenter />);

    expect(screen.getByRole('status')).toHaveTextContent('App update ready');
    await expect(container).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Reload now' }));
    await waitFor(() => expect(mocks.applyWaitingAppUpdate).toHaveBeenCalledOnce());
  });

  it('retries both the local queue and authoritative reconciliation after a sync failure', () => {
    useAuthStore.setState({ isLoggedIn: true });
    usePokemonSyncStore.setState({ status: 'error', pendingCount: 2 });
    const reconcileRequested = vi.fn();
    window.addEventListener('pokemon-sync-reconcile-requested', reconcileRequested);

    render(<AppStatusCenter />);
    expect(screen.getByRole('alert')).toHaveTextContent('Collection sync needs attention');
    fireEvent.click(screen.getByRole('button', { name: /Retry sync/i }));

    expect(mocks.retryPokemonQueue).toHaveBeenCalledOnce();
    expect(reconcileRequested).toHaveBeenCalledOnce();
    window.removeEventListener('pokemon-sync-reconcile-requested', reconcileRequested);
  });
});
