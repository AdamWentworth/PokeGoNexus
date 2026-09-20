import { createScopedLogger } from '@/utils/logger';
import { usePwaStatusStore } from '@/stores/usePwaStatusStore';
export { buildUrl } from '@shared-contracts/common';

const log = createScopedLogger('httpClient');
const DEFAULT_TIMEOUT_MS = 10000;

export type RequestWithPolicyOptions = Omit<RequestInit, 'signal' | 'credentials'> & {
  credentials?: RequestCredentials;
  timeoutMs?: number;
};

export async function requestWithPolicy(
  input: string | URL,
  options: RequestWithPolicyOptions = {},
): Promise<Response> {
  if (!usePwaStatusStore.getState().isOnline) {
    throw new OfflineError();
  }

  const controller = new AbortController();
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    credentials = 'include',
    ...requestOptions
  } = options;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      credentials,
      ...requestOptions,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      log.warn('request timed out', { input: String(input), timeoutMs });
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export class OfflineError extends Error {
  constructor(message = 'You are offline. Reconnect before using this feature.') {
    super(message);
    this.name = 'OfflineError';
  }
}

export async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type ApiErrorBody = {
  message: string;
  [key: string]: unknown;
};

type ApiErrorResponse = {
  status: number;
  data: ApiErrorBody;
};

export class HttpError extends Error {
  response: ApiErrorResponse;

  constructor(message: string, status: number, data: ApiErrorBody) {
    super(message);
    this.name = 'HttpError';
    this.response = {
      status,
      data,
    };
  }
}

function normalizeErrorBody(status: number, data: unknown): ApiErrorBody {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') {
      return data as ApiErrorBody;
    }
  }

  return {
    message: `Request failed with status ${status}`,
  };
}

export function toHttpError(
  status: number,
  data: unknown,
  fallbackMessage?: string,
): HttpError {
  const normalizedBody = normalizeErrorBody(status, data);
  const message = fallbackMessage || normalizedBody.message;
  return new HttpError(message, status, normalizedBody);
}
