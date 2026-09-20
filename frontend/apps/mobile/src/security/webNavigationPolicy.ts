const PRODUCTION_APP_ORIGIN = 'https://pokegonexus.com';

const AUTH_PROVIDER_ORIGINS = [
  'https://accounts.google.com',
  'https://discord.com',
  'https://www.facebook.com',
  'https://m.facebook.com',
] as const;

const EXTERNAL_SCHEMES = new Set(['mailto:', 'tel:', 'sms:', 'geo:']);
const EMBEDDED_DOCUMENT_SCHEMES = new Set(['about:', 'blob:', 'data:']);

export type WebNavigationDisposition = 'embedded' | 'external' | 'blocked';

const toOrigin = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
};

export const trustedEmbeddedOrigins = (configuredAppUrl: string): string[] => {
  const configuredOrigin = toOrigin(configuredAppUrl);
  return Array.from(
    new Set(
      [configuredOrigin, PRODUCTION_APP_ORIGIN, ...AUTH_PROVIDER_ORIGINS].filter(
        (origin): origin is string => Boolean(origin),
      ),
    ),
  );
};

export const classifyWebNavigation = (
  url: string,
  trustedOrigins: readonly string[],
): WebNavigationDisposition => {
  try {
    const parsed = new URL(url);

    if (EMBEDDED_DOCUMENT_SCHEMES.has(parsed.protocol)) {
      return 'embedded';
    }

    if (EXTERNAL_SCHEMES.has(parsed.protocol)) {
      return 'external';
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'blocked';
    }

    return trustedOrigins.includes(parsed.origin) ? 'embedded' : 'external';
  } catch {
    return 'blocked';
  }
};
