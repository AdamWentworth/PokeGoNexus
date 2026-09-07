import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  Image as SvgImage,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import { toNativeCollectionImageSource } from './nativeCollectionImageSource';

export const NativePokemonLocationBackdrop = memo(function NativePokemonLocationBackdrop({
  uri,
  variant = 'card',
}: {
  uri: string;
  variant?: 'card' | 'instance';
}) {
  const contract = collectionExperienceParityContract.locationBackdrop;
  const mask = variant === 'instance' ? contract.instanceMask : contract.cardMask;
  return (
    <View
      accessibilityElementsHidden
      pointerEvents="none"
      style={styles.backdrop}
      testID="native-location-backdrop"
    >
      <Svg height="100%" width="100%">
        <Defs>
          <RadialGradient
            cx={mask.cx}
            cy={mask.cy}
            id="location-backdrop-mask"
            rx={mask.rx}
            ry={mask.ry}
          >
            {mask.stops.map(([offset, opacity]) => (
              <Stop
                key={offset}
                offset={offset}
                stopColor="#ffffff"
                stopOpacity={opacity}
              />
            ))}
          </RadialGradient>
          <RadialGradient
            cx="50%"
            cy="50%"
            id="location-backdrop-brightness"
            rx="50%"
            ry="50%"
          >
            <Stop
              offset="0%"
              stopColor="#ffffff"
              stopOpacity={contract.brightness.centerOpacity}
            />
            <Stop
              offset={contract.brightness.fadeOffset}
              stopColor="#ffffff"
              stopOpacity="0"
            />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
          <Mask id="location-backdrop-fade">
            <Rect fill="url(#location-backdrop-mask)" height="100%" width="100%" />
          </Mask>
        </Defs>
        <SvgImage
          height="100%"
          href={toNativeCollectionImageSource('', uri)}
          mask="url(#location-backdrop-fade)"
          preserveAspectRatio={variant === 'instance' ? 'xMidYMin slice' : 'xMidYMid slice'}
          testID="native-location-backdrop-image"
          width="100%"
        />
        <Rect
          fill="url(#location-backdrop-brightness)"
          height="100%"
          testID="native-location-backdrop-brightness"
          width="100%"
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
