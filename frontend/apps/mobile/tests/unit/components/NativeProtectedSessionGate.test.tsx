import { fireEvent, render, screen } from '@testing-library/react-native';
import { NativeProtectedSessionGate } from '../../../src/components/NativeProtectedSessionGate';

describe('NativeProtectedSessionGate', () => {
  it('holds a protected deep link in place while the secure session restores', () => {
    render(
      <NativeProtectedSessionGate
        message="Opening Pokémon…"
        onRetry={jest.fn()}
        status="restoring"
      />,
    );

    expect(screen.getByTestId('native-protected-session-gate')).toBeTruthy();
    expect(screen.getByText('Opening Pokémon…')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('keeps transient recovery failures on-route and retries them', () => {
    const onRetry = jest.fn().mockResolvedValue(undefined);
    render(
      <NativeProtectedSessionGate onRetry={onRetry} status="unavailable" />,
    );

    expect(screen.getByText('Session check unavailable')).toBeTruthy();
    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
