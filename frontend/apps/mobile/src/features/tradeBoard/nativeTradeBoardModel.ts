import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeCollectionRow } from '../collection/collectionModel';

export type NativeTradeBoardTheme = 'brand-dark' | 'brand-light' | 'minimal';

export type NativeTradeBoardEntry = {
  id: string;
  imageUri: string | null;
  locationBackgroundUri: string | null;
  luckyRequested: boolean;
  maxKind: NativeCollectionRow['maxKind'];
  mostWanted: boolean;
  name: string;
  pokedexNumber: number;
  quantity: number;
};

export type NativeTradeBoardModel = {
  boardUrl: string;
  generatedAt: string;
  includeTrade: boolean;
  includeWanted: boolean;
  pokemonGoName: string | null;
  tradeCount: number;
  tradeEntries: NativeTradeBoardEntry[];
  username: string;
  wantedCount: number;
  wantedEntries: NativeTradeBoardEntry[];
};

const groupRows = ({
  instances,
  rows,
  section,
}: {
  instances: Record<string, PokemonInstance>;
  rows: NativeCollectionRow[];
  section: 'trade' | 'wanted';
}): NativeTradeBoardEntry[] => {
  const instanceByKey = new Map<string, PokemonInstance>();
  for (const [storageKey, instance] of Object.entries(instances)) {
    instanceByKey.set(storageKey, instance);
    if (instance.instance_id) instanceByKey.set(instance.instance_id, instance);
  }
  const grouped = new Map<string, NativeTradeBoardEntry>();
  for (const row of rows) {
    if (row.source === 'catalog' || row.status !== section) continue;
    const instance = instanceByKey.get(row.id);
    const luckyRequested = section === 'wanted' && instance?.pref_lucky === true;
    const groupKey = JSON.stringify([
      row.pokemonId,
      row.name,
      row.imageUri,
      row.locationBackgroundUri,
      row.maxKind,
      row.mostWanted,
      luckyRequested,
    ]);
    const current = grouped.get(groupKey);
    if (current) {
      current.quantity += 1;
      continue;
    }
    grouped.set(groupKey, {
      id: `${section}:${row.id}`,
      imageUri: row.imageUri,
      locationBackgroundUri: row.locationBackgroundUri,
      luckyRequested,
      maxKind: row.maxKind,
      mostWanted: section === 'wanted' && row.mostWanted,
      name: row.name,
      pokedexNumber: row.pokedexNumber,
      quantity: 1,
    });
  }
  return [...grouped.values()].sort((left, right) => (
    Number(right.mostWanted) - Number(left.mostWanted)
      || left.pokedexNumber - right.pokedexNumber
      || left.name.localeCompare(right.name)
  ));
};

export const buildNativeTradeBoardModel = ({
  boardUrl,
  generatedAt = new Date().toISOString(),
  includeTrade = true,
  includeWanted = true,
  instances,
  pokemonGoName,
  rows,
  username,
}: {
  boardUrl: string;
  generatedAt?: string;
  includeTrade?: boolean;
  includeWanted?: boolean;
  instances: Record<string, PokemonInstance>;
  pokemonGoName?: string | null;
  rows: NativeCollectionRow[];
  username: string;
}): NativeTradeBoardModel => {
  const tradeRows = rows.filter((row) => row.status === 'trade');
  const wantedRows = rows.filter((row) => row.status === 'wanted');
  const normalizedUsername = username.trim();
  const normalizedPokemonGoName = pokemonGoName?.trim() || null;
  return {
    boardUrl,
    generatedAt,
    includeTrade,
    includeWanted,
    pokemonGoName: normalizedPokemonGoName
      && normalizedPokemonGoName.toLocaleLowerCase() !== normalizedUsername.toLocaleLowerCase()
      ? normalizedPokemonGoName
      : null,
    tradeCount: includeTrade ? tradeRows.length : 0,
    tradeEntries: includeTrade ? groupRows({ instances, rows: tradeRows, section: 'trade' }) : [],
    username: normalizedUsername,
    wantedCount: includeWanted ? wantedRows.length : 0,
    wantedEntries: includeWanted ? groupRows({ instances, rows: wantedRows, section: 'wanted' }) : [],
  };
};

export const nativeTradeBoardFilename = (username: string, generatedAt: string): string => {
  const safeUsername = username.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '')
    || 'trainer';
  const date = generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `pokegonexus-${safeUsername}-trade-board-${date}.png`;
};
