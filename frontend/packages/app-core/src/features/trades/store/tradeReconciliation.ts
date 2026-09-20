import type { TradeRecord } from '@shared-contracts/trades';

type TradeMap = Record<string, TradeRecord>;

const tradeVersion = (trade?: TradeRecord): number | null => {
  const raw = trade?.last_update;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;

  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const incomingTradeIsStale = (
  existing: TradeRecord | undefined,
  incoming: TradeRecord,
): boolean => {
  const existingVersion = tradeVersion(existing);
  const incomingVersion = tradeVersion(incoming);
  return existingVersion !== null
    && incomingVersion !== null
    && incomingVersion < existingVersion;
};

const incomingTradeIsNewer = (
  existing: TradeRecord,
  incoming: TradeRecord,
): boolean => {
  const existingVersion = tradeVersion(existing);
  const incomingVersion = tradeVersion(incoming);
  return existingVersion !== null
    && incomingVersion !== null
    && incomingVersion > existingVersion;
};

export const reconcileConcurrentSnapshot = <T>(
  snapshot: Record<string, T>,
  recordsAtRequestStart: Record<string, T>,
  currentRecords: Record<string, T>,
): Record<string, T> => {
  const reconciled = { ...snapshot };
  const candidateIds = new Set([
    ...Object.keys(recordsAtRequestStart),
    ...Object.keys(currentRecords),
  ]);

  for (const recordId of candidateIds) {
    const atRequestStart = recordsAtRequestStart[recordId];
    const current = currentRecords[recordId];
    if (current === atRequestStart) continue;

    if (current) reconciled[recordId] = current;
    else delete reconciled[recordId];
  }

  return reconciled;
};

/**
 * Reconciles a server snapshot that was requested before live events or
 * commands may have updated the store. Unchanged local rows follow the server
 * exactly, while concurrent local changes win unless the response is newer.
 */
export const reconcileTradeSnapshot = (
  serverTrades: TradeMap,
  tradesAtRequestStart: TradeMap,
  currentTrades: TradeMap,
): TradeMap => {
  const reconciled = { ...serverTrades };
  const candidateIds = new Set([
    ...Object.keys(tradesAtRequestStart),
    ...Object.keys(currentTrades),
  ]);

  for (const tradeId of candidateIds) {
    const atRequestStart = tradesAtRequestStart[tradeId];
    const current = currentTrades[tradeId];
    if (current === atRequestStart) continue;

    if (!current) {
      delete reconciled[tradeId];
      continue;
    }

    const serverTrade = serverTrades[tradeId];
    if (!serverTrade || !incomingTradeIsNewer(current, serverTrade)) {
      reconciled[tradeId] = current;
    }
  }

  return reconciled;
};
