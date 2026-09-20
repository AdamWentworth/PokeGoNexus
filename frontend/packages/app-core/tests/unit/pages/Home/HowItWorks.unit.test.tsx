import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import HowItWorks from '@/pages/Home/HowItWorks';

describe('HowItWorks', () => {
  it('centers trading while providing direct routes to the rest of the product', () => {
    const { container } = render(<MemoryRouter><HowItWorks /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: /the trade is the destination/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Catalog what you have' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find a real match' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Propose with confidence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Explore Pokémon Go Nexus' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /complete illustrated guide/i })).toHaveAttribute('href', '/getting-started');
    expect(screen.getByRole('link', { name: /Pokémon collection/i })).toHaveAttribute('href', '/pokemon');
    expect(screen.getByRole('link', { name: /Search & discovery/i })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: /^Trades/i })).toHaveAttribute('href', '/trades');
    const friendsLink = screen.getByRole('link', { name: /Friends/i });
    const tradeBoardLink = screen.getByRole('link', { name: /Trade Board/i });
    const communityBand = container.querySelector('.howItWorks__community-band');
    const coreGrid = container.querySelector('.howItWorks__core-grid');
    const toolsGrid = container.querySelector('.howItWorks__tools-grid');

    expect(friendsLink).toHaveAttribute('href', '/friends');
    expect(friendsLink).toHaveClass('is-friends');
    expect(tradeBoardLink).toHaveAttribute('href', '/trade-board');
    expect(tradeBoardLink).toHaveClass('is-board');
    expect(communityBand).toContainElement(friendsLink);
    expect(communityBand).toContainElement(tradeBoardLink);
    expect(coreGrid).not.toContainElement(friendsLink);
    expect(toolsGrid).not.toContainElement(tradeBoardLink);
    expect(container.querySelectorAll('img[src="/images/shiny_gigantamax/shiny_gigantamax_6.png"]')).toHaveLength(3);
    expect(container.querySelectorAll('img[src="/images/gigantamax.png"]')).toHaveLength(3);
    expect(container.querySelectorAll('img[src="/images/costumes_shiny/pokemon_25_detective_shiny.png"]')).toHaveLength(2);
    expect(container.querySelector('img[src="/images/default/pokemon_1.png"]')).not.toBeInTheDocument();
  });
});
