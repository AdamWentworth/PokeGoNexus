import { buildUrl, type UrlQueryValue } from '@pokemongonexus/shared-contracts/common';

export type AccessTokenProvider = {
  getAccessToken: () => Promise<string | null> | string | null;
  // The host decides whether a failed refresh invalidates its persisted session.
  // A temporary network outage may return null while retaining retry credentials.
  refreshAccessToken: () => Promise<string | null>;
  clearSession?: () => Promise<void> | void;
};

export type ApiAuthentication =
  | { mode: 'none' }
  | { mode: 'cookie' }
  | { mode: 'bearer'; tokens: AccessTokenProvider };

export type ApiClientOptions = {
  baseUrl: string;
  authentication: ApiAuthentication;
  fetch?: typeof globalThis.fetch;
  defaultTimeoutMs?: number;
};

export type ApiRequestOptions = Omit<
  RequestInit,
  'body' | 'credentials' | 'signal'
> & {
  body?: BodyInit | null;
  json?: unknown;
  query?: Record<string, UrlQueryValue>;
  timeoutMs?: number;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

const parseResponsePayload = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const errorMessage = (status: number, payload: unknown): string => {
  if (payload && typeof payload === 'object') {
    const candidate = payload as { message?: unknown; error?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.error === 'string' && candidate.error.trim()) {
      return candidate.error;
    }
  }

  return `Request failed with status ${status}`;
};

const mergeHeaders = (
  source: HeadersInit | undefined,
  additions: Record<string, string>,
): Headers => {
  const headers = new Headers(source);
  for (const [name, value] of Object.entries(additions)) {
    headers.set(name, value);
  }
  return headers;
};

export const createApiClient = ({
  baseUrl,
  authentication,
  fetch: fetchImplementation = globalThis.fetch,
  defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions) => {
  if (typeof fetchImplementation !== 'function') {
    throw new Error('A fetch implementation is required.');
  }

  let refreshPromise: Promise<string | null> | null = null;

  const refreshBearerToken = async (): Promise<string | null> => {
    if (authentication.mode !== 'bearer') return null;
    if (!refreshPromise) {
      refreshPromise = authentication.tokens.refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  };

  const execute = async (
    url: string,
    options: ApiRequestOptions,
    accessToken: string | null,
  ): Promise<Response> => {
    const {
      body: requestBody,
      json,
      query: _query,
      timeoutMs,
      ...requestInit
    } = options;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs ?? defaultTimeoutMs,
    );
    const headers = mergeHeaders(options.headers, {});

    let body = requestBody;
    if (json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(json);
    }
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    try {
      return await fetchImplementation(url, {
        ...requestInit,
        body,
        credentials: authentication.mode === 'cookie' ? 'include' : 'omit',
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const request = async <T>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> => {
    const url = buildUrl(baseUrl, path, options.query);
    const initialToken =
      authentication.mode === 'bearer'
        ? await authentication.tokens.getAccessToken()
        : null;
    let response = await execute(url, options, initialToken);
    let payload = await parseResponsePayload(response);

    // The users/search/events services use this specific legacy 403 response for
    // missing or expired JWTs. Other 403 responses are actual permission denials.
    const legacyAuthenticationFailure = response.status === 403
      && payload !== null
      && typeof payload === 'object'
      && 'error' in payload
      && payload.error === 'Authentication failed';
    if ((response.status === 401 || legacyAuthenticationFailure) && authentication.mode === 'bearer') {
      const refreshedToken = await refreshBearerToken();
      if (refreshedToken) {
        response = await execute(url, options, refreshedToken);
        payload = await parseResponsePayload(response);
      }
    }

    if (!response.ok) {
      throw new ApiClientError(
        response.status,
        errorMessage(response.status, payload),
        payload,
      );
    }

    return payload as T;
  };

  return {
    request,
    get: <T>(path: string, options: ApiRequestOptions = {}) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, json?: unknown, options: ApiRequestOptions = {}) =>
      request<T>(path, { ...options, method: 'POST', json }),
    put: <T>(path: string, json?: unknown, options: ApiRequestOptions = {}) =>
      request<T>(path, { ...options, method: 'PUT', json }),
    delete: <T>(path: string, options: ApiRequestOptions = {}) =>
      request<T>(path, { ...options, method: 'DELETE' }),
  };
};
