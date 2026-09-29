import { useState } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeLocationAutocompleteInput } from '../../../src/components/NativeLocationAutocompleteInput';
import { getNativeLocationOptions, getNativeLocationSuggestions } from '../../../src/services/locationApi';
import { getNativeCurrentCoordinates } from '../../../src/services/deviceLocation';

jest.mock('../../../src/services/locationApi', () => ({
  getNativeLocationSuggestions: jest.fn(),
  getNativeLocationOptions: jest.fn(),
}));

jest.mock('../../../src/services/deviceLocation', () => ({ getNativeCurrentCoordinates: jest.fn() }));

const mockedCoordinates = jest.mocked(getNativeCurrentCoordinates);
const mockedOptions = jest.mocked(getNativeLocationOptions);
const mockedSuggestions = jest.mocked(getNativeLocationSuggestions);

describe('NativeLocationAutocompleteInput', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedSuggestions.mockReset();
    mockedOptions.mockReset();
    mockedCoordinates.mockReset();
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
  const renderProfileInput = (onChange = jest.fn()) => {
    const Harness = () => {
      const [value, setValue] = useState('Vernon');
      return <NativeLocationAutocompleteInput
        accessibilityLabel="Location"
        allowDeviceLocation
        light={false}
        onChangeText={(next) => { setValue(next); onChange(next); }}
        placeholder="City or region"
        suggestOnMount={false}
        value={value}
      />;
    };
    return { ...render(<Harness />), onChange };
  };

  it('waits for typing before looking up the saved profile location', async () => {
    mockedSuggestions.mockResolvedValue([{ displayName: 'Vancouver, British Columbia, Canada' }]);
    const view = renderProfileInput();
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(mockedSuggestions).not.toHaveBeenCalled();
    expect(mockedCoordinates).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByLabelText('Location'), 'Va');
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(mockedSuggestions).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByLabelText('Location'), 'Van');
    await act(async () => { jest.advanceTimersByTime(249); });
    expect(mockedSuggestions).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(mockedSuggestions).toHaveBeenCalledWith('Van');
    fireEvent.press(view.getByRole('button', { name: 'Use location Vancouver, British Columbia, Canada' }));
    expect(view.getByLabelText('Location')).toHaveProp('value', 'Vancouver, British Columbia, Canada');
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(mockedSuggestions).toHaveBeenCalledTimes(1);
  });

  it('detects only on request and keeps the current draft until a place is chosen', async () => {
    mockedCoordinates.mockResolvedValue({ latitude: 49.28, longitude: -123.12 });
    mockedOptions.mockResolvedValue([{ displayName: 'Vancouver, British Columbia, Canada' }]);
    const view = renderProfileInput();
    fireEvent.press(view.getByRole('button', { name: 'Use current location' }));
    await act(async () => {});
    expect(mockedOptions).toHaveBeenCalledWith(49.28, -123.12);
    expect(view.onChange).not.toHaveBeenCalled();
    expect(view.getByLabelText('Location')).toHaveProp('value', 'Vernon');
    fireEvent.press(view.getByRole('button', { name: 'Use location Vancouver, British Columbia, Canada' }));
    expect(view.onChange).toHaveBeenCalledWith('Vancouver, British Columbia, Canada');
    expect(view.getByLabelText('Location')).toHaveProp('value', 'Vancouver, British Columbia, Canada');
    expect(mockedSuggestions).not.toHaveBeenCalled();
  });

  it('preserves manual entry after permission denial and permits retry', async () => {
    mockedCoordinates.mockRejectedValueOnce(new Error('Location permission was not granted.'))
      .mockResolvedValueOnce({ latitude: 49.28, longitude: -123.12 });
    mockedOptions.mockResolvedValue([{ displayName: 'Vancouver' }]);
    const view = renderProfileInput();
    fireEvent.press(view.getByRole('button', { name: 'Use current location' }));
    await act(async () => {});
    expect(view.getByRole('alert')).toHaveTextContent('Location permission was not granted.');
    expect(view.getByLabelText('Location')).toHaveProp('value', 'Vernon');
    expect(view.onChange).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: 'Use current location' }));
    await act(async () => {});
    expect(view.getByRole('button', { name: 'Use location Vancouver' })).toBeTruthy();
    expect(view.queryByRole('alert')).toBeNull();
  });

  it.each(['empty', 'failed'])('keeps the draft when reverse lookup is %s', async (outcome) => {
    mockedCoordinates.mockResolvedValue({ latitude: 49.28, longitude: -123.12 });
    if (outcome === 'empty') mockedOptions.mockResolvedValue([]);
    else mockedOptions.mockRejectedValue(new Error('Location service unavailable.'));
    const view = renderProfileInput();
    fireEvent.press(view.getByRole('button', { name: 'Use current location' }));
    await act(async () => {});
    expect(view.getByRole('alert')).toBeTruthy();
    expect(view.getByLabelText('Location')).toHaveProp('value', 'Vernon');
    expect(view.onChange).not.toHaveBeenCalled();
  });

  it('ignores a late device result after typing a different location', async () => {
    let finishLookup!: (places: { displayName: string }[]) => void;
    mockedCoordinates.mockResolvedValue({ latitude: 49.28, longitude: -123.12 });
    mockedOptions.mockReturnValue(new Promise((resolve) => { finishLookup = resolve; }));
    mockedSuggestions.mockResolvedValue([{ displayName: 'Victoria' }]);
    const view = renderProfileInput();
    fireEvent.press(view.getByRole('button', { name: 'Use current location' }));
    await act(async () => {});
    fireEvent.changeText(view.getByLabelText('Location'), 'Victoria');
    await act(async () => { finishLookup([{ displayName: 'Vancouver' }]); jest.advanceTimersByTime(250); });
    expect(view.getByLabelText('Location')).toHaveProp('value', 'Victoria');
    expect(view.queryByRole('button', { name: 'Use location Vancouver' })).toBeNull();
    expect(view.getByRole('button', { name: 'Use location Victoria' })).toBeTruthy();
  });

  it('ignores a pending lookup after the editor is closed', async () => {
    let finishLookup!: (coordinates: { latitude: number; longitude: number }) => void;
    mockedCoordinates.mockReturnValue(new Promise((resolve) => { finishLookup = resolve; }));
    const view = renderProfileInput();
    fireEvent.press(view.getByRole('button', { name: 'Use current location' }));
    view.unmount();
    await act(async () => { finishLookup({ latitude: 49.28, longitude: -123.12 }); });
    expect(mockedOptions).not.toHaveBeenCalled();
    expect(view.onChange).not.toHaveBeenCalled();
  });

});
