// swipeNavigation.ts

import type { ActiveView } from './pokemonPageHelpers';

type Direction = 'left' | 'right';

export function getNextActiveView(currentView: ActiveView, direction: Direction): ActiveView {
  if (direction === 'left') {
    if (currentView === 'inventory') return 'pokemon';
    if (currentView === 'pokemon') return 'wishlist';
  } else if (direction === 'right') {
    if (currentView === 'wishlist') return 'pokemon';
    if (currentView === 'pokemon') return 'inventory';
  }
  // If no change, return the current view.
  return currentView;
}
