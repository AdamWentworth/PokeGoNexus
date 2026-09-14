import { Image as ExpoImage } from 'expo-image';
import { Image } from 'react-native';
import type { NativeInstanceDetail } from './collectionModel';
import { toNativeCollectionAssetUrl } from './parity/nativeCollectionImageSource';

export const nativeInstanceBackgroundPath = (
  detail: NativeInstanceDetail,
  overrides?: {
    lucky?: boolean;
    shadow?: boolean;
    purified?: boolean;
    typeIconUris?: string[];
  },
): string => {
  const instance = detail.instance;
  const shadow = overrides?.shadow ?? instance?.shadow;
  const purified = overrides?.purified ?? instance?.purified;
  if (shadow && !purified) return '/images/backgrounds/bg_shadow.png';
  const lucky = Boolean(
    detail.row.lucky || instance?.lucky || (instance?.is_wanted && instance.pref_lucky),
  );
  if (overrides?.lucky ?? lucky) return '/images/backgrounds/bg_lucky.png';
  const typeIcon = (overrides?.typeIconUris ?? detail.row.typeIconUris)[0];
  const type = typeIcon?.match(/\/([^/?]+)\.png(?:\?|$)/i)?.[1]?.toLowerCase() ?? 'normal';
  return `/images/backgrounds/bg_${type}.png`;
};

/** Warm only adjacent artwork; a failed image must never hold navigation. */
export const prefetchNativeInstanceArtwork = async (
  detail: NativeInstanceDetail,
  assetBaseUrl: string,
): Promise<void> => {
  const stageUris = [
    detail.row.imageUri,
    toNativeCollectionAssetUrl(assetBaseUrl, nativeInstanceBackgroundPath(detail)),
  ].filter((uri): uri is string => Boolean(uri));
  const inlineUris = [
    detail.row.locationBackgroundUri,
    ...detail.row.typeIconUris,
    ...detail.moves.map((move) => move.typeIconUri),
  ].filter((uri): uri is string => Boolean(uri));
  await Promise.allSettled([
    // Use the same decoded-memory cache as the two large rendered images.
    ExpoImage.prefetch([...new Set(stageUris)], 'memory-disk'),
    ...[...new Set(inlineUris)].map((uri) => Image.prefetch(uri)),
  ]);
};
