import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NativePasswordResetOverlay } from '../../../src/components/NativePasswordResetOverlay';

describe('NativePasswordResetOverlay', () => {
  it('validates an identifier without leaving the login surface', () => {
    render(
      <NativePasswordResetOverlay
        onClose={jest.fn()}
        onRequest={jest.fn()}
        onRequested={jest.fn()}
        visible
      />,
    );
    fireEvent.press(screen.getByText('Email reset link'));
    expect(screen.getByText('Please enter your username or email.')).toBeTruthy();
  });

  it('requests recovery without revealing account existence', async () => {
    const onRequest = jest.fn().mockResolvedValue(undefined);
    const onRequested = jest.fn();
    render(
      <NativePasswordResetOverlay
        onClose={jest.fn()}
        onRequest={onRequest}
        onRequested={onRequested}
        visible
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Recovery username or email'), ' misty@example.com ');
    fireEvent.press(screen.getByText('Email reset link'));
    await waitFor(() => expect(onRequest).toHaveBeenCalledWith('misty@example.com'));
    expect(onRequested).toHaveBeenCalledTimes(1);
  });
});
