import {
  clearNativeInstanceNavigationContext,
  getNativeInstanceNavigationContext,
  navigateNativeInstanceSibling,
  resolveNativeInstanceNeighbors,
  setNativeInstanceNavigationContext,
} from '../../../../src/features/collection/nativeInstanceNavigationContext';

describe('native instance navigation context', () => {
  afterEach(clearNativeInstanceNavigationContext);

  it('preserves the filtered and sorted grid order for overlay navigation', () => {
    setNativeInstanceNavigationContext(['third', 'second', 'second', 'first']);

    expect(getNativeInstanceNavigationContext()).toEqual({
      orderedInstanceIds: ['third', 'second', 'first'],
    });
    expect(resolveNativeInstanceNeighbors({
      instanceId: 'second',
      fallbackIds: ['first', 'second', 'third'],
    })).toEqual({ previousId: 'third', nextId: 'first' });
  });

  it('uses the full collection only for direct links outside the saved context', () => {
    setNativeInstanceNavigationContext(['favorite-1']);

    expect(resolveNativeInstanceNeighbors({
      instanceId: 'second',
      fallbackIds: ['first', 'second', 'third'],
    })).toEqual({ previousId: 'first', nextId: 'third' });
  });

  it('updates sibling instance parameters in place so the overlay owns the entire swipe animation', () => {
    const router = {
      replace: jest.fn(),
      setParams: jest.fn(),
    };

    navigateNativeInstanceSibling(router, 'next-instance');

    expect(router.setParams).toHaveBeenCalledWith({ instanceId: 'next-instance' });
    expect(router.replace).not.toHaveBeenCalled();
  });
});
