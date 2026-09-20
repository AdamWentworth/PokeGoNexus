import { describe, expect, it } from 'vitest';

import type { TradeRecord } from '@shared-contracts/trades';
import {
  incomingTradeIsStale,
  reconcileConcurrentSnapshot,
  reconcileTradeSnapshot,
} from './tradeReconciliation';

const trade = (
  status: string,
  lastUpdate: number | string,
): TradeRecord => ({
  trade_id: 'trade-1',
  trade_status: status,
  last_update: lastUpdate,
});

describe('trade reconciliation', () => {
  it('recognizes stale numeric and ISO timestamp updates', () => {
    expect(incomingTradeIsStale(trade('pending', 200), trade('proposed', 100))).toBe(true);
    expect(
      incomingTradeIsStale(
        trade('pending', '2026-08-22T08:00:00.000Z'),
        trade('proposed', '2026-08-22T07:59:59.000Z'),
      ),
    ).toBe(true);
    expect(incomingTradeIsStale(trade('proposed', 100), trade('pending', 200))).toBe(false);
  });

  it('keeps a newer live update over an older in-flight snapshot', () => {
    const proposed = trade('proposed', 100);
    const pending = trade('pending', 200);

    expect(
      reconcileTradeSnapshot(
        { 'trade-1': proposed },
        { 'trade-1': proposed },
        { 'trade-1': pending },
      ),
    ).toEqual({ 'trade-1': pending });
  });

  it('keeps a concurrent command when versions cannot be compared', () => {
    const proposed = trade('proposed', '');
    const pending = trade('pending', '');

    expect(
      reconcileTradeSnapshot(
        { 'trade-1': proposed },
        { 'trade-1': proposed },
        { 'trade-1': pending },
      ),
    ).toEqual({ 'trade-1': pending });
  });

  it('uses the server snapshot for rows unchanged while the request was in flight', () => {
    const proposed = trade('proposed', 100);
    const pending = trade('pending', 200);

    expect(
      reconcileTradeSnapshot(
        { 'trade-1': pending },
        { 'trade-1': proposed },
        { 'trade-1': proposed },
      ),
    ).toEqual({ 'trade-1': pending });
  });

  it('preserves concurrent additions and removals', () => {
    const proposed = trade('proposed', 100);
    const added = { ...trade('pending', 300), trade_id: 'trade-2' };

    expect(
      reconcileTradeSnapshot(
        { 'trade-1': proposed },
        { 'trade-1': proposed },
        { 'trade-2': added },
      ),
    ).toEqual({ 'trade-2': added });
  });

  it('preserves concurrent related-record changes around a snapshot', () => {
    const original = { value: 'old' };
    const current = { value: 'current' };

    expect(
      reconcileConcurrentSnapshot(
        { original: { value: 'server' } },
        { original },
        { original: current, added: { value: 'new' } },
      ),
    ).toEqual({ original: current, added: { value: 'new' } });
  });
});
