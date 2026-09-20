import Svg, { Path } from 'react-native-svg';

type Props = {
  color?: string;
  size?: number;
};

/** Canonical route-back glyph used by the Vite product header. Keeping the
 * vector here avoids platform-dependent chevron font rendering on Android. */
export const NativeBackIcon = ({ color = '#ffffff', size = 18 }: Props) => (
  <Svg height={size} viewBox="0 0 24 24" width={size}>
    <Path
      d="M20 12H5m6.5-6.5L5 12l6.5 6.5"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.6}
    />
  </Svg>
);
