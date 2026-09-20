import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TrainerSearchBar from '@/pages/Search/TrainerSearchBar';

const fetchTrainerAutocompleteMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/userSearchService', () => ({
  fetchTrainerAutocomplete: (...args: unknown[]) =>
    fetchTrainerAutocompleteMock(...args),
}));

const LocationProbe = () => {
  const location = useLocation();
  const contextBackTo = (
    location.state as { contextBackTo?: string } | null
  )?.contextBackTo;
  return (
    <div data-testid="location-probe">
      {`${location.pathname}${location.search}|${contextBackTo ?? ''}`}
    </div>
  );
};

const renderSearch = (initialEntry = '/search?mode=trainer') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/search" element={<TrainerSearchBar />} />
        <Route path="/profile/:username" element={<LocationProbe />} />
        <Route path="/pokemon/:username" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe('TrainerSearchBar', () => {
  beforeEach(() => {
    fetchTrainerAutocompleteMock.mockReset();
  });

  it('renders responsive trainer identity, metadata, and explicit actions', async () => {
    fetchTrainerAutocompleteMock.mockResolvedValueOnce({
      type: 'success',
      results: [
        {
          username: 'Misty',
          pokemonGoName: 'CeruleanLeader',
          team: 'Mystic',
          trainer_level: 50,
        },
      ],
    });

    renderSearch();

    fireEvent.change(screen.getByLabelText('Trainer name'), {
      target: { value: 'mi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Nexus · @Misty')).toBeInTheDocument();
    expect(screen.getByText('Pokémon GO · CeruleanLeader')).toBeInTheDocument();
    expect(screen.getByText('Team Mystic')).toBeInTheDocument();
    expect(screen.getByText('Level 50')).toBeInTheDocument();
    expect(screen.getByText('1 trainer')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View Pokémon' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View profile' }),
    ).toBeInTheDocument();
    expect(fetchTrainerAutocompleteMock).toHaveBeenCalledWith('mi');
  });

  it('shows both identities when the Nexus and Pokemon GO names are identical', async () => {
    fetchTrainerAutocompleteMock.mockResolvedValueOnce({
      type: 'success',
      results: [{ username: 'sameName', pokemonGoName: 'sameName' }],
    });

    renderSearch();
    fireEvent.change(screen.getByLabelText('Trainer name'), {
      target: { value: 'same' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Nexus · @sameName')).toBeInTheDocument();
    expect(screen.getByText('Pokémon GO · sameName')).toBeInTheDocument();
  });

  it('returns from a trainer profile to the same trainer query', async () => {
    fetchTrainerAutocompleteMock.mockResolvedValueOnce({
      type: 'success',
      results: [{ username: 'Misty', pokemonGoName: 'MistyGO' }],
    });

    renderSearch();
    fireEvent.change(screen.getByLabelText('Trainer name'), {
      target: { value: 'misty' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View profile' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/profile/Misty|/search?mode=trainer&q=misty',
    );
  });

  it('opens a trainer catalog with a stable Caught filter and return path', async () => {
    fetchTrainerAutocompleteMock.mockResolvedValueOnce({
      type: 'success',
      results: [{ username: 'Brock' }],
    });

    renderSearch();
    fireEvent.change(screen.getByLabelText('Trainer name'), {
      target: { value: 'brock' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: 'View Pokémon' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/pokemon/Brock?filter=caught|/search?mode=trainer&q=brock',
    );
  });

  it('places API errors beside the form and supports retry', async () => {
    fetchTrainerAutocompleteMock
      .mockResolvedValueOnce({
        type: 'error',
        message: 'Trainer search is unavailable.',
      })
      .mockResolvedValueOnce({ type: 'success', results: [] });

    renderSearch();
    fireEvent.change(screen.getByLabelText('Trainer name'), {
      target: { value: 'ash' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trainer search is unavailable.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(screen.getByText('No trainers found')).toBeInTheDocument();
    });
    expect(fetchTrainerAutocompleteMock).toHaveBeenCalledTimes(2);
  });

  it('explains the minimum query and clears the current search', () => {
    renderSearch();
    const input = screen.getByLabelText('Trainer name');

    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByText('Enter one more character to search.')).toBeInTheDocument();
    expect(fetchTrainerAutocompleteMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Clear trainer search' }));
    expect(input).toHaveValue('');
    expect(screen.getByText('Find people you know')).toBeInTheDocument();
  });
});
