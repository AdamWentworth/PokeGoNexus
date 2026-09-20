const REFRESH_TOKEN_KEY = 'pokegonexus.mobile.refresh-token';
const MAX_TOKEN_LENGTH = 8192;

const normalizeRefreshToken = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  return token;
};

const browserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readRefreshToken = async (): Promise<string | null> => {
  const storage = browserStorage();
  if (!storage) return null;
  const stored = storage.getItem(REFRESH_TOKEN_KEY);
  const token = normalizeRefreshToken(stored);
  if (stored !== null && token === null) storage.removeItem(REFRESH_TOKEN_KEY);
  return token;
};

export const storeRefreshToken = async (value: string): Promise<void> => {
  const token = normalizeRefreshToken(value);
  if (!token) throw new Error('Cannot store an invalid refresh token');
  const storage = browserStorage();
  if (!storage) throw new Error('Browser storage is unavailable');
  storage.setItem(REFRESH_TOKEN_KEY, token);
};

export const clearRefreshToken = async (): Promise<void> => {
  browserStorage()?.removeItem(REFRESH_TOKEN_KEY);
};
