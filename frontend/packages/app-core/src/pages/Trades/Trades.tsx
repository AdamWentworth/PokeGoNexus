import { useCallback, useMemo, useState } from 'react';
import { FaExchangeAlt, FaShareAlt, FaSlidersH } from 'react-icons/fa';
import { Link, useSearchParams } from 'react-router';

import HorizontalPageSlider from '@/components/motion/HorizontalPageSlider';
import useHorizontalPageNavigation from '@/components/motion/useHorizontalPageNavigation';
import AppPageShell from '@/components/layout/AppPageShell';
import ProductPageHeader from '@/components/layout/ProductPageHeader';
import SegmentedControl from '@/components/layout/SegmentedControl';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useTradeStore } from '@/features/trades/store/useTradeStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import TradeList from '@/pages/Trades/TradeList';
import TradeStatusButtons from '@/pages/Trades/TradeStatusButtons';
import TradeTargetsWorkspace from '@/pages/Trades/TradeTargetsWorkspace';
import type { TradeStatusFilter } from '@/pages/Trades/types';
import { getStoredUsername } from '@/utils/storage';
import { countTradeActivity } from '@pokemongonexus/shared-domain/trade-activity';

import './TradeStatusButtons.css';
import './TradeActivity.css';

const TRADE_SECTIONS = ['preferences', 'activity'] as const;
const TRADE_SECTION_ITEMS = [
  {
    ariaControls: 'trade-section-preferences',
    icon: <FaSlidersH />,
    id: 'trade-tab-preferences',
    label: 'Trade Preferences',
    value: 'preferences',
  },
  {
    ariaControls: 'trade-section-activity',
    icon: <FaExchangeAlt />,
    id: 'trade-tab-activity',
    label: 'Trade Activity',
    value: 'activity',
  },
] as const;

function Trades() {
  const [searchParams, setSearchParams] = useSearchParams();
  const trades = useTradeStore((state) => state.trades);
  const relatedInstances = useTradeStore((state) => state.relatedInstances);

  const variants = useVariantsStore((state) => state.variants);
  const variantsLoading = useVariantsStore((state) => state.variantsLoading);

  const instances = useInstancesStore((state) => state.instances);
  const setInstances = useInstancesStore((state) => state.applyAuthoritativeInstanceChanges);
  const periodicUpdates = useInstancesStore((state) => state.periodicUpdates);

  const activeSection =
    searchParams.get('section') === 'activity' ? 'activity' : 'preferences';
  const [selectedStatus, setSelectedStatus] = useState<TradeStatusFilter>('Accepting');
  const loading = variantsLoading;
  const currentUsername = getStoredUsername() ?? '';
  const setActiveSection = useCallback((section: 'activity' | 'preferences') => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('section', section);
        if (section === 'activity') {
          next.delete('mode');
          next.delete('instance');
        }
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);
  const sectionSlider = useHorizontalPageNavigation({
    pages: TRADE_SECTIONS,
    activePage: activeSection,
    onChange: setActiveSection,
  });
  const activityCounts = useMemo(
    () => countTradeActivity(Object.values(trades ?? {}), currentUsername),
    [currentUsername, trades],
  );

  return (
    <AppPageShell
      className="trades-container"
      contentClassName="trades-page-shell"
      inset="compact"
      maxWidth="workspace"
    >
      <ProductPageHeader
        actions={(
          <Link className="trade-page-share-board" to="/trade-board">
            <FaShareAlt aria-hidden="true" /> Share board
          </Link>
        )}
        className="trade-product-header"
        description="Set your preferences, respond to offers, and follow every exchange."
        eyebrow="Trainer exchange"
        icon={<img alt="" src="/images/btn_trades.png" />}
        title="Trades"
      >
        <SegmentedControl
          ariaLabel="Trade sections"
          className="trade-page-section-switcher"
          items={TRADE_SECTION_ITEMS}
          mode="tabs"
          onChange={setActiveSection}
          value={activeSection}
        />
      </ProductPageHeader>

      <HorizontalPageSlider
        activeIndex={sectionSlider.activeIndex}
        className="trade-page-slider"
        viewportRef={sectionSlider.viewportRef}
        dragOffset={sectionSlider.dragOffset}
        isDragging={sectionSlider.isDragging}
        {...sectionSlider.swipeHandlers}
      >
        <section
          aria-labelledby="trade-tab-preferences"
          className="trade-preferences-workspace"
          id="trade-section-preferences"
          role="tabpanel"
        >
          <TradeTargetsWorkspace />
        </section>
        <section
          aria-labelledby="trade-tab-activity"
          className="trade-activity-workspace"
          id="trade-section-activity"
          role="tabpanel"
        >
          <header className="trade-activity-heading">
            <div>
              <h1 id="trade-activity-heading">Your trades</h1>
              <p>Respond to offers, track active trades, and revisit past exchanges.</p>
            </div>
          </header>
          <TradeStatusButtons
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            counts={activityCounts}
          />
          <TradeList
            trades={trades}
            relatedInstances={relatedInstances}
            selectedStatus={selectedStatus}
            setInstances={setInstances}
            variants={variants}
            instances={instances}
            loading={loading}
            periodicUpdates={periodicUpdates}
          />
        </section>
      </HorizontalPageSlider>
    </AppPageShell>
  );
}

export default Trades;
