import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GettingStarted from '@/pages/Home/GettingStarted';

const mocks = vi.hoisted(() => ({ isLoggedIn: false }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: mocks.isLoggedIn }),
}));

describe('GettingStarted', () => {
  beforeEach(() => {
    mocks.isLoggedIn = false;
  });

  it('explains the complete workflow with working contextual links', async () => {
    const { container } = render(
      <MemoryRouter>
        <GettingStarted />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Your first useful trade, step by step.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start your collection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Propose and coordinate' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open trade preferences/i })).toHaveAttribute(
      'href',
      '/trades?section=preferences',
    );
    expect(screen.getByRole('link', { name: /create a trade board/i })).toHaveAttribute(
      'href',
      '/trade-board',
    );
    expect(screen.getByText(/offer a Shiny Gigantamax Charizard/i)).toBeInTheDocument();
    expect(container.querySelectorAll('img[src="/images/shiny_gigantamax/shiny_gigantamax_6.png"]')).toHaveLength(6);
    expect(container.querySelectorAll('img[src="/images/gigantamax.png"]')).toHaveLength(6);
    expect(container.querySelectorAll('img[src="/images/costumes_shiny/pokemon_25_detective_shiny.png"]')).toHaveLength(5);
    expect(container.querySelector('img[src="/images/default/pokemon_1.png"]')).not.toBeInTheDocument();
    await expect(container).toHaveNoViolations();
  });

  it('sends signed-in trainers to their collection instead of asking them to register', () => {
    mocks.isLoggedIn = true;

    render(
      <MemoryRouter>
        <GettingStarted />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Open collection' })).toHaveAttribute('href', '/pokemon');
    expect(screen.getAllByRole('link', { name: /Open Pokémon/i })).toHaveLength(2);
    screen.getAllByRole('link', { name: /Open Pokémon/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/pokemon');
    });
    expect(screen.queryByRole('link', { name: /Create account/i })).not.toBeInTheDocument();
  });
});
