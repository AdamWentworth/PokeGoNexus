import { ApiClientError } from '@pokemongonexus/shared-api-client';
import {
  createNativeQueryClient,
  shouldRetryNativeQuery,
} from '../../../src/query/nativeQueryClient';

describe('native query client', () => {
  it('retries one transient failure but never retries client errors', () => {
    expect(shouldRetryNativeQuery(0, new Error('offline'))).toBe(true);
    expect(shouldRetryNativeQuery(1, new Error('offline'))).toBe(false);
    expect(shouldRetryNativeQuery(
      0,
      new ApiClientError(401, 'Unauthorized', null),
    )).toBe(false);
    expect(shouldRetryNativeQuery(
      0,
      new ApiClientError(503, 'Unavailable', null),
    )).toBe(true);
  });

  it('does not retry mutations that may already have reached the server', () => {
    const client = createNativeQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
