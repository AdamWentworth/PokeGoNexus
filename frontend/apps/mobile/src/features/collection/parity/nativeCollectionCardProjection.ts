import type { NativeCollectionRow } from '../collectionModel';
import type { CollectionParityCardFixture } from './collectionParityFixtures';

const toParityCard = (
  row: NativeCollectionRow,
  showOwnership: boolean,
): CollectionParityCardFixture => ({
  id: row.id,
  cp: row.cp,
  dexNumber: row.pokedexNumber,
  name: row.name,
  imagePath: row.imageUri ?? `/images/disabled/disabled_${row.pokemonId}.png`,
  interaction: row.source === 'catalog' ? 'select' : 'view',
  typeIconPaths: row.typeIconUris,
  favorite: row.favorite,
  mostWanted: row.mostWanted,
  lucky: row.lucky,
  locationBackgroundPath: row.locationBackgroundUri ?? undefined,
  maxKind: row.maxKind ?? undefined,
  ownership: showOwnership && row.source !== 'catalog' ? row.status : undefined,
  purified: row.purified,
});

const ownedCardCache = new WeakMap<
  NativeCollectionRow,
  CollectionParityCardFixture
>();
const catalogCardCache = new WeakMap<
  NativeCollectionRow,
  CollectionParityCardFixture
>();
const ownedCardListCache = new WeakMap<
  NativeCollectionRow[],
  CollectionParityCardFixture[]
>();
const catalogCardListCache = new WeakMap<
  NativeCollectionRow[],
  CollectionParityCardFixture[]
>();

export const projectNativeCollectionParityCard = (
  row: NativeCollectionRow,
  showOwnership: boolean,
): CollectionParityCardFixture => {
  const cache = showOwnership ? ownedCardCache : catalogCardCache;
  const cached = cache.get(row);
  if (cached) return cached;
  const card = toParityCard(row, showOwnership);
  cache.set(row, card);
  return card;
};

// Kept as a public behavior helper for parity tests and non-virtual consumers.
// The production FlatList intentionally projects one visible item at a time.
export const projectNativeCollectionParityCards = (
  rows: NativeCollectionRow[],
  showOwnership: boolean,
): CollectionParityCardFixture[] => {
  const listCache = showOwnership ? ownedCardListCache : catalogCardListCache;
  const cached = listCache.get(rows);
  if (cached) return cached;
  const cards = rows.map((row) => projectNativeCollectionParityCard(row, showOwnership));
  listCache.set(rows, cards);
  return cards;
};
