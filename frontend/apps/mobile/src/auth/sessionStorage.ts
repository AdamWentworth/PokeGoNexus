import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'pokegonexus.mobile.refresh-token';
const MAX_TOKEN_LENGTH = 8192;

const normalizeRefreshToken = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  return token;
};

export const readRefreshToken = async (): Promise<string | null> => {
  const stored = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  const token = normalizeRefreshToken(stored);
  if (stored !== null && token === null) {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
  return token;
};

export const storeRefreshToken = async (value: string): Promise<void> => {
  const token = normalizeRefreshToken(value);
  if (!token) throw new Error('Cannot store an invalid refresh token');
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
};

export const clearRefreshToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};
