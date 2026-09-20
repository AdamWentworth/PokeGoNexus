import React, { forwardRef } from 'react';

import PokemonArtwork from '@/components/pokemonComponents/PokemonArtwork';
import type {
  TradeBoardEntry,
  TradeBoardModel,
  TradeBoardTheme,
} from '../model/tradeBoardModel';
import { formatTradeBoardDate } from '../model/tradeBoardModel';
import './TradeBoard.css';

export interface TradeBoardProps {
  model: TradeBoardModel;
  qrCodeDataUrl?: string | null;
  theme: TradeBoardTheme;
}

const displayUrl = (url: string): string => url
  .replace(/^https?:\/\//i, '')
  .replace(/\/$/, '');

const TradeBoardPokemon = ({ entry }: { entry: TradeBoardEntry }) => (
  <article className="trade-board-pokemon" data-most-wanted={entry.mostWanted || undefined}>
    <div className="trade-board-pokemon__artwork-shell">
      {entry.locationBackgroundUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="trade-board-pokemon__location-background"
          src={entry.locationBackgroundUrl}
        />
      ) : null}
      {entry.luckyRequested ? (
        <img
          alt=""
          aria-hidden="true"
          className="trade-board-pokemon__lucky-background"
          src="/images/lucky.png"
        />
      ) : null}
      <PokemonArtwork
        alt={entry.name}
        className="trade-board-pokemon__artwork"
        decoding="sync"
        dynamax={entry.dynamax}
        gigantamax={entry.gigantamax}
        imageUrl={entry.imageUrl}
        loading="eager"
      />
      {entry.mostWanted ? (
        <span aria-label="Most Wanted" className="trade-board-pokemon__most-wanted">★</span>
      ) : null}
      {entry.quantity > 1 ? (
        <span className="trade-board-pokemon__quantity">×{entry.quantity}</span>
      ) : null}
    </div>
    <strong>{entry.name}</strong>
    <span className="trade-board-pokemon__number">
      #{String(entry.pokedexNumber).padStart(4, '0')}
    </span>
  </article>
);

const TradeBoardSection = ({
  count,
  description,
  entries,
  kind,
  title,
}: {
  count: number;
  description: string;
  entries: TradeBoardEntry[];
  kind: 'trade' | 'wanted';
  title: string;
}) => (
  <section className={`trade-board__section trade-board__section--${kind}`}>
    <header className="trade-board__section-header">
      <div>
        <span>{kind === 'trade' ? 'Available Pokémon' : 'Wanted Pokémon'}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <strong>{count}</strong>
    </header>
    {entries.length > 0 ? (
      <div className="trade-board__grid">
        {entries.map((entry) => <TradeBoardPokemon entry={entry} key={entry.key} />)}
      </div>
    ) : (
      <div className="trade-board__empty">No Pokémon listed in this section.</div>
    )}
  </section>
);

const TradeBoard = forwardRef<HTMLDivElement, TradeBoardProps>(({
  model,
  qrCodeDataUrl,
  theme,
}, ref) => (
  <div className="trade-board" data-theme={theme} ref={ref}>
    <header className="trade-board__hero">
      <div className="trade-board__brand-lockup">
        <img alt="Pokémon Go Nexus" src="/icons/icon-192x192.png" />
        <div>
          <span>POKÉMON GO NEXUS</span>
          <strong>Community Trade Board</strong>
        </div>
      </div>
      <div className="trade-board__identity">
        <span>Trainer</span>
        <h1>@{model.username}</h1>
        {model.pokemonGoName ? <p>Pokémon GO: {model.pokemonGoName}</p> : null}
      </div>
      <div className="trade-board__summary">
        {model.includeTrade ? (
          <span className="trade-board__summary-trade"><strong>{model.tradeCount}</strong> For Trade</span>
        ) : null}
        {model.includeWanted ? (
          <span className="trade-board__summary-wanted"><strong>{model.wantedCount}</strong> Looking For</span>
        ) : null}
      </div>
    </header>

    <main className="trade-board__content">
      {model.includeTrade ? (
        <TradeBoardSection
          count={model.tradeCount}
          description="Pokémon this trainer currently has available to exchange."
          entries={model.tradeEntries}
          kind="trade"
          title="For Trade"
        />
      ) : null}
      {model.includeWanted ? (
        <TradeBoardSection
          count={model.wantedCount}
          description={model.mostWantedCount > 0
            ? `Looking for these Pokémon · ${model.mostWantedCount} marked Most Wanted.`
            : 'Pokémon this trainer is currently looking for.'}
          entries={model.wantedEntries}
          kind="wanted"
          title="Looking For"
        />
      ) : null}
    </main>

    <footer className="trade-board__footer">
      <div className="trade-board__footer-copy">
        <strong>See live listings and exact trade preferences</strong>
        <span>{displayUrl(model.boardUrl)}</span>
        <small>Generated {formatTradeBoardDate(model.generatedAt)} · Unofficial community tool</small>
      </div>
      {qrCodeDataUrl ? (
        <div className="trade-board__qr">
          <img alt="QR code for this trainer's live trade board" src={qrCodeDataUrl} />
          <strong>Scan for the live board</strong>
        </div>
      ) : null}
    </footer>
  </div>
));

TradeBoard.displayName = 'TradeBoard';

export default TradeBoard;
