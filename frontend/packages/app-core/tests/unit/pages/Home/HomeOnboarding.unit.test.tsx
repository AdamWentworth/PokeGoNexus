import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import HomeOnboarding from '@/pages/Home/HomeOnboarding';

describe('HomeOnboarding', () => {
  it('shows real progress, next actions, and a dashboard escape hatch', () => {
    const onDismiss = vi.fn();
    render(
      <MemoryRouter>
        <HomeOnboarding
          user={{
            user_id: 'new-user',
            username: 'NewTrainer',
            email: 'new@example.test',
            pokemonGoName: 'NewTrainerGO',
            trainerCode: '',
            location: '',
            allowLocation: false,
            accessTokenExpiry: '2099-01-01T00:00:00Z',
            refreshTokenExpiry: '2099-01-02T00:00:00Z',
          }}
          progress={{
            completed: 1,
            total: 4,
            tasks: [
              {
                id: 'collection',
                title: 'Add your first Pokémon',
                description: 'Started.',
                action: 'Open Pokémon',
                to: '/pokemon',
                complete: true,
              },
              {
                id: 'wanted',
                title: 'Create a Wanted listing',
                description: 'Next step.',
                action: 'Open wishlist',
                to: '/pokemon?filter=wanted',
                complete: false,
              },
            ],
          }}
          onDismiss={onDismiss}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('1 of 4 setup milestones complete')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open wishlist/i })).toHaveAttribute('href', '/pokemon?filter=wanted');
    fireEvent.click(screen.getByRole('button', { name: 'Open trainer dashboard' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
