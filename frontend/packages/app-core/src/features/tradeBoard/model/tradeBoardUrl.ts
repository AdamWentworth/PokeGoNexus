const PRODUCTION_APP_ORIGIN = 'https://pokegonexus.com';

const configuredPublicOrigin = (): string => {
  const configured = import.meta.env.VITE_ASSET_ORIGIN?.trim();
  if (!configured) return PRODUCTION_APP_ORIGIN;

  try {
    return new URL(configured).origin;
  } catch {
    return PRODUCTION_APP_ORIGIN;
  }
};

export const tradeBoardPath = (username: string): string =>
  `/trade-board/${encodeURIComponent(username.trim())}`;

export const tradeBoardPublicUrl = (username: string): string =>
  `${configuredPublicOrigin()}${tradeBoardPath(username)}`;
