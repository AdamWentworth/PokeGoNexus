import { memo } from 'react';
import {
  Image,
  type ImageStyle,
  type StyleProp,
  StyleSheet,
} from 'react-native';
import type { CollectionParityCardFixture } from './collectionParityFixtures';

const STATUS_GLOW_SOURCE = require('../../../../assets/collection-status-glow.png');

export const NativePokemonStatusGlow = memo(function NativePokemonStatusGlow({
  ownership,
}: {
  ownership: CollectionParityCardFixture['ownership'];
}) {
  // Vite's inactive pseudo-element is visually absent. Avoid translating that
  // implementation detail into an opacity-zero native Image: Android still
  // allocates and decodes the bitmap, and a catalog projection can otherwise
  // create one useless HWUI image layer for every mounted card.
  if (!ownership) return null;

  return (
    <Image
      accessibilityElementsHidden
      fadeDuration={0}
      resizeMode="stretch"
      source={STATUS_GLOW_SOURCE}
      style={STATUS_GLOW_STYLES[ownership]}
      testID={`native-${ownership}-status-glow`}
    />
  );
});

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    // Canonical web geometry: a 140% pseudo-element is centered at 50%/45%
    // and scaled to 0.5, producing a 70% glow centered slightly above the
    // card midpoint. The component is therefore mounted against the card,
    // not the smaller image stage, and expresses the effective geometry
    // directly instead of relying on a second transform.
    top: '10%',
    left: '15%',
    width: '70%',
    height: '70%',
  },
  caught: { opacity: 1, tintColor: '#0077ff' },
  trade: { opacity: 1, tintColor: '#28a745' },
  wanted: { opacity: 1, tintColor: '#dc3545' },
});

const STATUS_GLOW_STYLES: Record<
  NonNullable<CollectionParityCardFixture['ownership']>,
  StyleProp<ImageStyle>
> = {
  caught: [styles.glow, styles.caught],
  trade: [styles.glow, styles.trade],
  wanted: [styles.glow, styles.wanted],
};
