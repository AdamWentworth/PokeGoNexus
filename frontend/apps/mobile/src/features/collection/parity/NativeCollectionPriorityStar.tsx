import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = {
  label?: string;
  size: number;
  style?: StyleProp<ViewStyle>;
  tone: 'favorite' | 'most-wanted';
};

const COLORS = {
  favorite: '#ffd21c',
  'most-wanted': '#ff7043',
} as const;

/** Native rendering of the canonical web CollectionPriorityStar SVG. */
export const NativeCollectionPriorityStar = memo(function NativeCollectionPriorityStar({
  label,
  size,
  style,
  tone,
}: Props) {
  const color = COLORS[tone];
  return (
    <View
      accessibilityElementsHidden={!label}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
      style={[{ width: size, height: size }, style]}
    >
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Path
          d="m12 2.75 2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.35l-5.72 3.01 1.09-6.37-4.63-4.51 6.4-.93L12 2.75Z"
          fill={color}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth="1.75"
        />
      </Svg>
    </View>
  );
});
