// tests/unit/features/variants/hooks/useBootstrapVariants.unit.test.ts

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { Mock } from 'vitest';
import { useBootstrapVariants } from '@/features/variants/hooks/useBootstrapVariants';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { testLogger, enableLogging } from '../../../../setupTests';

describe('🪝 useBootstrapVariants', () => {
  let mockHydrate: Mock<() => Promise<void>>;
  let mockRefresh: Mock<() => Promise<void>>;
  let mockEnsureMoves: Mock<() => Promise<void>>;
  let mockEnsureRaidData: Mock<() => Promise<void>>;

  beforeAll(() => {
    enableLogging('verbose');
    testLogger.fileStart('useBootstrapVariants.unit.test.ts');
    testLogger.suiteStart('useBootstrapVariants');
  });

  afterAll(() => {
    testLogger.suiteComplete();
    testLogger.fileEnd();
    testLogger.fileSeparator();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockHydrate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockRefresh = vi.fn<() => Promise<void>>();
    mockEnsureMoves = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockEnsureRaidData = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    vi.spyOn(useVariantsStore, 'getState').mockReturnValue({
      hydrateFromCache: mockHydrate,
      refreshVariants: mockRefresh,
      variants: [],
      variantsLoading: false,
      isRefreshing: false,
      isMovesLoading: false,
      isRaidDataLoading: false,
      raidDataRequested: false,
      ensureMoves: mockEnsureMoves,
      ensureRaidData: mockEnsureRaidData,
    });

    testLogger.testStep('Mocks initialized');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testLogger.testStep('Mocks restored');
  });

  it('calls hydrateFromCache once on mount', () => {
    testLogger.testStep('Render hook to trigger hydrateFromCache');
    renderHook(() => useBootstrapVariants());
    testLogger.assertion('hydrateFromCache should be called once');
    expect(mockHydrate).toHaveBeenCalledTimes(1);
  });

  it('logs error if hydrateFromCache throws', async () => {
    const error = new Error('hydrate failed');
    mockHydrate.mockRejectedValueOnce(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    testLogger.testStep('Render hook with failing hydrateFromCache');
    renderHook(() => useBootstrapVariants());
    await Promise.resolve();

    testLogger.assertion('Error should be logged to console.error');
    expect(consoleSpy).toHaveBeenCalledWith('[useBootstrapVariants]', 'Hydrate error:', error);
    consoleSpy.mockRestore();
  });

  it('does not hydrate when disabled', () => {
    renderHook(() => useBootstrapVariants(false));
    expect(mockHydrate).not.toHaveBeenCalled();
  });
});
