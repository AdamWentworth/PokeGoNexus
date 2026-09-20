import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePwaStatusStore } from '@/stores/usePwaStatusStore';
import {
  applyWaitingAppUpdate,
  buildServiceWorkerScriptUrl,
  registerAppServiceWorker,
} from './serviceWorker';

const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'serviceWorker',
);

afterEach(() => {
  if (originalServiceWorkerDescriptor) {
    Object.defineProperty(navigator, 'serviceWorker', originalServiceWorkerDescriptor);
  } else {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  }
  usePwaStatusStore.setState({
    updateAvailable: false,
    updateDismissed: false,
    isApplyingUpdate: false,
    updateError: null,
  });
});

describe('buildServiceWorkerScriptUrl', () => {
  it('uses the stable development path when no build version is available', () => {
    expect(buildServiceWorkerScriptUrl()).toBe('/sw.js');
    expect(buildServiceWorkerScriptUrl('   ')).toBe('/sw.js');
  });

  it('cache-busts production workers with the exact build version', () => {
    expect(buildServiceWorkerScriptUrl('commit/abc 123')).toBe(
      '/sw.js?v=commit%2Fabc%20123',
    );
  });
});

describe('controlled service-worker updates', () => {
  it('announces a waiting update and only activates it after approval', async () => {
    const waitingWorker = { postMessage: vi.fn() };
    const activeWorker = { postMessage: vi.fn() };
    const registration = {
      active: activeWorker,
      addEventListener: vi.fn(),
      installing: null,
      scope: '/',
      update: vi.fn().mockResolvedValue(undefined),
      waiting: waitingWorker,
    } as unknown as ServiceWorkerRegistration;
    const serviceWorkerContainer = {
      addEventListener: vi.fn(),
      controller: {},
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    } as unknown as ServiceWorkerContainer;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorkerContainer,
    });

    await registerAppServiceWorker({
      isLoggedIn: true,
      receiverApiUrl: '/api/receiver',
      receiverBatchedUpdatesPath: '/batchedUpdates',
      version: 'release-123',
    });

    expect(serviceWorkerContainer.register).toHaveBeenCalledWith('/sw.js?v=release-123');
    expect(activeWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_CONFIG' }),
    );
    expect(usePwaStatusStore.getState().updateAvailable).toBe(true);

    await applyWaitingAppUpdate();
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(usePwaStatusStore.getState().isApplyingUpdate).toBe(true);
  });
});
