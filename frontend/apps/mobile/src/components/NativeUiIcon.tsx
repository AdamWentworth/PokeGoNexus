import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type NativeUiIconName =
  | 'blocked'
  | 'catalog'
  | 'chart'
  | 'calculator'
  | 'calendar'
  | 'check'
  | 'clock'
  | 'filters'
  | 'fist'
  | 'flag'
  | 'flask'
  | 'eye'
  | 'email'
  | 'heart'
  | 'help'
  | 'diamond'
  | 'download'
  | 'info'
  | 'id-card'
  | 'key'
  | 'link'
  | 'list'
  | 'laptop'
  | 'map'
  | 'medal'
  | 'search'
  | 'ruler'
  | 'scale'
  | 'share'
  | 'shield'
  | 'sliders'
  | 'target'
  | 'trophy'
  | 'trade'
  | 'trainers'
  | 'play'
  | 'pokeball'
  | 'star'
  | 'sign-out'
  | 'trash'
  | 'user'
  | 'bolt';

type Props = {
  color?: string;
  name: NativeUiIconName;
  size?: number;
};

/**
 * Small interface icons shared by native screens.
 *
 * The Vite app uses one React Icons vocabulary across navigation and controls.
 * Keeping the native equivalents here prevents platform-dependent Unicode
 * glyphs from changing shape, baseline, or meaning between Android and iOS.
 */
export const NativeUiIcon = ({ color = '#ffffff', name, size = 16 }: Props) => (
  <Svg
    height={size}
    pointerEvents="none"
    viewBox="0 0 24 24"
    width={size}
  >
    {name === 'search' ? (
      <Path d="M10.6 3.5a7.1 7.1 0 1 0 4.45 12.63l4.01 4.02 1.42-1.42-4.01-4.01A7.1 7.1 0 0 0 10.6 3.5Zm0 2a5.1 5.1 0 1 1 0 10.2 5.1 5.1 0 0 1 0-10.2Z" fill={color} />
    ) : null}
    {name === 'eye' ? (
      <>
        <Path d="M2.2 12S5.8 5.7 12 5.7 21.8 12 21.8 12 18.2 18.3 12 18.3 2.2 12 2.2 12Z" fill="none" stroke={color} strokeLinejoin="round" strokeWidth={2} />
        <Circle cx={12} cy={12} fill={color} r={3} />
      </>
    ) : null}
    {name === 'email' ? (
      <Path d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.4l9 5.6 9-5.6V7H3Zm18 10V9.8l-8.5 5.3a1 1 0 0 1-1 0L3 9.8V17h18Z" fill={color} />
    ) : null}
    {name === 'heart' ? (
      <Path d="M12 20.5 4.2 13C-.2 8.8 2.8 3 7.2 3c2.1 0 3.8 1.1 4.8 2.6C13 4.1 14.7 3 16.8 3c4.4 0 7.4 5.8 3 10L12 20.5Z" fill={color} />
    ) : null}
    {name === 'help' ? (
      <>
        <Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} />
        <Path d="M8.8 9a3.25 3.25 0 1 1 4.3 3.08c-.83.3-1.1.66-1.1 1.42v.5" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2} />
        <Circle cx={12} cy={17.5} fill={color} r={1.25} />
      </>
    ) : null}
    {name === 'diamond' ? (
      <Path d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Zm0 3L5.8 12l6.2 6.2 6.2-6.2L12 5.8Z" fill={color} />
    ) : null}
    {name === 'download' ? (
      <Path d="M11 3h2v10.2l3.1-3.1 1.4 1.4-5.5 5.5-5.5-5.5 1.4-1.4 3.1 3.1V3ZM4 18h16v3H4v-3Z" fill={color} />
    ) : null}
    {name === 'trainers' ? (
      <>
        <Circle cx={8} cy={8} fill={color} r={3.2} />
        <Circle cx={16} cy={8.5} fill={color} r={2.7} />
        <Path d="M2.5 19c.3-4.2 2.3-6.3 5.5-6.3s5.2 2.1 5.5 6.3H2.5Zm9.2 0c.2-3.5 1.7-5.3 4.4-5.3 2.8 0 4.5 1.8 4.8 5.3h-9.2Z" fill={color} />
      </>
    ) : null}
    {name === 'sliders' || name === 'filters' ? (
      <Path d="M4 6h7v2H4V6Zm11 0h5v2h-5V6Zm-2-2h2v6h-2V4ZM4 16h5v2H4v-2Zm9 0h7v2h-7v-2Zm-4-2h2v6H9v-6Z" fill={color} />
    ) : null}
    {name === 'trade' ? (
      <Path d="M7.4 5 3 9.4 7.4 13l1.3-1.5L6.8 10H17V8H6.8l1.9-1.5L7.4 5Zm9.2 6L15.3 12.5l1.9 1.5H7v2h10.2l-1.9 1.5 1.3 1.5 4.4-4.4-4.4-3.6Z" fill={color} />
    ) : null}
    {name === 'list' ? (
      <>
        <Circle cx={4.5} cy={6} fill={color} r={1.4} />
        <Circle cx={4.5} cy={12} fill={color} r={1.4} />
        <Circle cx={4.5} cy={18} fill={color} r={1.4} />
        <Rect fill={color} height={2} rx={1} width={13} x={8} y={5} />
        <Rect fill={color} height={2} rx={1} width={13} x={8} y={11} />
        <Rect fill={color} height={2} rx={1} width={13} x={8} y={17} />
      </>
    ) : null}
    {name === 'map' ? (
      <Path d="M12 2.7a6.3 6.3 0 0 0-6.3 6.3c0 4.6 6.3 12.2 6.3 12.2S18.3 13.6 18.3 9A6.3 6.3 0 0 0 12 2.7Zm0 3.5A2.8 2.8 0 1 1 12 11.8 2.8 2.8 0 0 1 12 6.2Z" fill={color} />
    ) : null}
    {name === 'medal' ? (
      <>
        <Path d="M6 2h4.2l1.8 4 1.8-4H18l-3.2 7.1H9.2L6 2Z" fill={color} />
        <Circle cx={12} cy={15} fill="none" r={6} stroke={color} strokeWidth={2.4} />
        <Path d="m12 11.4 1.1 2.2 2.5.4-1.8 1.8.4 2.5-2.2-1.2-2.2 1.2.4-2.5L8.4 14l2.5-.4 1.1-2.2Z" fill={color} />
      </>
    ) : null}
    {name === 'ruler' ? (
      <Path d="M14.2 2.8a2 2 0 0 1 2.8 0L21.2 7a2 2 0 0 1 0 2.8L9.8 21.2a2 2 0 0 1-2.8 0L2.8 17a2 2 0 0 1 0-2.8L14.2 2.8Zm1.4 1.4L4.2 15.6l4.2 4.2 1.4-1.4-2.1-2.1 1.4-1.4 1.4 1.4 1.4-1.4-2.1-2.1 1.4-1.4 1.4 1.4L14 11.4l-2.1-2.1 1.4-1.4 1.4 1.4 1.4-1.4L14 5.6l1.6-1.4Z" fill={color} />
    ) : null}
    {name === 'clock' ? (
      <Path d="M12 3a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9Zm0 2a7 7 0 1 1-7 7 7.01 7.01 0 0 1 7-7Zm-1 2v6h5v-2h-3V7h-2Z" fill={color} />
    ) : null}
    {name === 'calendar' ? (
      <Path d="M7 2.5h2V5h6V2.5h2V5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2V2.5ZM5 10v9h14v-9H5Zm0-3v1h14V7H5Z" fill={color} />
    ) : null}
    {name === 'id-card' ? (
      <Path d="M3 4h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v12h18V6H3Zm4.5 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8ZM4.2 16c.2-1.7 1.3-2.6 3.3-2.6s3.1.9 3.3 2.6H4.2Zm8.8-7h6v2h-6V9Zm0 4h5v2h-5v-2Z" fill={color} />
    ) : null}
    {name === 'key' ? (
      <Path d="M14.8 3a6.2 6.2 0 0 0-5.9 8.1L2 18v4h4v-2h2v-2h2.1l1.7-1.7A6.2 6.2 0 1 0 14.8 3Zm0 2a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Zm1.5 1.8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill={color} />
    ) : null}
    {name === 'link' ? (
      <Path d="M9.6 14.4a1 1 0 0 1 0-1.4l3.4-3.4a1 1 0 1 1 1.4 1.4L11 14.4a1 1 0 0 1-1.4 0Zm-3.9 4a4 4 0 0 1 0-5.7l3-3a4 4 0 0 1 5.1-.5l-1.5 1.5a2 2 0 0 0-2.2.4l-3 3a2 2 0 1 0 2.8 2.8l3-3c.5-.5.7-1.3.4-2l1.5-1.5a4 4 0 0 1-.5 4.9l-3 3a4 4 0 0 1-5.6.1Zm4.5-3.6a4 4 0 0 1 .5-4.9l3-3a4 4 0 1 1 5.6 5.7l-3 3a4 4 0 0 1-5.1.5l1.5-1.5a2 2 0 0 0 2.2-.4l3-3a2 2 0 1 0-2.8-2.8l-3 3c-.5.5-.7 1.3-.4 2l-1.5 1.4Z" fill={color} />
    ) : null}
    {name === 'blocked' ? (
      <Path d="M12 3a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9ZM5 12a7 7 0 0 1 11.4-5.45L6.55 16.4A6.97 6.97 0 0 1 5 12Zm2.6 5.45 9.85-9.85A7 7 0 0 1 7.6 17.45Z" fill={color} />
    ) : null}
    {name === 'check' ? (
      <Path d="m9.5 17.2-5-5 1.5-1.5 3.5 3.5 8.5-8.5 1.5 1.5-10 10Z" fill={color} />
    ) : null}
    {name === 'catalog' ? (
      <Path d="M3 4.5h6.1A3.9 3.9 0 0 1 12 5.8v14.1a4.7 4.7 0 0 0-3.5-1.4H3v-14Zm18 0h-6.1A3.9 3.9 0 0 0 12 5.8v14.1a4.7 4.7 0 0 1 3.5-1.4H21v-14Z" fill={color} />
    ) : null}
    {name === 'pokeball' ? (
      <>
        <Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} />
        <Path d="M3 11h6.1a3.2 3.2 0 0 1 5.8 0H21v2h-6.1a3.2 3.2 0 0 1-5.8 0H3v-2Z" fill={color} />
        <Circle cx={12} cy={12} fill="none" r={1.8} stroke={color} strokeWidth={1.6} />
      </>
    ) : null}
    {name === 'star' ? (
      <Path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9L12 2.5Z" fill={color} />
    ) : null}
    {name === 'user' ? (
      <>
        <Circle cx={12} cy={7.5} fill={color} r={4} />
        <Path d="M4 21c.3-5.2 3-7.8 8-7.8s7.7 2.6 8 7.8H4Z" fill={color} />
      </>
    ) : null}
    {name === 'sign-out' ? (
      <Path d="M4 3h9v2H6v14h7v2H4V3Zm12.6 4.2L22 12l-5.4 4.8-1.3-1.5 2.7-2.3H9v-2h9l-2.7-2.3 1.3-1.5Z" fill={color} />
    ) : null}
    {name === 'laptop' ? (
      <Path d="M5 4h14a2 2 0 0 1 2 2v10h2v2a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-2h2V6a2 2 0 0 1 2-2Zm0 2v10h14V6H5Zm-2 12h18H3Z" fill={color} />
    ) : null}
    {name === 'trash' ? (
      <Path d="M8 3h8l1 2h4v2H3V5h4l1-2Zm-2 6h12l-1 12H7L6 9Zm3 2 .6 8h1.8l-.2-8H9Zm3.8 0-.2 8h1.8l.6-8h-2.2Z" fill={color} />
    ) : null}
    {name === 'chart' ? (
      <Path d="M4 20V4h2v14h15v2H4Zm4-4V9h3v7H8Zm5 0V5h3v11h-3Zm5 0v-4h3v4h-3Z" fill={color} />
    ) : null}
    {name === 'target' ? (
      <>
        <Circle cx={12} cy={12} fill="none" r={8.5} stroke={color} strokeWidth={2} />
        <Circle cx={12} cy={12} fill="none" r={4.5} stroke={color} strokeWidth={2} />
        <Circle cx={12} cy={12} fill={color} r={1.7} />
      </>
    ) : null}
    {name === 'trophy' ? (
      <Path d="M7 3h10v3h4v2c0 3.2-1.8 5.2-5 5.7A6.1 6.1 0 0 1 13 16v2h4v3H7v-3h4v-2a6.1 6.1 0 0 1-3-2.3C4.8 13.2 3 11.2 3 8V6h4V3Zm0 5H5c0 1.6.7 2.7 2.2 3.3A9.7 9.7 0 0 1 7 9.5V8Zm10 0v1.5c0 .6-.1 1.2-.2 1.8C18.3 10.7 19 9.6 19 8h-2Z" fill={color} />
    ) : null}
    {name === 'flask' ? (
      <Path d="M8 3h8v2h-1v5.1l4.6 7.4A2.3 2.3 0 0 1 17.65 21H6.35a2.3 2.3 0 0 1-1.95-3.5L9 10.1V5H8V3Zm3 2v5.7L7.15 17h9.7L13 10.7V5h-2Z" fill={color} />
    ) : null}
    {name === 'info' ? (
      <>
        <Circle cx={12} cy={12} fill="none" r={9} stroke={color} strokeWidth={2} />
        <Circle cx={12} cy={7.2} fill={color} r={1.3} />
        <Path d="M11 10.2h2V18h-2v-7.8Z" fill={color} />
      </>
    ) : null}
    {name === 'calculator' ? (
      <Path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 3v4h12V6H6Zm0 7v2h2v-2H6Zm5 0v2h2v-2h-2Zm5 0v5h2v-5h-2ZM6 17v2h2v-2H6Zm5 0v2h2v-2h-2Z" fill={color} />
    ) : null}
    {name === 'flag' ? (
      <Path d="M5 3h2v18H5V3Zm2 1h11l-2.3 4L18 12H7V4Z" fill={color} />
    ) : null}
    {name === 'fist' ? (
      <Path d="M7.2 11.2V6.5a1.5 1.5 0 0 1 3 0v3.2h.7V5.5a1.5 1.5 0 0 1 3 0v4.2h.7V6.4a1.5 1.5 0 0 1 3 0v4.1h.7V8.2a1.4 1.4 0 0 1 2.8 0v5.2c0 5.1-3 7.6-7.7 7.6h-1.1C8 21 5.5 18.7 4 15.3l-1-2.2a1.6 1.6 0 0 1 2.8-1.5l1.4 2.2v-2.6Z" fill={color} />
    ) : null}
    {name === 'bolt' ? (
      <Path d="M13.2 2 5.8 13h5L9.9 22l8.3-12h-5.1l.1-8Z" fill={color} />
    ) : null}
    {name === 'play' ? (
      <Path d="M7 4.5 19 12 7 19.5v-15Z" fill={color} />
    ) : null}
    {name === 'scale' ? (
      <Path d="M11 4h2v15h4v2H7v-2h4V4Zm-6 3h14v2H5V7Zm0 2 3.5 6H1.5L5 9Zm14 0 3.5 6h-7L19 9ZM2 16h6a3 3 0 0 1-6 0Zm14 0h6a3 3 0 0 1-6 0Z" fill={color} />
    ) : null}
    {name === 'share' ? (
      <>
        <Path d="M7.4 9.5 16 6.1M7.4 14.5 16 18" fill="none" stroke={color} strokeLinecap="round" strokeWidth={2.2} />
        <Circle cx={5} cy={12} fill={color} r={3} />
        <Circle cx={19} cy={5} fill={color} r={3} />
        <Circle cx={19} cy={19} fill={color} r={3} />
      </>
    ) : null}
    {name === 'shield' ? (
      <Path d="M12 2.5 20 5v6.2c0 5-3.1 8.6-8 10.3-4.9-1.7-8-5.3-8-10.3V5l8-2.5Zm0 2.1L6 6.5v4.7c0 3.8 2.2 6.6 6 8.1 3.8-1.5 6-4.3 6-8.1V6.5l-6-1.9Z" fill={color} />
    ) : null}
  </Svg>
);
