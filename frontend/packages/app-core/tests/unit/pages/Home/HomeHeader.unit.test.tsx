import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import HomeHeader from '@/pages/Home/HomeHeader';

const renderHeader = (isLoggedIn: boolean) => render(
  <MemoryRouter>
    <HomeHeader
      logoUrl="/images/logo/logo.png"
      lockupUrl="/images/logo/hero-lockup.png"
      isLoggedIn={isLoggedIn}
    />
  </MemoryRouter>,
);

describe('HomeHeader', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders honest product content and account actions when logged out', () => {
    renderHeader(false);

    expect(screen.getByRole('heading', { name: /build your collection.*find the right trade/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Pokémon Go Nexus' })).toHaveAttribute('src', '/images/logo/hero-lockup.png');
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: /create your free account/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /explore the app/i })).toHaveAttribute('href', '#feature-directory');
    expect(screen.getByText('Reciprocal trade matching')).toBeInTheDocument();
    expect(screen.getByText('You each have what the other trainer wants')).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'Action menu tip' })).toHaveTextContent(
      /explore tools, switch themes, and find account options/i,
    );
  });

  it('hides guest calls to action when logged in', () => {
    renderHeader(true);

    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /explore the app/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('note', { name: 'Action menu tip' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
  });

  it('smoothly scrolls to the feature directory instead of using the browser hash jump', () => {
    const directory = document.createElement('section');
    directory.id = 'feature-directory';
    const scrollIntoView = vi.fn();
    directory.scrollIntoView = scrollIntoView;
    document.body.appendChild(directory);

    renderHeader(false);
    fireEvent.click(screen.getByRole('link', { name: /explore the app/i }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(window.location.hash).toBe('#feature-directory');
    directory.remove();
    window.history.replaceState(null, '', '/');
  });
});
