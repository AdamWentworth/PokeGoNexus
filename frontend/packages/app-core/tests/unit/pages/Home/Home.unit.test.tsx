import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import Home from '@/pages/Home/Home';

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mocks.useAuthMock(),
}));

vi.mock('@/pages/Home/HomeDashboard', () => ({
  default: ({ user }: { user: { username: string } }) => (
    <div data-testid="home-dashboard">Dashboard for {user.username}</div>
  ),
}));

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

describe('Home page', () => {
  it('renders the product landing page for signed-out visitors', () => {
    mocks.useAuthMock.mockReturnValue({ isLoggedIn: false, isLoading: false, user: null });

    renderHome();

    expect(screen.getByRole('heading', { name: /Build your collection.*Find the right trade/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /The trade is the destination/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Explore Pokémon Go Nexus/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /create account/i }).length).toBeGreaterThan(0);
  });

  it('renders the trainer dashboard when authenticated', () => {
    mocks.useAuthMock.mockReturnValue({
      isLoggedIn: true,
      isLoading: false,
      user: { username: 'AdamZilla' },
    });

    renderHome();

    expect(screen.getByTestId('home-dashboard')).toHaveTextContent('AdamZilla');
    expect(screen.queryByRole('heading', { name: /from catalog/i })).not.toBeInTheDocument();
  });

  it('shows a stable auth loading state before choosing a home experience', () => {
    mocks.useAuthMock.mockReturnValue({ isLoggedIn: false, isLoading: true, user: null });

    renderHome();

    expect(screen.getByRole('status')).toHaveTextContent('Opening Pokémon Go Nexus');
  });

  it('has no automated accessibility violations on the signed-out landing page', async () => {
    mocks.useAuthMock.mockReturnValue({ isLoggedIn: false, isLoading: false, user: null });

    const { container } = renderHome();

    await expect(container).toHaveNoViolations();
  });
});
