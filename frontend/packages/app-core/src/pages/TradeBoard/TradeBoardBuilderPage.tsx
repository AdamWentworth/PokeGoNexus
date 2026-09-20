import { useMemo } from 'react';
import {
  FaArrowLeft,
  FaArrowRight,
  FaExternalLinkAlt,
  FaShareAlt,
} from 'react-icons/fa';
import { Link, Navigate, useLocation } from 'react-router';

import LoadingSpinner from '@/components/LoadingSpinner';
import AppPageShell from '@/components/layout/AppPageShell';
import PageState from '@/components/layout/PageState';
import ProductPageHeader from '@/components/layout/ProductPageHeader';
import TradeBoardComposer from '@/features/tradeBoard/components/TradeBoardComposer';
import { tradeBoardPath } from '@/features/tradeBoard/model/tradeBoardUrl';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { initializePokemonTags } from '@/features/tags/utils/initializePokemonTags';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useAuth } from '@/contexts/AuthContext';
import type { TagBuckets } from '@/types/tags';

import './TradeBoardBuilderPage.css';

const TradeBoardBuilderPage = () => {
  const location = useLocation();
  const { isLoading: authLoading, isLoggedIn, user } = useAuth();
  const instances = useInstancesStore((state) => state.instances);
  const instancesLoading = useInstancesStore((state) => state.instancesLoading);
  const variants = useVariantsStore((state) => state.variants);
  const variantsLoading = useVariantsStore((state) => state.variantsLoading);

  const tags = useMemo(
    () => initializePokemonTags(instances, variants),
    [instances, variants],
  );
  const boardTags = useMemo<Pick<TagBuckets, 'trade' | 'wanted'>>(() => ({
    trade: Object.fromEntries(
      Object.entries(tags.caught).filter(([, item]) => item.is_for_trade),
    ),
    wanted: tags.wanted,
  }), [tags]);
  const tradeCount = Object.keys(boardTags.trade).length;
  const wantedCount = Object.keys(boardTags.wanted).length;
  const hasListings = tradeCount > 0 || wantedCount > 0;
  const loading = authLoading || variantsLoading || instancesLoading;

  if (loading) {
    return (
      <AppPageShell className="trade-board-builder-page" maxWidth="standard">
        <ProductPageHeader
          className="trade-board-builder-page__header"
          description="Create a polished, shareable view of your For Trade and Wanted listings."
          eyebrow="Shareable collection"
          icon={<FaShareAlt aria-hidden="true" />}
          title="Trade Board"
        />
        <PageState
          className="trade-board-builder-page__state"
          description="Gathering your current For Trade and Wanted listings…"
          icon={<LoadingSpinner />}
          live="polite"
          title="Preparing your Trade Board"
        />
      </AppPageShell>
    );
  }

  if (!isLoggedIn || !user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return (
    <AppPageShell className="trade-board-builder-page" maxWidth="standard">
      <ProductPageHeader
        actions={(
          <>
            <Link className="product-page-header__action" to="/trades">
              <FaArrowLeft aria-hidden="true" /> Trades
            </Link>
            {hasListings ? (
              <Link
                className="product-page-header__action trade-board-builder-page__live-link"
                to={tradeBoardPath(user.username)}
              >
                View live board <FaExternalLinkAlt aria-hidden="true" />
              </Link>
            ) : null}
          </>
        )}
        className="trade-board-builder-page__header"
        description="Create a polished, shareable view of your For Trade and Wanted listings."
        eyebrow="Shareable collection"
        icon={<FaShareAlt aria-hidden="true" />}
        title="Trade Board"
      />

      {hasListings ? (
        <TradeBoardComposer activeTags={boardTags} presentation="page" variants={variants} />
      ) : (
        <PageState
          action={(
            <div className="trade-board-builder-page__empty-actions">
              <Link className="trade-board-builder-page__primary" to="/pokemon">
                Add Pokémon listings <FaArrowRight aria-hidden="true" />
              </Link>
              <Link to="/trades?section=preferences">Review trade preferences</Link>
            </div>
          )}
          className="trade-board-builder-page__empty"
          description="Mark at least one Pokémon as For Trade or Wanted. Your board will then stay synchronized with those listings automatically."
          icon={<FaShareAlt aria-hidden="true" />}
          title="Your Trade Board needs a listing"
        />
      )}
    </AppPageShell>
  );
};

export default TradeBoardBuilderPage;
