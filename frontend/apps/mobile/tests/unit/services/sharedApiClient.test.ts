import {
  createApiClient,
  type AccessTokenProvider,
} from '@pokemongonexus/shared-api-client';

const response = (status: number, payload: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(
      payload === null ? '' : JSON.stringify(payload),
    ),
  }) as unknown as Response;

describe('shared API client', () => {
  it('preserves HTTP-only cookie authentication for the web adapter', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, { ok: true }));
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'cookie' },
      fetch: fetchMock,
    });

    await expect(client.get('/profile')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pokegonexus.com/api/users/profile',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('adds a bearer token without browser cookie credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, { ok: true }));
    const tokens: AccessTokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue('access-one'),
      refreshAccessToken: jest.fn(),
    };
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'bearer', tokens },
      fetch: fetchMock,
    });

    await client.get('/profile');
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.credentials).toBe('omit');
    expect(new Headers(request.headers).get('Authorization')).toBe(
      'Bearer access-one',
    );
  });

  it.each([
    { status: 401, payload: { message: 'Expired' } },
    { status: 403, payload: { error: 'Authentication failed' } },
  ])('refreshes once and retries a $status authentication failure', async ({ status, payload }) => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(response(status, payload))
      .mockResolvedValueOnce(response(200, { username: 'AdamZilla' }));
    const tokens: AccessTokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue('expired-token'),
      refreshAccessToken: jest.fn().mockResolvedValue('fresh-token'),
    };
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'bearer', tokens },
      fetch: fetchMock,
    });

    await expect(client.get('/profile')).resolves.toEqual({
      username: 'AdamZilla',
    });
    expect(tokens.refreshAccessToken).toHaveBeenCalledTimes(1);
    const retry = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(retry.headers).get('Authorization')).toBe(
      'Bearer fresh-token',
    );
  });

  it.each([
    { error: 'This collection is private' },
    { message: 'Forbidden' },
    null,
  ])('does not refresh or clear the session for a permission denial: %j', async (payload) => {
    const fetchMock = jest.fn().mockResolvedValue(response(403, payload));
    const tokens: AccessTokenProvider = {
      getAccessToken: () => 'valid-token',
      refreshAccessToken: jest.fn(),
      clearSession: jest.fn(),
    };
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'bearer', tokens },
      fetch: fetchMock,
    });
    await expect(client.get('/collection/private')).rejects.toMatchObject({ status: 403, payload });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokens.refreshAccessToken).not.toHaveBeenCalled();
    expect(tokens.clearSession).not.toHaveBeenCalled();
  });

  it('stops after one retry when the server still rejects authentication', async () => {
    const payload = { error: 'Authentication failed' };
    const fetchMock = jest.fn().mockResolvedValue(response(403, payload));
    const tokens: AccessTokenProvider = {
      getAccessToken: () => 'expired-token',
      refreshAccessToken: jest.fn().mockResolvedValue('fresh-token'),
    };
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'bearer', tokens },
      fetch: fetchMock,
    });
    await expect(client.get('/preferences')).rejects.toMatchObject({ status: 403, payload });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokens.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('leaves credential retention to the session provider when refresh cannot complete', async () => {
    const tokens: AccessTokenProvider = {
      getAccessToken: () => 'expired-token',
      refreshAccessToken: jest.fn().mockResolvedValue(null),
      clearSession: jest.fn(),
    };
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'bearer', tokens },
      fetch: jest.fn().mockResolvedValue(response(401, { error: 'Expired' })),
    });
    await expect(client.get('/preferences')).rejects.toMatchObject({ status: 401 });
    expect(tokens.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(tokens.clearSession).not.toHaveBeenCalled();
  });

  it('surfaces a typed failure with the server message', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(400, { message: 'Invalid request' }));
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'none' },
      fetch: fetchMock,
    });

    await expect(client.post('/trades', {})).rejects.toEqual(
      expect.objectContaining({
        name: 'ApiClientError',
        status: 400,
        message: 'Invalid request',
        payload: { message: 'Invalid request' },
      }),
    );
  });
});
