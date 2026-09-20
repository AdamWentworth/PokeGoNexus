import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import Help from '@/pages/Help/Help';

describe('Help page', () => {
  it('provides one public directory for guides, methodologies, and account policies', () => {
    render(<MemoryRouter><Help /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Help & information' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Frequently asked questions/i })).toHaveAttribute('href', '/faq');
    expect(screen.getByRole('link', { name: /Getting started/i })).toHaveAttribute('href', '/getting-started');
    expect(screen.getByRole('link', { name: /About Pokémon Go Nexus/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Trade safety & community guidelines/i })).toHaveAttribute('href', '/safety');
    expect(screen.getByRole('link', { name: /Raid methodology/i })).toHaveAttribute('href', '/raid/methodology');
    expect(screen.getByRole('link', { name: /PvP methodology/i })).toHaveAttribute('href', '/pvp/methodology');
    expect(screen.getByRole('link', { name: /Privacy policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /Terms of service/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /Data deletion/i })).toHaveAttribute('href', '/data-deletion');
  });

  it('has no automated accessibility violations', async () => {
    const { container } = render(<MemoryRouter><Help /></MemoryRouter>);

    await expect(container).toHaveNoViolations();
  });
});
