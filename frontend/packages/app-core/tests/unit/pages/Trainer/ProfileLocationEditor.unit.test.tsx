import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProfileLocationEditor from '@/pages/Trainer/ProfileLocationEditor';
import type { LocationSuggestion } from '@/types/location';

const mocks = vi.hoisted(() => ({ suggestions: vi.fn(), reverse: vi.fn() }));
vi.mock('@/services/locationServices', () => ({
  fetchSuggestions: mocks.suggestions,
  fetchLocationOptions: mocks.reverse,
}));

const kelowna = { displayName: 'Kelowna, British Columbia, Canada' };
const vancouver = { displayName: 'Vancouver, British Columbia, Canada' };

const Editor = ({ onChange = vi.fn() }: { onChange?: (value: string) => void }) => {
  const [value, setValue] = useState('Vernon');
  return <ProfileLocationEditor value={value} onChange={(nextValue) => {
    onChange(nextValue);
    setValue(nextValue);
  }} />;
};

const input = () => screen.getByRole('textbox', { name: 'Location' });
const locate = () => fireEvent.click(screen.getByRole('button', { name: 'Use current location' }));
const advanceSearch = () => act(async () => { await vi.advanceTimersByTimeAsync(250); });

const mockGeolocation = () => {
  const getCurrentPosition = vi.fn();
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  return getCurrentPosition;
};

const position = { coords: { latitude: 49.8, longitude: -119.5 } } as GeolocationPosition;

describe('ProfileLocationEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.suggestions.mockReset().mockResolvedValue([kelowna]);
    mocks.reverse.mockReset().mockResolvedValue([kelowna, vancouver]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('debounces autocomplete and ignores an older response after selecting a newer result', async () => {
    let resolveOld!: (value: LocationSuggestion[]) => void;
    mocks.suggestions.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    render(<Editor />);
    fireEvent.change(input(), { target: { value: 'Van' } });
    expect(mocks.suggestions).not.toHaveBeenCalled();
    await advanceSearch();
    fireEvent.change(input(), { target: { value: 'Kelo' } });
    fireEvent.change(input(), { target: { value: 'Kelowna' } });
    await advanceSearch();
    expect(mocks.suggestions.mock.calls).toEqual([['Van'], ['Kelowna']]);
    fireEvent.click(screen.getByRole('button', { name: kelowna.displayName }));
    await act(async () => { resolveOld([vancouver]); });
    expect(input()).toHaveValue(kelowna.displayName);
    expect(screen.queryByRole('list', { name: 'Location suggestions' })).not.toBeInTheDocument();
  });

  it('clears suggestions when the query becomes too short and shows empty-search feedback', async () => {
    mocks.suggestions.mockResolvedValue([]);
    render(<Editor />);
    fireEvent.change(input(), { target: { value: 'Unknown City' } });
    await advanceSearch();
    expect(screen.getByRole('status')).toHaveTextContent('No locations found');
    fireEvent.change(input(), { target: { value: 'Ke' } });
    await advanceSearch();
    expect(mocks.suggestions).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('requests device location only on demand and waits for the user to choose a broad place', async () => {
    const onChange = vi.fn();
    const getCurrentPosition = mockGeolocation();
    render(<Editor onChange={onChange} />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    locate();
    await act(async () => { await getCurrentPosition.mock.calls[0][0](position); });
    expect(mocks.reverse).toHaveBeenCalledWith(49.8, -119.5);
    expect(input()).toHaveValue('Vernon');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Choose the location to show');
    fireEvent.click(screen.getByRole('button', { name: kelowna.displayName }));
    expect(onChange).toHaveBeenCalledWith(kelowna.displayName);
    expect(input()).toHaveValue(kelowna.displayName);
  });

  it('keeps city search available after location permission is denied', async () => {
    const getCurrentPosition = mockGeolocation();
    render(<Editor />);
    locate();
    act(() => { getCurrentPosition.mock.calls[0][1]({ code: 1 }); });
    expect(screen.getByRole('status')).toHaveTextContent('Location access was denied');
    expect(input()).toHaveValue('Vernon');
    fireEvent.change(input(), { target: { value: 'Kelowna' } });
    await advanceSearch();
    expect(screen.getByRole('button', { name: kelowna.displayName })).toBeEnabled();
  });

  it('offers manual search when device location or reverse lookup is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const { unmount } = render(<Editor />);
    locate();
    expect(screen.getByRole('status')).toHaveTextContent('unavailable in this browser');
    unmount();
    const getCurrentPosition = mockGeolocation();
    mocks.reverse.mockRejectedValueOnce(new Error('Offline'));
    render(<Editor />);
    locate();
    await act(async () => { await getCurrentPosition.mock.calls[0][0](position); });
    expect(screen.getByRole('status')).toHaveTextContent('Unable to find nearby locations');
    expect(screen.getByRole('button', { name: 'Use current location' })).toBeEnabled();
    expect(input()).toHaveValue('Vernon');
  });

  it('ignores a GPS callback after typing a new city or leaving the editor', async () => {
    const getCurrentPosition = mockGeolocation();
    const onChange = vi.fn();
    const { unmount } = render(<Editor onChange={onChange} />);
    locate();
    fireEvent.change(input(), { target: { value: 'Kelowna' } });
    await act(async () => { await getCurrentPosition.mock.calls[0][0](position); });
    expect(mocks.reverse).not.toHaveBeenCalled();
    await advanceSearch();
    locate();
    unmount();
    await act(async () => { await getCurrentPosition.mock.calls[1][0](position); });
    expect(mocks.reverse).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
