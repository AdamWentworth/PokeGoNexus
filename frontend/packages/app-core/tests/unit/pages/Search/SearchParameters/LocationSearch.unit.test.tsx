import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import LocationSearch from '@/pages/Search/SearchParameters/LocationSearch';

const fetchSuggestionsMock = vi.fn();

vi.mock('@/services/locationServices', () => ({
  fetchSuggestions: (query: string) => fetchSuggestionsMock(query),
}));

type Coordinates = {
  latitude: number | null;
  longitude: number | null;
};

type Props = React.ComponentProps<typeof LocationSearch>;

const createProps = (overrides: Partial<Props> = {}): Props => ({
  city: '',
  setCity: vi.fn(),
  useCurrentLocation: false,
  setUseCurrentLocation: vi.fn(),
  setCoordinates: vi.fn(),
  range: 5,
  setRange: vi.fn(),
  resultsLimit: 10,
  setResultsLimit: vi.fn(),
  handleSearch: vi.fn(),
  isLoading: false,
  view: 'list',
  setView: vi.fn(),
  setSelectedBoundary: vi.fn(),
  ...overrides,
});

describe('LocationSearch', () => {
  beforeEach(() => {
    fetchSuggestionsMock.mockReset();
    localStorage.clear();
  });

  it('fetches suggestions for 3+ chars and applies selected suggestion data', async () => {
    fetchSuggestionsMock.mockResolvedValueOnce([
      {
        displayName: 'Seattle, WA, USA',
        latitude: 47.6062,
        longitude: -122.3321,
        boundary: 'BOUNDARY-WKT',
      },
    ]);

    const setCity = vi.fn();
    const setCoordinates = vi.fn() as React.Dispatch<
      React.SetStateAction<Coordinates>
    >;
    const setSelectedBoundary = vi.fn() as React.Dispatch<
      React.SetStateAction<string | null>
    >;

    render(
      <LocationSearch
        {...createProps({ setCity, setCoordinates, setSelectedBoundary })}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Search for a city'), {
      target: { value: 'Sea' },
    });

    await waitFor(() => {
      expect(fetchSuggestionsMock).toHaveBeenCalledWith('Sea');
    });

    fireEvent.click(screen.getByText('Seattle, WA, USA'));

    expect(setCity).toHaveBeenCalledWith('Sea');
    expect(setCity).toHaveBeenLastCalledWith('Seattle, WA, USA');
    expect(setCoordinates).toHaveBeenCalledWith({
      latitude: 47.6062,
      longitude: -122.3321,
    });
    expect(setSelectedBoundary).toHaveBeenCalledWith('BOUNDARY-WKT');
  });

  it('clears suggestions on outside click', async () => {
    fetchSuggestionsMock.mockResolvedValueOnce([
      {
        displayName: 'Seattle, WA, USA',
        latitude: 47.6062,
        longitude: -122.3321,
      },
    ]);

    render(<LocationSearch {...createProps()} />);

    fireEvent.change(screen.getByPlaceholderText('Search for a city'), {
      target: { value: 'Sea' },
    });

    await screen.findByText('Seattle, WA, USA');
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Seattle, WA, USA')).not.toBeInTheDocument();
    });
  });

  it('toggles current location mode and uses persisted coordinates', () => {
    localStorage.setItem(
      'location',
      JSON.stringify({ latitude: 40.7128, longitude: -74.006 }),
    );

    const setCity = vi.fn();
    const setUseCurrentLocation = vi.fn();
    const setCoordinates = vi.fn();

    render(
      <LocationSearch
        {...createProps({ setCity, setUseCurrentLocation, setCoordinates })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use saved location/ }));

    expect(setUseCurrentLocation).toHaveBeenCalledWith(true);
    expect(setCity).toHaveBeenCalledWith('');
    expect(setCoordinates).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
    });
  });

  it('does not fetch suggestions for short input', async () => {
    render(<LocationSearch {...createProps()} />);

    fireEvent.change(screen.getByPlaceholderText('Search for a city'), {
      target: { value: 'Se' },
    });

    await waitFor(() => {
      expect(fetchSuggestionsMock).not.toHaveBeenCalled();
    });
  });

  it('keeps custom location active when no saved location exists', () => {
    const setUseCurrentLocation = vi.fn();
    const setCoordinates = vi.fn();
    render(
      <LocationSearch
        {...createProps({ setUseCurrentLocation, setCoordinates })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Use saved location/ }));

    expect(setUseCurrentLocation).not.toHaveBeenCalled();
    expect(setCoordinates).not.toHaveBeenCalled();
    expect(
      screen.getByText('No saved location is available. Search for a city instead.'),
    ).toBeInTheDocument();
  });

  it('updates search radius and result count independently', () => {
    const setRange = vi.fn();
    const setResultsLimit = vi.fn();
    render(
      <LocationSearch {...createProps({ setRange, setResultsLimit })} />,
    );

    fireEvent.change(screen.getByLabelText('Search radius'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('Maximum results'), {
      target: { value: '50' },
    });

    expect(setRange).toHaveBeenCalledWith(20);
    expect(setResultsLimit).toHaveBeenCalledWith(50);
  });
});
