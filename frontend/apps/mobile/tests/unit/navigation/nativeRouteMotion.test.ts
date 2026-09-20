import { nativeRouteAnimation } from '../../../src/navigation/nativeRouteMotion';

describe('nativeRouteAnimation', () => {
  it('preserves the canonical route transition when motion is enabled', () => {
    expect(nativeRouteAnimation('slide_from_bottom', false)).toBe('slide_from_bottom');
    expect(nativeRouteAnimation('slide_from_right', false)).toBe('slide_from_right');
    expect(nativeRouteAnimation('fade', false)).toBe('fade');
  });

  it('removes every route transition when reduced motion is enabled', () => {
    expect(nativeRouteAnimation('slide_from_bottom', true)).toBe('none');
    expect(nativeRouteAnimation('slide_from_right', true)).toBe('none');
    expect(nativeRouteAnimation('fade', true)).toBe('none');
  });
});
