import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import BackgroundLocationCard from '@/components/pokemonComponents/BackgroundLocationCard';

describe('BackgroundLocationCard', () => {
  it('uses the background name when location is missing', () => {
    render(
      <BackgroundLocationCard
        pokemon={{
          variantType: 'default',
          backgrounds: [
            {
              background_id: 1,
              image_url: '/images/backgrounds/one.png',
              name: 'Go Fest Wormhole',
              costume_id: 0,
              date: '2024-07-13',
              location: '',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /go fest wormhole/i })).toBeInTheDocument();
    expect(screen.queryAllByText('Go Fest Wormhole').length).toBeGreaterThan(0);
  });

  it('sends the selected background and supports clearing selection', () => {
    const onSelectBackground = vi.fn();

    render(
      <BackgroundLocationCard
        pokemon={{
          variantType: 'default',
          backgrounds: [
            {
              background_id: 7,
              image_url: '/images/backgrounds/seattle.png',
              name: 'MLB Seattle Mariners',
              costume_id: 0,
              date: '2024-09-13',
              location: 'T-Mobile Park, Seattle, Washington, USA',
            },
          ],
        }}
        onSelectBackground={onSelectBackground}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /mlb seattle mariners/i }));
    expect(onSelectBackground).toHaveBeenLastCalledWith(
      expect.objectContaining({ background_id: 7 }),
    );

    fireEvent.click(screen.getByRole('button', { name: /none/i }));
    expect(onSelectBackground).toHaveBeenLastCalledWith(null);
  });

  it('shows only exact no-costume backgrounds for a standard variant', () => {
    render(
      <BackgroundLocationCard
        pokemon={{
          variantType: 'default',
          backgrounds: [
            {
              background_id: 1,
              image_url: '/images/backgrounds/base.png',
              name: 'Base Background',
              costume_id: null,
              date: '2025-01-01',
              location: 'Base Location',
            },
            {
              background_id: 2,
              image_url: '/images/backgrounds/party.png',
              name: 'Party Background',
              costume_id: 7,
              date: '2025-01-02',
              location: 'Party Location',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /base background/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /party background/i })).not.toBeInTheDocument();
  });

  it.each(['costume_7', 'shiny_costume_7', 'shadow_costume_7', 'shiny_shadow_costume_7'])(
    'shows only the exact costume background for %s',
    (variantType) => {
      render(
        <BackgroundLocationCard
          pokemon={{
            variantType,
            backgrounds: [
              {
                background_id: 1,
                image_url: '/images/backgrounds/base.png',
                name: 'Base Background',
                costume_id: null,
                date: '2025-01-01',
                location: 'Base Location',
              },
              {
                background_id: 2,
                image_url: '/images/backgrounds/party.png',
                name: 'Party Background',
                costume_id: 7,
                date: '2025-01-02',
                location: 'Party Location',
              },
            ],
          }}
        />,
      );

      expect(screen.getByRole('button', { name: /party background/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /base background/i })).not.toBeInTheDocument();
    },
  );

  it('uses an explicit costume and labels background pairings when requested', () => {
    render(
      <BackgroundLocationCard
        costumeOptions={[{ name: 'Party', costume_id: 7 }]}
        pokemon={{
          variantType: 'default',
          backgrounds: [
            {
              background_id: 2,
              image_url: '/images/backgrounds/party.png',
              name: 'Party Background',
              costume_id: 7,
              date: '2025-01-02',
              location: 'Party Location',
            },
          ],
        }}
        selectedCostumeId={7}
        showCostumePairing
      />,
    );

    expect(screen.getByText('Party')).toBeInTheDocument();
  });

  it('renders the same background id for distinct costume pairings without key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <BackgroundLocationCard
        costumeOptions={[
          { name: 'Party', costume_id: 7 },
          { name: 'Detective', costume_id: 8 },
        ]}
        filterBackground={() => true}
        pokemon={{
          variantType: 'default',
          backgrounds: [
            {
              background_id: 2,
              image_url: '/images/backgrounds/party.png',
              name: 'Shared Background',
              costume_id: 7,
              date: '2025-01-02',
              location: 'Party Location',
            },
            {
              background_id: 2,
              image_url: '/images/backgrounds/detective.png',
              name: 'Shared Background',
              costume_id: 8,
              date: '2025-01-03',
              location: 'Detective Location',
            },
          ],
        }}
        showCostumePairing
      />,
    );

    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('Detective')).toBeInTheDocument();
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('same key'),
      ),
    ).toBe(false);
  });
});
