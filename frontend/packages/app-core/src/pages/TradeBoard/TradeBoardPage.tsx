import React, { useEffect, useMemo, useState } from 'react';
import { FaArrowRight, FaLink, FaShieldAlt } from 'react-icons/fa';
import { Link, useParams } from 'react-router';

import LoadingSpinner from '@/components/LoadingSpinner';
import { feedback } from '@/components/feedback';
import TradeBoardViewport from '@/features/tradeBoard/components/TradeBoardViewport';
import { useTradeBoardQrCode } from '@/features/tradeBoard/hooks/useTradeBoardQrCode';
import { buildTradeBoardModel } from '@/features/tradeBoard/model/tradeBoardModel';
import { tradeBoardPublicUrl } from '@/features/tradeBoard/model/tradeBoardUrl';
import { initializePokemonTags } from '@/features/tags/utils/initializePokemonTags';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { fetchTrainerProfile } from '@/services/socialService';
import { fetchForeignInstancesByUsername } from '@/services/userSearchService';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Instances } from '@/types/instances';
import { buildPokemonCatalogPath } from '@/pages/Pokemon/utils/pokemonCatalogNavigation';
import './TradeBoardPage.css';

type PageStatus = 'loading' | 'ready' | 'not-found' | 'private' | 'error';

const TradeBoardPage: React.FC = () => {
  const { username: routeUsername = '' } = useParams();
  const username = routeUsername.trim();
  const variants = useVariantsStore((state) => state.variants);
  const variantsLoading = useVariantsStore((state) => state.variantsLoading);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [instances, setInstances] = useState<Instances | null>(null);
  const [resolvedUsername, setResolvedUsername] = useState(username);
  const [pokemonGoName, setPokemonGoName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setInstances(null);
    setResolvedUsername(username);
    setPokemonGoName(null);

    if (!username) {
      setStatus('not-found');
      return () => { active = false; };
    }

    void Promise.allSettled([
      fetchForeignInstancesByUsername(username),
      fetchTrainerProfile(username),
    ]).then(([instancesResult, profileResult]) => {
      if (!active) return;
      if (profileResult.status === 'fulfilled') {
        setPokemonGoName(profileResult.value.user.pokemonGoName?.trim() || null);
        setResolvedUsername(profileResult.value.user.username || username);
      }

      if (instancesResult.status === 'rejected') {
        setStatus('error');
        return;
      }

      const outcome = instancesResult.value;
      if (outcome.type === 'notFound') {
        setStatus('not-found');
      } else if (outcome.type === 'forbidden') {
        setStatus('private');
      } else if (outcome.type === 'success') {
        setInstances(outcome.instances);
        setResolvedUsername(outcome.username || username);
        setStatus('ready');
      } else if (outcome.type === 'error') {
        setStatus(outcome.status === 403 ? 'private' : 'error');
      } else {
        // A 304 is only expected when this request supplies a cache validator.
        // Treat an unexpected one as retryable instead of leaving the page loading.
        setStatus('error');
      }
    });

    return () => { active = false; };
  }, [username]);

  const tags = useMemo(() => {
    if (!instances || variants.length === 0) return null;
    return initializePokemonTags(instances, variants);
  }, [instances, variants]);
  const tradeItems = useMemo(
    () => Object.values(tags?.caught ?? {}).filter((item) => item.is_for_trade),
    [tags],
  );
  const wantedItems = useMemo(() => Object.values(tags?.wanted ?? {}), [tags]);
  const boardUrl = tradeBoardPublicUrl(resolvedUsername || username);
  const qrCodeDataUrl = useTradeBoardQrCode(boardUrl);
  const model = useMemo(() => buildTradeBoardModel({
    boardUrl,
    pokemonGoName,
    tradeItems,
    username: resolvedUsername || username,
    variants,
    wantedItems,
  }), [boardUrl, pokemonGoName, resolvedUsername, tradeItems, username, variants, wantedItems]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(boardUrl);
      feedback.success('Live Trade Board link copied.');
    } catch {
      feedback.error('Your browser could not copy this link.');
    }
  };

  const isLoading = status === 'loading' || (status === 'ready' && variantsLoading);

  return (
    <div className="trade-board-page">
      <header className="trade-board-page__header">
        <Link aria-label="Pokémon Go Nexus home" className="trade-board-page__brand" to="/">
          <img alt="" aria-hidden="true" src="/icons/icon-192x192.png" />
          <span>Pokémon Go Nexus</span>
        </Link>
        <div className="trade-board-page__header-actions">
          <Link to="/help">Help</Link>
          {isLoggedIn ? <Link to="/search">Find trainers</Link> : <Link to="/register">Create your board</Link>}
        </div>
      </header>

      <main className="trade-board-page__main">
        {isLoading ? (
          <section className="trade-board-page__state" aria-live="polite">
            <LoadingSpinner />
            <h1>Loading @{resolvedUsername || username}’s Trade Board</h1>
            <p>Checking their current public listings…</p>
          </section>
        ) : status === 'not-found' ? (
          <section className="trade-board-page__state">
            <h1>Trade Board not found</h1>
            <p>That trainer may have changed their username or left Pokémon Go Nexus.</p>
            <Link to="/search">Search for a trainer</Link>
          </section>
        ) : status === 'private' ? (
          <section className="trade-board-page__state">
            <FaShieldAlt aria-hidden="true" />
            <h1>This Trade Board is private</h1>
            <p>The trainer’s collection privacy applies to this live board.</p>
            <Link to={`/profile/${encodeURIComponent(username)}`}>View public profile</Link>
          </section>
        ) : status === 'error' || !tags ? (
          <section className="trade-board-page__state">
            <h1>We couldn’t load this Trade Board</h1>
            <p>Please check your connection and try again.</p>
            <button onClick={() => window.location.reload()} type="button">Try again</button>
          </section>
        ) : (
          <>
            <section className="trade-board-page__intro">
              <div>
                <span>Live community listing</span>
                <h1>@{model.username}’s Trade Board</h1>
                <p>These listings reflect the trainer’s current public Pokémon Go Nexus collection.</p>
              </div>
              <button onClick={() => void handleCopy()} type="button"><FaLink aria-hidden="true" /> Copy link</button>
            </section>

            <TradeBoardViewport model={model} qrCodeDataUrl={qrCodeDataUrl} theme="brand-dark" />

            <nav aria-label="Explore this trainer" className="trade-board-page__catalog-links">
              <Link to={buildPokemonCatalogPath({ username: model.username, filter: 'Trade' })}>
                <span><strong>{model.tradeCount}</strong> For Trade</span><FaArrowRight aria-hidden="true" />
              </Link>
              <Link to={buildPokemonCatalogPath({ username: model.username, filter: 'Wanted' })}>
                <span><strong>{model.wantedCount}</strong> Looking For</span><FaArrowRight aria-hidden="true" />
              </Link>
            </nav>

            {!isLoggedIn ? (
              <section className="trade-board-page__cta">
                <div><span>Build your own collection</span><h2>Trade smarter with Pokémon Go Nexus</h2><p>Catalog what you have, match what you want, and share one live Trade Board.</p></div>
                <Link to="/register">Join Pokémon Go Nexus <FaArrowRight aria-hidden="true" /></Link>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
};

export default TradeBoardPage;
