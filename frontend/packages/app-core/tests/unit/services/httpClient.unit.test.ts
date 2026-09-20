import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OfflineError,
  requestWithPolicy,
} from '@/services/httpClient';
import { usePwaStatusStore } from '@/stores/usePwaStatusStore';

describe('requestWithPolicy connectivity guard', () => {
  beforeEach(() => {
    usePwaStatusStore.setState({ isOnline: true });
    vi.restoreAllMocks();
  });

  it('fails immediately with a useful message while offline', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    usePwaStatusStore.setState({ isOnline: false });

    await expect(requestWithPolicy('/api/example')).rejects.toEqual(
      expect.objectContaining({
        name: 'OfflineError',
        message: 'You are offline. Reconnect before using this feature.',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps the offline failure distinguishable from server errors', () => {
    expect(new OfflineError()).toBeInstanceOf(Error);
    expect(new OfflineError().name).toBe('OfflineError');
  });
});
