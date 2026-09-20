import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'pokegonexus.mobile.device-id';
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9._:-]{3,128}$/;

export const getOrCreateDeviceId = async (): Promise<string> => {
  const stored = (await SecureStore.getItemAsync(DEVICE_ID_KEY))?.trim();
  if (stored && DEVICE_ID_PATTERN.test(stored)) return stored;

  const deviceId = `native-${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
};
