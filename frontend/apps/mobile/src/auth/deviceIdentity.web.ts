const DEVICE_ID_KEY = 'pokegonexus.mobile.device-id';
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9._:-]{3,128}$/;

const browserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const createDeviceId = (): string => {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `native-web-${randomId}`;
};

export const getOrCreateDeviceId = async (): Promise<string> => {
  const storage = browserStorage();
  const stored = storage?.getItem(DEVICE_ID_KEY)?.trim();
  if (stored && DEVICE_ID_PATTERN.test(stored)) return stored;

  const deviceId = createDeviceId();
  storage?.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
};
