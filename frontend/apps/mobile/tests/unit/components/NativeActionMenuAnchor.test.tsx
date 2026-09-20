import { fireEvent, render } from '@testing-library/react-native';
import { Image, StyleSheet } from 'react-native';
import { NativeActionMenuAnchor } from '../../../src/components/NativeActionMenuAnchor';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

describe('NativeActionMenuAnchor', () => {
  it('uses the canonical transparent Poké Ball control and respects the bottom safe area', () => {
    const onPress = jest.fn();
    const prefetch = jest.spyOn(Image, 'prefetch').mockResolvedValue(true);
    const { getByLabelText } = render(
      <NativeActionMenuAnchor assetBaseUrl="https://pokegonexus.com" onPress={onPress} />,
    );

    const anchor = getByLabelText('Open action menu');
    expect(StyleSheet.flatten(anchor.props.style)).toMatchObject({
      backgroundColor: 'transparent',
      borderRadius: 25,
      bottom: 34,
      height: 50,
      marginLeft: -25,
      width: 50,
    });
    fireEvent.press(anchor);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith('https://pokegonexus.com/images/btn_raid.png');
    expect(prefetch).toHaveBeenCalledWith('https://pokegonexus.com/images/close-button-light.png');
    prefetch.mockRestore();
  });
});
