// InstanceOverlay.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './InstanceOverlay.css';
import OverlayPortal from '@/components/OverlayPortal';
import WindowOverlay from '@/components/WindowOverlay';
import CaughtInstance from './CaughtInstance';
import TradeInstance from './TradeInstance';
import WantedInstance from './WantedInstance';
import CloseButton from '@/components/CloseButton';
import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { SortMode, SortType } from '@/types/sort';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import { createScopedLogger } from '@/utils/logger';
import { useViewportBelow, VIEWPORT_BREAKPOINTS } from '@/hooks/useViewport';
import { getBackgroundImageSrc, getCaughtBgColor } from './overlay/overlayBackground';
import { getOverlayIdentityKey, withInstanceData } from './overlay/overlayPokemon';
import { deriveInitialOverlay } from './overlay/overlayState';
import type { OverlayPokemon, OverlayType } from './overlay/overlayTypes';
import { useOverlaySwipeNavigation } from './overlay/useOverlaySwipeNavigation';
import TradePreferenceHandoff from '@/features/trades/preferences/TradePreferenceHandoff';
import CatalogTradeLauncherPanel from '@/features/trades/proposal/CatalogTradeLauncherPanel';
import CatalogWantedLauncherPanel from '@/features/trades/proposal/CatalogWantedLauncherPanel';
import TradeTargetsPanel from './components/Trade/TradeTargetsPanel';
import WantedDetails from './components/Wanted/WantedDetails';

const log = createScopedLogger('InstanceOverlay');
const dbg = (...args: unknown[]) => log.debug(...args);

interface InstanceOverlayProps {
  pokemon: OverlayPokemon;
  onClose: () => void;
  variants: PokemonVariant[];
  tagFilter: string;
  lists: Record<string, Record<string, unknown>>;
  instances: Instances;
  sortType: SortType;
  sortMode: SortMode;
  isEditable: boolean;
  username: string;
  navigationPokemons?: OverlayPokemon[];
  onNavigatePokemon?: (pokemon: OverlayPokemon) => void;
}

type CaughtOverlayPokemon = React.ComponentProps<typeof CaughtInstance>['pokemon'];
type TradeOverlayPokemon = React.ComponentProps<typeof TradeInstance>['pokemon'];
type CatalogTradePokemon = React.ComponentProps<typeof CatalogTradeLauncherPanel>['partnerPokemon'];
type CatalogWantedPokemon = React.ComponentProps<typeof CatalogWantedLauncherPanel>['wantedPokemon'];
type WantedOverlayPokemon = React.ComponentProps<typeof WantedInstance>['pokemon'];
type TradeTargetsPanelPokemon = React.ComponentProps<typeof TradeTargetsPanel>['pokemon'];
type WantedDetailsPokemon = React.ComponentProps<typeof WantedDetails>['pokemon'];

export { isSwipeInteractiveTarget } from './overlay/overlaySwipe';

const InstanceOverlay: React.FC<InstanceOverlayProps> = ({
  pokemon,
  onClose,
  variants,
  tagFilter,
  lists,
  instances,
  sortType,
  sortMode,
  isEditable,
  username,
  navigationPokemons = [],
  onNavigatePokemon,
}) => {
  const [selectedPokemon, setSelectedPokemon] = useState<OverlayPokemon | null>(pokemon);
  const [previewInstanceDataPatch, setPreviewInstanceDataPatch] = useState<
    Partial<PokemonInstance>
  >({});
  const liveSelectedPokemon = useMemo<OverlayPokemon | null>(() => {
    if (!selectedPokemon) return null;

    const instanceId = selectedPokemon.instanceData?.instance_id;
    const liveInstance = instanceId ? instances[instanceId] : null;
    const mergedInstanceData: Partial<PokemonInstance> = {
      ...(selectedPokemon.instanceData ?? {}),
      ...(liveInstance ?? {}),
      ...previewInstanceDataPatch,
    };

    return {
      ...selectedPokemon,
      instanceData: mergedInstanceData,
    };
  }, [instances, previewInstanceDataPatch, selectedPokemon]);

  const isSmallScreen = useViewportBelow(
    VIEWPORT_BREAKPOINTS.overlayStacked,
  );

  const [currentOverlay, setCurrentOverlay] = useState<OverlayType>(() =>
    deriveInitialOverlay(tagFilter, pokemon)
  );
  const isNavigableOverlay = currentOverlay === 'caught' || currentOverlay === 'trade';

  const navigablePokemons = useMemo(
    () =>
      navigationPokemons.filter(
        (entry): entry is OverlayPokemon =>
          Boolean(
            entry &&
              entry.instanceData &&
              typeof entry.instanceData.instance_id === 'string' &&
              entry.instanceData.instance_id.length > 0,
          ),
      ),
    [navigationPokemons],
  );

  const currentNavigationKey = useMemo(
    () => getOverlayIdentityKey(liveSelectedPokemon ?? selectedPokemon ?? pokemon),
    [liveSelectedPokemon, pokemon, selectedPokemon],
  );

  const navigationIndex = useMemo(() => {
    if (!currentNavigationKey) return -1;
    return navigablePokemons.findIndex(
      (entry) => getOverlayIdentityKey(entry) === currentNavigationKey,
    );
  }, [currentNavigationKey, navigablePokemons]);

  const previousPokemon =
    navigationIndex > 0 ? navigablePokemons[navigationIndex - 1] : null;
  const nextPokemon =
    navigationIndex >= 0 && navigationIndex < navigablePokemons.length - 1
      ? navigablePokemons[navigationIndex + 1]
      : null;

  const navigateToPokemon = useCallback(
    (target: OverlayPokemon | null) => {
      if (!target) return;
      setSelectedPokemon(target);
      setPreviewInstanceDataPatch({});
      onNavigatePokemon?.(target);
    },
    [onNavigatePokemon],
  );

  const {
    canNavigateNext,
    canNavigatePrevious,
    cancelSwipeAndResetOffset,
    handleNavigateNext,
    handleNavigatePrevious,
    hasNextPokemon,
    hasPreviousPokemon,
    ignorePointerEvents,
    isBackgroundTransitioning,
    isHorizontalSwiping,
    isSwiping,
    overlayMotionStyle,
    overlayRootRef,
    resetMotionForIncomingPokemon,
    swipeCaptureHandlers,
  } = useOverlaySwipeNavigation({
    isNavigableOverlay,
    nextPokemon,
    navigateToPokemon,
    previousPokemon,
  });

  const incomingNavigationKey = useMemo(
    () => getOverlayIdentityKey(pokemon),
    [pokemon],
  );
  const lastIncomingNavigationKeyRef = useRef<string | null>(incomingNavigationKey);

  useEffect(() => {
    if (incomingNavigationKey === lastIncomingNavigationKeyRef.current) return;
    lastIncomingNavigationKeyRef.current = incomingNavigationKey;

    setSelectedPokemon(pokemon);
    setPreviewInstanceDataPatch({});
    resetMotionForIncomingPokemon();
  }, [incomingNavigationKey, pokemon, resetMotionForIncomingPokemon]);

  const handleInstancePreviewDataChange = useCallback(
    (patch: Partial<PokemonInstance>) => {
      setPreviewInstanceDataPatch((prev) => {
        const next = { ...prev, ...patch };
        const hasChange = Object.keys(next).some((key) => {
          const typedKey = key as keyof PokemonInstance;
          return !Object.is(next[typedKey], prev[typedKey]);
        });
        return hasChange ? next : prev;
      });
    },
    [],
  );

  const showNavigationArrows = isNavigableOverlay && navigablePokemons.length > 1;

  const activeInstanceIdHint = useMemo(() => {
    const liveId = liveSelectedPokemon?.instanceData?.instance_id;
    if (typeof liveId === 'string' && liveId.length > 0) return liveId;
    const selectedId = selectedPokemon?.instanceData?.instance_id;
    if (typeof selectedId === 'string' && selectedId.length > 0) return selectedId;
    return null;
  }, [liveSelectedPokemon?.instanceData?.instance_id, selectedPokemon?.instanceData?.instance_id]);

  useEffect(() => {
    setCurrentOverlay(deriveInitialOverlay(tagFilter, liveSelectedPokemon));
  }, [tagFilter, liveSelectedPokemon]);

  const handleOpenTradeTargetOverlay = (pokemonData: Record<string, unknown>) => {
    setSelectedPokemon(pokemonData as unknown as OverlayPokemon);
    setPreviewInstanceDataPatch({});
    setCurrentOverlay('wanted');
  };

  const handleOpenTradeOverlay = (pokemonData: Record<string, unknown>) => {
    setSelectedPokemon(pokemonData as unknown as OverlayPokemon);
    setPreviewInstanceDataPatch({});
    setCurrentOverlay('trade');
  };

  const handleCloseOverlay = () => {
    onClose();
    setCurrentOverlay(deriveInitialOverlay(tagFilter, null));
    setSelectedPokemon(null);
    setPreviewInstanceDataPatch({});
  };

  const renderCloseButton = () => (
    <div className="close-button-container">
      <CloseButton onClick={onClose} />
    </div>
  );

  const renderContent = () => {
    const activePokemon = liveSelectedPokemon;
    switch (currentOverlay) {
      case 'caught': {
        if (!activePokemon) return null;
        const caughtInstanceKey =
          getOverlayIdentityKey(activePokemon) ??
          `caught:${activePokemon.pokemon_id}:${String(activePokemon.variant_id ?? '')}`;
        return (
          <div className="caught-fullscreen">
            <div className="caught-scroll">
              <div className="instance-motion-shell instance-motion-shell--caught" style={overlayMotionStyle}>
                <div className="caught-column">
                  <CaughtInstance
                    key={caughtInstanceKey}
                    pokemon={activePokemon as CaughtOverlayPokemon}
                    isEditable={isEditable}
                    onPreviewInstanceDataChange={handleInstancePreviewDataChange}
                    activeInstanceIdHint={activeInstanceIdHint}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }
      case 'missing':
        return <div className="missing-placeholder">Missing Instance Component</div>;
      case 'trade': {
        if (!activePokemon) return null;
        const tradeInstanceKey =
          getOverlayIdentityKey(activePokemon) ??
          `trade:${activePokemon.pokemon_id}:${String(activePokemon.variant_id ?? '')}`;
        return (
          <div className="instance-motion-shell instance-motion-shell--trade" style={overlayMotionStyle}>
            <div
              className={`trade-instance-overlay ${isSmallScreen ? 'small-screen' : ''}`}
            >
              <div className={`overlay-row other-overlays-row ${isSmallScreen ? 'column-layout' : ''}`}>
                <WindowOverlay
                  onClose={handleCloseOverlay}
                  className="trade-instance-window trade-details-window trade-unified-window"
                  {...swipeCaptureHandlers}
                >
                  <div className="trade-pane-scroll trade-pane-scroll--offer">
                    <div
                      className={`trade-pane-shell trade-pane-shell--offer${
                        !isEditable ? ' trade-pane-shell--catalog-view' : ''
                      }`}
                    >
                      <TradeInstance
                        key={tradeInstanceKey}
                        pokemon={activePokemon as unknown as TradeOverlayPokemon}
                        isEditable={isEditable}
                        catalogView={!isEditable}
                        compactListingView={isEditable}
                      />
                      {isEditable && activePokemon.instanceData?.instance_id ? (
                        <>
                          <TradeTargetsPanel
                            key={`${tradeInstanceKey}:preference-summary`}
                            pokemon={withInstanceData(activePokemon) as TradeTargetsPanelPokemon}
                            lists={lists}
                            instances={instances}
                            sortType={sortType}
                            sortMode={sortMode}
                            openTradeTargetOverlay={handleOpenTradeTargetOverlay}
                            variants={variants}
                            isEditable={false}
                            summaryMode
                          />
                          <TradePreferenceHandoff
                            mode="trade"
                            instanceId={activePokemon.instanceData.instance_id}
                            compact
                          />
                        </>
                      ) : null}
                      {!isEditable ? (
                        <CatalogTradeLauncherPanel
                          key={`${tradeInstanceKey}:proposal`}
                          partnerUsername={username}
                          partnerPokemon={
                            withInstanceData(activePokemon) as CatalogTradePokemon
                          }
                          partnerLists={lists}
                          partnerInstances={instances}
                        />
                      ) : null}
                    </div>
                  </div>
                </WindowOverlay>
              </div>
            </div>
          </div>
        );
      }
      case 'wanted': {
        if (!activePokemon) return null;
        const wantedInstanceKey =
          getOverlayIdentityKey(activePokemon) ??
          `wanted:${activePokemon.pokemon_id}:${String(activePokemon.variant_id ?? '')}`;
        return (
          <div className="instance-motion-shell instance-motion-shell--wanted" style={overlayMotionStyle}>
            <div className="wanted-instance-overlay">
              <div className={`overlay-row other-overlays-row ${isSmallScreen ? 'column-layout' : ''}`}>
                <WindowOverlay
                  onClose={handleCloseOverlay}
                  className="trade-instance-window wanted-instance-window wanted-details-window trade-unified-window"
                >
                  <div className="trade-pane-scroll trade-pane-scroll--offer">
                    <div
                      className={`trade-pane-shell trade-pane-shell--offer trade-pane-shell--wanted${
                        !isEditable ? ' trade-pane-shell--catalog-view' : ''
                      }`}
                    >
                      <WantedInstance
                        key={wantedInstanceKey}
                        pokemon={activePokemon as unknown as WantedOverlayPokemon}
                        isEditable={isEditable}
                        catalogView={!isEditable}
                        compactListingView={isEditable}
                        onPreviewInstanceDataChange={handleInstancePreviewDataChange}
                      />
                      {isEditable && activePokemon.instanceData?.instance_id ? (
                        <>
                          <WantedDetails
                            key={`${wantedInstanceKey}:preference-summary`}
                            pokemon={withInstanceData(activePokemon) as WantedDetailsPokemon}
                            lists={lists}
                            instances={instances}
                            sortType={sortType}
                            sortMode={sortMode}
                            openTradeOverlay={handleOpenTradeOverlay}
                            variants={variants}
                            isEditable={false}
                            summaryMode
                          />
                          <TradePreferenceHandoff
                            mode="wanted"
                            instanceId={activePokemon.instanceData.instance_id}
                            compact
                          />
                        </>
                      ) : null}
                      {!isEditable ? (
                        <CatalogWantedLauncherPanel
                          key={`${wantedInstanceKey}:proposal`}
                          partnerUsername={username}
                          wantedPokemon={withInstanceData(activePokemon) as CatalogWantedPokemon}
                          partnerLists={lists}
                          partnerInstances={instances}
                        />
                      ) : null}
                    </div>
                  </div>
                </WindowOverlay>
              </div>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const showTypeBackground =
    currentOverlay === 'caught' || currentOverlay === 'trade' || currentOverlay === 'wanted';
  const bgColor = showTypeBackground ? getCaughtBgColor(liveSelectedPokemon) : null;

  // recompute the background image whenever the selected pokemon changes
  const bgImageSrc = useMemo(
    () => (showTypeBackground ? getBackgroundImageSrc(liveSelectedPokemon) : null),
    [liveSelectedPokemon, showTypeBackground]
  );

  const caughtBackgroundStyle = useMemo(
    () => ({
      '--io-bg': bgColor,
      '--io-bg-base-scale': collectionExperienceParityContract.instanceOverlaySwipe.backgroundBaseScale,
      '--io-bg-opacity-transition-ms': `${collectionExperienceParityContract.instanceOverlaySwipe.backgroundOpacityTransitionMs}ms`,
      '--io-bg-scale-transition-ms': `${collectionExperienceParityContract.instanceOverlaySwipe.backgroundScaleTransitionMs}ms`,
      '--io-bg-transition-opacity': collectionExperienceParityContract.instanceOverlaySwipe.backgroundTransitionOpacity,
      '--io-bg-transition-scale': collectionExperienceParityContract.instanceOverlaySwipe.backgroundTransitionScale,
    } as React.CSSProperties),
    [bgColor],
  );

  // SINGLE debug log for this file
  useEffect(() => {
    if (currentOverlay === 'caught') {
      dbg('Background image:', bgImageSrc, 'for', liveSelectedPokemon?.name ?? '(unknown)');
    }
  }, [currentOverlay, bgImageSrc, liveSelectedPokemon?.name]);

  return (
    <OverlayPortal onClose={onClose}>
      <div
        ref={overlayRootRef}
        className={`instance-overlay ${currentOverlay === 'caught' ? 'caught-mode' : ''} ${currentOverlay === 'trade' ? 'trade-mode' : ''} ${currentOverlay === 'wanted' ? 'wanted-mode' : ''} ${isSwiping ? 'is-swiping' : ''} ${isHorizontalSwiping ? 'is-horizontal-swiping' : ''}`}
        style={{ pointerEvents: ignorePointerEvents ? 'none' : 'auto' }}
        {...swipeCaptureHandlers}
        onMouseLeave={cancelSwipeAndResetOffset}
        onTouchCancel={cancelSwipeAndResetOffset}
        onPointerCancel={cancelSwipeAndResetOffset}
      >
        {showTypeBackground && (
          <div className="io-bg" style={caughtBackgroundStyle}>
            <img
              className={`io-bg-img ${isBackgroundTransitioning ? 'is-transitioning' : ''}`}
              src={bgImageSrc ?? '/images/backgrounds/bg_normal.png'}
              alt=""
              aria-hidden="true"
              decoding="async"
              loading="eager"
            />
          </div>
        )}

        {showNavigationArrows && hasPreviousPokemon ? (
          <button
            type="button"
            className="instance-nav-arrow instance-nav-arrow--left"
            onClick={handleNavigatePrevious}
            disabled={!canNavigatePrevious}
            aria-label="Previous Pokemon"
            title="Previous Pokemon"
          >
            {'\u25C0'}
          </button>
        ) : null}
        {renderContent()}
        {showNavigationArrows && hasNextPokemon ? (
          <button
            type="button"
            className="instance-nav-arrow instance-nav-arrow--right"
            onClick={handleNavigateNext}
            disabled={!canNavigateNext}
            aria-label="Next Pokemon"
            title="Next Pokemon"
          >
            {'\u25B6'}
          </button>
        ) : null}
        {renderCloseButton()}
      </div>
    </OverlayPortal>
  );
};

export default InstanceOverlay;
