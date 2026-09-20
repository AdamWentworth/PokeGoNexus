import type { OverlayPokemon, OverlayType } from './overlayTypes';

const toCanonicalKey = (value: unknown): string =>
  (value ?? '').toString().trim().toLowerCase();

const overlayByTag: Record<string, OverlayType> = {
  caught: 'caught',
  favorites: 'caught',
  missing: 'missing',
  trade: 'trade',
  wanted: 'wanted',
  'most wanted': 'wanted',
};

export const deriveInitialOverlay = (
  tagFilter: unknown,
  pokemon: OverlayPokemon | null,
): OverlayType => {
  const fromTag = toCanonicalKey(tagFilter);
  if (overlayByTag[fromTag]) {
    return overlayByTag[fromTag];
  }

  const status = toCanonicalKey(pokemon?.instanceData?.status || pokemon?.status);
  if (['caught', 'missing', 'trade', 'wanted'].includes(status)) {
    return status as OverlayType;
  }

  if (pokemon?.instanceData?.is_wanted) return 'wanted';
  if (pokemon?.instanceData?.is_for_trade) return 'trade';
  if (pokemon?.instanceData?.is_caught) return 'caught';

  return 'caught';
};
