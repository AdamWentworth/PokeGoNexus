import { Image as ExpoImage } from 'expo-image';
import { Image } from 'react-native';
import type { NativeInstanceDetail } from '../../../../src/features/collection/collectionModel';
import { nativeInstanceBackgroundPath, prefetchNativeInstanceArtwork } from '../../../../src/features/collection/nativeInstanceArtwork';

const detail = {
  row: { imageUri: 'https://example.com/shiny.png', locationBackgroundUri: 'https://example.com/location.png', typeIconUris: ['https://example.com/types/Fire.png'] },
  instance: { shadow: false, purified: false },
  moves: [{ typeIconUri: 'https://example.com/types/Fire.png' }],
} as NativeInstanceDetail;

afterEach(() => jest.restoreAllMocks());

test('prepares the actual artwork and background in the rendered image cache', async () => {
  const stage = jest.spyOn(ExpoImage, 'prefetch').mockResolvedValue(true);
  const inline = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
  await prefetchNativeInstanceArtwork(detail, 'https://example.com');
  expect(stage).toHaveBeenCalledWith(['https://example.com/shiny.png', 'https://example.com/images/backgrounds/bg_fire.png'], 'memory-disk');
  expect(inline).toHaveBeenCalledTimes(2);
  expect(inline).toHaveBeenCalledWith('https://example.com/location.png');
  expect(inline).toHaveBeenCalledWith('https://example.com/types/Fire.png');
});

test('a failed prefetch is harmless, including when offline', async () => {
  jest.spyOn(ExpoImage, 'prefetch').mockRejectedValue(new Error('offline'));
  jest.spyOn(Image, 'prefetch').mockRejectedValue(new Error('offline'));
  await expect(prefetchNativeInstanceArtwork(detail, 'https://example.com')).resolves.toBeUndefined();
});

test('uses the same shadow, purified, lucky and edited-type background rules as the overlay', () => {
  const shadow = { ...detail, instance: { ...detail.instance!, shadow: true } };
  expect(nativeInstanceBackgroundPath(shadow)).toBe('/images/backgrounds/bg_shadow.png');
  expect(nativeInstanceBackgroundPath(shadow, { purified: true })).toBe('/images/backgrounds/bg_fire.png');
  expect(nativeInstanceBackgroundPath(detail, { lucky: true })).toBe('/images/backgrounds/bg_lucky.png');
  expect(nativeInstanceBackgroundPath(detail, { typeIconUris: ['https://example.com/types/dragon.png'] })).toBe('/images/backgrounds/bg_dragon.png');
});
