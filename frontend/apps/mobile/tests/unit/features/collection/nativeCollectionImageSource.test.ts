import {
  toNativeCollectionAssetUrl,
  toNativeCollectionImageSource,
} from '../../../../src/features/collection/parity/nativeCollectionImageSource';

describe('native collection image sources', () => {
  it('resolves local asset paths without changing absolute image URLs', () => {
    expect(toNativeCollectionAssetUrl('https://pokegonexus.com/', '/images/1.png')).toBe(
      'https://pokegonexus.com/images/1.png',
    );
    expect(toNativeCollectionAssetUrl('https://unused.example', 'https://cdn.example/1.png')).toBe(
      'https://cdn.example/1.png',
    );
  });

  it('reuses a force-cached source object when a recycled grid slot shows the same image', () => {
    const initial = toNativeCollectionImageSource(
      'https://pokegonexus.com',
      '/images/normal/pokemon_1.png',
    );
    const recycled = toNativeCollectionImageSource(
      'https://pokegonexus.com/',
      'images/normal/pokemon_1.png',
    );

    expect(recycled).toBe(initial);
    expect(initial).toEqual({
      cache: 'force-cache',
      uri: 'https://pokegonexus.com/images/normal/pokemon_1.png',
    });
  });
});
