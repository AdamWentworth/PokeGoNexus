import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeActionMenuHint } from '../../../src/components/NativeActionMenuHint';

describe('NativeActionMenuHint', () => {
  it('opens the menu and acknowledges the persistent explanation', () => {
    const onDismiss = jest.fn();
    const onOpen = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeActionMenuHint
          assetBaseUrl="https://pokegonexus.com"
          audience="guest"
          onDismiss={onDismiss}
          onOpen={onOpen}
        />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Tap the Poké Ball below to explore the app.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open action menu from tip'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Action menu tip')).toBeNull();
  });

  it('dismisses itself without requiring its parent Home screen to render again', () => {
    const onDismiss = jest.fn();
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, right: 0, bottom: 20, left: 0 } }}>
        <NativeActionMenuHint
          assetBaseUrl="https://pokegonexus.com"
          onDismiss={onDismiss}
          onOpen={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('Dismiss action menu tip'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Action menu tip')).toBeNull();
  });
});
