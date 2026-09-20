import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import HomeFooter from '@/pages/Home/HomeFooter';

describe('HomeFooter', () => {
  it('uses the branded lockup and routes visitors only to supported surfaces', () => {
    render(<MemoryRouter><HomeFooter /></MemoryRouter>);

    expect(screen.getByRole('img', { name: 'Pokémon Go Nexus' })).toHaveAttribute(
      'src',
      '/images/logo/lockup.png',
    );
    expect(screen.getByRole('heading', { name: /bring your collection/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quick start guide' })).toHaveAttribute('href', '/getting-started');
    expect(screen.getByRole('link', { name: 'Help & information' })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: 'Frequently asked questions' })).toHaveAttribute('href', '/faq');
    expect(screen.getByRole('link', { name: 'About Pokémon Go Nexus' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: 'Trade safety' })).toHaveAttribute('href', '/safety');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.queryByRole('link', { name: 'Contact Pokémon Go Nexus' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).not.toBeInTheDocument();
    expect(screen.getByText(/independent community project/i)).toBeInTheDocument();
  });
});
