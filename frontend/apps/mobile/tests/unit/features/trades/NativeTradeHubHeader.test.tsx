import { Animated, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { NativeTradeHubHeader } from '../../../../src/features/trades/NativeTradeHubHeader';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 2.625, fontScale: 1 }),
}));

describe('NativeTradeHubHeader', () => {
  it('keeps preference first and publishes tab changes', () => {
    const onViewChange = jest.fn();
    const { getByRole } = render(
      <NativeTradeHubHeader
        activeView="preferences"
        onViewChange={onViewChange}
        scrollX={new Animated.Value(0)}
      />,
    );

    expect(getByRole('tab', { name: 'Trade Preferences' }).props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(getByRole('tab', { name: 'Trade Activity' }));
    expect(onViewChange).toHaveBeenCalledWith('activity');
  });

  it('matches the canonical trade header and opens the trade board', () => {
    const onOpenTradeBoard = jest.fn();
    const { getByRole, getByText } = render(
      <NativeTradeHubHeader
        activeView="preferences"
        assetBaseUrl="https://pokegonexus.test"
        onOpenTradeBoard={onOpenTradeBoard}
        onViewChange={jest.fn()}
      />,
    );

    expect(getByText('TRAINER EXCHANGE')).toBeTruthy();
    expect(getByRole('header', { name: 'Trades' })).toBeTruthy();
    expect(getByText('Set your preferences, respond to offers, and follow every exchange.')).toBeTruthy();
    fireEvent.press(getByRole('button', { name: 'Share board' }));
    expect(onOpenTradeBoard).toHaveBeenCalledTimes(1);
  });

  it('uses the pager value for a coordinated sliding indicator', () => {
    const { getByTestId } = render(
      <NativeTradeHubHeader
        activeView="activity"
        onViewChange={jest.fn()}
        scrollX={new Animated.Value(412)}
      />,
    );

    const style = StyleSheet.flatten(getByTestId('native-trade-hub-indicator').props.style);
    expect(style.transform).toBeTruthy();
  });
});
