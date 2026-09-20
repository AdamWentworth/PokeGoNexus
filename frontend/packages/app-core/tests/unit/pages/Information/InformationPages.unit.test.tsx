import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import About from '@/pages/Information/About';
import NotFound from '@/pages/Information/NotFound';
import Safety from '@/pages/Information/Safety';

describe('public information pages', () => {
  it('explains the project and links to its core workflows', () => {
    render(<MemoryRouter><About /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'About Pokémon Go Nexus' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Trading starts with understanding/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Getting Started/i })).toHaveAttribute('href', '/getting-started');
    expect(screen.getByRole('link', { name: 'Read the FAQ' })).toHaveAttribute('href', '/faq');
  });

  it('documents safety boundaries and account controls', () => {
    render(<MemoryRouter><Safety /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Trade Safety & Community Guidelines' })).toBeInTheDocument();
    expect(screen.getByText(/Pokémon Go Nexus plans the exchange/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy settings/i })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Friends & blocked' })).toHaveAttribute('href', '/profile/friends');
  });

  it('renders the unknown path and offers recovery routes', () => {
    render(
      <MemoryRouter initialEntries={['/missing-page']}>
        <Routes><Route path="*" element={<NotFound />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'That route wandered off.' })).toBeInTheDocument();
    expect(screen.getByText('/missing-page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return home/i })).toHaveAttribute('href', '/');
    fireEvent.click(screen.getByRole('button', { name: /Go back/i }));
  });

  it('keeps each public page free of automated accessibility violations', async () => {
    const about = render(<MemoryRouter><About /></MemoryRouter>);
    await expect(about.container).toHaveNoViolations();
    about.unmount();

    const safety = render(<MemoryRouter><Safety /></MemoryRouter>);
    await expect(safety.container).toHaveNoViolations();
    safety.unmount();

    const notFound = render(
      <MemoryRouter initialEntries={['/missing-page']}>
        <Routes><Route path="*" element={<NotFound />} /></Routes>
      </MemoryRouter>,
    );
    await expect(notFound.container).toHaveNoViolations();
  });
});
