export type NativeRouteAnimation =
  | 'fade'
  | 'none'
  | 'slide_from_bottom'
  | 'slide_from_right';

export const nativeRouteAnimation = (
  animation: NativeRouteAnimation,
  shouldReduceMotion: boolean,
): NativeRouteAnimation => shouldReduceMotion ? 'none' : animation;
