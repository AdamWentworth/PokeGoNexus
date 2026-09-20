import type { ImageURISource } from 'react-native';

const nativeCollectionImageSources = new Map<string, ImageURISource>();

export const toNativeCollectionAssetUrl = (
  baseUrl: string,
  path: string,
): string => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

/**
 * Collection imagery is immutable at a given URL. Reuse both the JavaScript
 * source object and Android's cached response so recycling a visible grid slot
 * never turns an already-downloaded Pokémon into another network request.
 */
export const toNativeCollectionImageSource = (
  baseUrl: string,
  path: string,
): ImageURISource => {
  const uri = toNativeCollectionAssetUrl(baseUrl, path);
  const cached = nativeCollectionImageSources.get(uri);
  if (cached) return cached;
  const source: ImageURISource = { cache: 'force-cache', uri };
  nativeCollectionImageSources.set(uri, source);
  return source;
};
