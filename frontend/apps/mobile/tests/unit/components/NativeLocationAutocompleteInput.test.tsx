import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeLocationAutocompleteInput } from '../../../src/components/NativeLocationAutocompleteInput';
import { getNativeLocationSuggestions } from '../../../src/services/locationApi';

jest.mock('../../../src/services/locationApi', () => ({
  getNativeLocationSuggestions: jest.fn(),
}));

const mockedSuggestions = jest.mocked(getNativeLocationSuggestions);

describe('NativeLocationAutocompleteInput', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedSuggestions.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers and selects a location without starting a second lookup', async () => {
    mockedSuggestions.mockResolvedValue([{
      city: 'Burnaby',
      country: 'Canada',
      displayName: 'Burnaby, British Columbia, Canada',
      latitude: 49.2488,
      longitude: -122.9805,
      name: 'Burnaby',
      state_or_province: 'British Columbia',
    }]);
    const onChangeText = jest.fn();
    const screen = render(
      <NativeLocationAutocompleteInput
        accessibilityLabel="City or place"
        light={false}
        onChangeText={onChangeText}
        placeholder="City"
        value="Burnaby"
      />,
    );

    await act(async () => { jest.advanceTimersByTime(250); });
    await waitFor(() => expect(screen.getByText('Burnaby, British Columbia, Canada')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Use location Burnaby, British Columbia, Canada' }));

    expect(onChangeText).toHaveBeenCalledWith('Burnaby, British Columbia, Canada');
    expect(screen.queryByText('Burnaby, British Columbia, Canada')).toBeNull();
    expect(mockedSuggestions).toHaveBeenCalledTimes(1);
  });

  it('keeps manual entry available when suggestions fail', async () => {
    mockedSuggestions.mockRejectedValue(new Error('offline'));
    const screen = render(
      <NativeLocationAutocompleteInput
        accessibilityLabel="Location"
        light
        onChangeText={jest.fn()}
        placeholder="City"
        value="Burnaby"
      />,
    );

    await act(async () => { jest.advanceTimersByTime(250); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/You can still type a location/));
    expect(screen.getByLabelText('Location')).toBeTruthy();
  });
});
