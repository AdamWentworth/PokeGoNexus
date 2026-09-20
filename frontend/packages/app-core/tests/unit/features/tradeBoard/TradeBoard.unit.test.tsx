import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import TradeBoard from '@/features/tradeBoard/components/TradeBoard';
import type { TradeBoardModel } from '@/features/tradeBoard/model/tradeBoardModel';

const model: TradeBoardModel = {
  boardUrl: 'https://pokegonexus.com/trade-board/AdamZilla',
  generatedAt: '2026-08-20T10:00:00.000Z',
  includeTrade: true,
  includeWanted: true,
  mostWantedCount: 1,
  pokemonGoName: 'AdamZillaGO',
  tradeCount: 2,
  tradeEntries: [{
    dynamax: false,
    gigantamax: false,
    imageUrl: '/images/bulbasaur.png',
    key: 'trade-1',
    locationBackgroundUrl: null,
    luckyRequested: false,
    mostWanted: false,
    name: 'Bulbasaur',
    pokedexNumber: 1,
    pokemonId: 1,
    quantity: 2,
  }],
  username: 'AdamZilla',
  wantedCount: 1,
  wantedEntries: [{
    dynamax: false,
    gigantamax: true,
    imageUrl: '/images/charizard.png',
    key: 'wanted-1',
    locationBackgroundUrl: '/images/background.png',
    luckyRequested: true,
    mostWanted: true,
    name: 'Gigantamax Charizard',
    pokedexNumber: 6,
    pokemonId: 6,
    quantity: 1,
  }],
};

describe('TradeBoard', () => {
  it('renders an intelligible branded offer-first board with a live QR destination', () => {
    const { container } = render(
      <TradeBoard
        model={model}
        qrCodeDataUrl="data:image/png;base64,qr"
        theme="brand-dark"
      />,
    );

    expect(screen.getByRole('heading', { name: '@AdamZilla' })).toBeInTheDocument();
    expect(screen.getByText('Pokémon GO: AdamZillaGO')).toBeInTheDocument();
    const sections = screen.getAllByRole('heading', { level: 2 });
    expect(sections.map((heading) => heading.textContent)).toEqual(['For Trade', 'Looking For']);
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(screen.getByLabelText('Most Wanted')).toBeInTheDocument();
    expect(screen.getByAltText("QR code for this trainer's live trade board")).toBeInTheDocument();
    expect(container.querySelector('.trade-board')).toHaveAttribute('data-theme', 'brand-dark');
  });

  it('keeps counts attached to the correct section', () => {
    render(<TradeBoard model={model} theme="minimal" />);
    const tradeSection = screen.getByRole('heading', { name: 'For Trade' }).closest('section');
    const wantedSection = screen.getByRole('heading', { name: 'Looking For' }).closest('section');

    expect(within(tradeSection as HTMLElement).getByText('2')).toBeInTheDocument();
    expect(within(wantedSection as HTMLElement).getByText('1')).toBeInTheDocument();
  });
});
