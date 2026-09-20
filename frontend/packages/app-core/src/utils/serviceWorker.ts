import { usePwaStatusStore } from '@/stores/usePwaStatusStore';

export function buildServiceWorkerScriptUrl(version?: string): string {
  const normalizedVersion = version?.trim();

  return normalizedVersion
    ? `/sw.js?v=${encodeURIComponent(normalizedVersion)}`
    : '/sw.js';
}

export type AppServiceWorkerConfig = {
  receiverApiUrl?: string;
  receiverBatchedUpdatesPath: string;
  isLoggedIn: boolean;
  version?: string;
};

let currentRegistration: ServiceWorkerRegistration | null = null;
let lastConfig: AppServiceWorkerConfig | null = null;
let reloadForUpdate = false;
let lifecycleListenersInstalled = false;

const configureWorker = (
  registration: ServiceWorkerRegistration,
  config: AppServiceWorkerConfig,
) => {
  registration.active?.postMessage({
    type: 'SET_CONFIG',
    payload: {
      RECEIVER_API_URL: config.receiverApiUrl,
      RECEIVER_BATCHED_UPDATES_PATH: config.receiverBatchedUpdatesPath,
      IS_LOGGED_IN: config.isLoggedIn,
    },
  });
};

const announceWaitingUpdate = (registration: ServiceWorkerRegistration) => {
  if (!registration.waiting || !navigator.serviceWorker.controller) return;
  usePwaStatusStore.getState().markUpdateAvailable();
};

const watchRegistration = (registration: ServiceWorkerRegistration) => {
  announceWaitingUpdate(registration);
  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed') {
        announceWaitingUpdate(registration);
      }
    });
  });
};

const installLifecycleListeners = () => {
  if (lifecycleListenersInstalled) return;
  lifecycleListenersInstalled = true;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadForUpdate) return;
    reloadForUpdate = false;
    window.location.reload();
  });

  window.addEventListener('online', () => {
    void currentRegistration?.update();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void currentRegistration?.update();
    }
  });
};

export async function registerAppServiceWorker(
  config: AppServiceWorkerConfig,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  lastConfig = config;
  installLifecycleListeners();

  try {
    const registration = await navigator.serviceWorker.register(
      buildServiceWorkerScriptUrl(config.version),
    );
    currentRegistration = registration;
    watchRegistration(registration);
    configureWorker(registration, config);

    void navigator.serviceWorker.ready.then((readyRegistration) => {
      currentRegistration = readyRegistration;
      configureWorker(readyRegistration, config);
      announceWaitingUpdate(readyRegistration);
    });

    usePwaStatusStore.getState().clearUpdateError();
    return registration;
  } catch (error) {
    usePwaStatusStore.getState().markUpdateError(error);
    throw error;
  }
}

export async function retryAppServiceWorkerRegistration() {
  if (!lastConfig) return null;
  return registerAppServiceWorker(lastConfig);
}

export async function applyWaitingAppUpdate(): Promise<void> {
  const registration = currentRegistration;
  if (!registration) {
    throw new Error('The app update is not ready yet.');
  }

  if (!registration.waiting) {
    await registration.update();
  }

  const waitingWorker = registration.waiting;
  if (!waitingWorker) {
    throw new Error('The app update is still being prepared. Try again shortly.');
  }

  reloadForUpdate = true;
  usePwaStatusStore.getState().markApplyingUpdate();
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}
