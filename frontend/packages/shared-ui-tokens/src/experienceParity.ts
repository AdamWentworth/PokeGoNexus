/**
 * User-visible behavior measured from the canonical Vite application.
 *
 * Both the browser and React Native suites consume these values. A product
 * behavior change must update this contract deliberately; native code must not
 * carry a second, independently guessed copy of the same expectation.
 */
export const homeExperienceParityContract = {
  collectionPath: '/pokemon',
  collectionSummaryPaths: {
    caught: '/pokemon?filter=caught',
    favorites: '/pokemon?filter=favorites',
    trade: '/pokemon?filter=trade',
    wanted: '/pokemon?filter=wanted',
  },
  recentPokemonPath: '/pokemon',
} as const;

export const collectionExperienceParityContract = {
  initialView: 'pokemon',
  cardLongPressMs: 300,
  sortMenuTransitionMs: 250,
  instanceOverlaySwipe: {
    axisLockDelta: 10,
    backgroundBaseScale: 1.06,
    backgroundOpacityTransitionMs: 220,
    backgroundScaleTransitionMs: 280,
    backgroundTransitionOpacity: 0.58,
    backgroundTransitionScale: 1.09,
    enterOffset: 110,
    entryTransitionMs: 220,
    exitOffset: 140,
    maxDragOffset: 180,
    navigationDelta: 56,
    swapDelayMs: 120,
    transitionEasing: [0.22, 1, 0.36, 1] as const,
  },
  locationBackdrop: {
    viewportWidthRatio: 0.86,
    maxWidth: 447,
    topOffset: -20,
    standardStageSize: 296,
    standardStageLift: 48,
    wantedStage: {
      narrowMaxWidth: 370,
      narrowSize: 168,
      phoneMaxWidth: 600,
      phoneSize: 185,
      wideSize: 238,
      phoneLift: 8,
      wideLift: 18,
    },
    instanceMask: {
      cx: '50%',
      cy: '56%',
      rx: '57%',
      ry: '94%',
      stops: [
        ['0%', 1],
        ['52%', 0.98],
        ['64%', 0.9],
        ['76%', 0.6],
        ['88%', 0],
        ['100%', 0],
      ] as const,
    },
    cardMask: {
      cx: '50%',
      cy: '50%',
      rx: '50%',
      ry: '50%',
      stops: [
        ['0%', 1],
        ['45%', 0.7],
        ['65%', 0.3],
        ['70%', 0],
        ['100%', 0],
      ] as const,
    },
    brightness: {
      centerOpacity: 0.1,
      fadeOffset: '70%',
    },
  },
  pageSwipeMaxPeekRatio: 0.3,
  pageSwipeThresholdPx: 100,
  pageTransitionEasing: [0.25, 0.46, 0.45, 0.94] as const,
  pageTransitionMs: 300,
  viewOrder: ['inventory', 'pokemon', 'wishlist'] as const,
  viewLabels: ['TAGS', 'POKÉMON', 'WISHLIST'] as const,
  clearTagConfirmation: {
    cancelLabel: 'Cancel',
    confirmLabel: 'OK',
    title: 'Confirm action',
  },
} as const;

export const buildClearActiveTagMessage = (displayName: string): string => (
  `Clear the ${displayName} tag? This returns you to browsing all available Pokémon and forms in Pokémon GO, without using your personal tag lists.`
);

export const actionMenuExperienceParityContract = {
  primaryDestinations: [
    { id: 'raid', icon: '/images/btn_raid.png', label: 'Raid', path: '/raid', position: [-1, -1] },
    { id: 'pokedex', icon: '/images/btn_pokedex.png', label: 'Pokedex', path: '/pokedex', position: [0, -1] },
    { id: 'pvp', icon: '/images/btn_pvp.png', label: 'PvP', path: '/pvp', position: [1, -1] },
    { id: 'search', icon: '/images/btn_search.png', label: 'Search', path: '/search', position: [-1, 0] },
    { id: 'home', icon: '/images/btn_home.png', label: 'Home', path: '/', position: [0, 0] },
    { id: 'trades', icon: '/images/btn_trades.png', label: 'Trades', path: '/trades', position: [1, 0] },
    { id: 'pokemon', icon: '/images/btn_pokemon.png', label: 'Pokémon', path: '/pokemon', position: [-1, 1] },
    { id: 'max', icon: '/images/btn_max.png', label: 'Max Battles', path: '/max', position: [0, 1] },
    { id: 'rankings', icon: '/images/btn_rankings.png', label: 'Rankings', path: '/rankings', position: [1, 1] },
  ],
  supportDestinations: [
    { label: 'Getting Started', path: '/getting-started' },
    { label: 'FAQ', path: '/faq' },
    { label: 'About', path: '/about' },
    { label: 'Trade Safety', path: '/safety' },
    { label: 'Help directory', path: '/help' },
  ],
  motion: {
    closeMs: 300,
    openMs: 300,
  },
} as const;

export const themeSwitchExperienceParityContract = {
  decorationTransitionMs: 400,
  moonRotationDelayMs: 500,
  moonRotationMs: 600,
  slideTransitionMs: 500,
  touchHeight: 44,
  trackHeight: 34,
  trackWidth: 60,
} as const;

export const loadingExperienceParityContract = {
  hideDelayMs: 150,
} as const;
