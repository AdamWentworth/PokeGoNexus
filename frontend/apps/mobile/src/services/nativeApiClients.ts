import {
  createApiClient,
  type AccessTokenProvider,
} from '@pokemongonexus/shared-api-client';
import { runtimeConfig } from '../config/runtimeConfig';

export const createNativeAuthApiClient = (
  tokens: AccessTokenProvider,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => createApiClient({
  baseUrl: runtimeConfig.api.authApiUrl,
  authentication: { mode: 'bearer', tokens },
  fetch: fetchImplementation,
});

export type NativeAuthApiClient = ReturnType<typeof createNativeAuthApiClient>;

export const createNativeUsersApiClient = (
  tokens: AccessTokenProvider,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => createApiClient({
  baseUrl: runtimeConfig.api.usersApiUrl,
  authentication: { mode: 'bearer', tokens },
  fetch: fetchImplementation,
});

export type NativeUsersApiClient = ReturnType<typeof createNativeUsersApiClient>;

export const createNativeReceiverApiClient = (
  tokens: AccessTokenProvider,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => createApiClient({
  baseUrl: runtimeConfig.api.receiverApiUrl,
  authentication: { mode: 'bearer', tokens },
  fetch: fetchImplementation,
});

export type NativeReceiverApiClient = ReturnType<typeof createNativeReceiverApiClient>;

export const createNativePokemonApiClient = (
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => createApiClient({
  baseUrl: runtimeConfig.api.pokemonApiUrl,
  authentication: { mode: 'none' },
  fetch: fetchImplementation,
});

export type NativePokemonApiClient = ReturnType<typeof createNativePokemonApiClient>;

export const createNativeLocationApiClient = (
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => createApiClient({
  baseUrl: runtimeConfig.api.locationApiUrl,
  authentication: { mode: 'none' },
  fetch: fetchImplementation,
});

export type NativeLocationApiClient = ReturnType<typeof createNativeLocationApiClient>;

export const createNativeSearchApiClient = (
  tokens: AccessTokenProvider,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => createApiClient({
  baseUrl: runtimeConfig.api.searchApiUrl,
  authentication: { mode: 'bearer', tokens },
  fetch: fetchImplementation,
  defaultTimeoutMs: 30_000,
});

export type NativeSearchApiClient = ReturnType<typeof createNativeSearchApiClient>;

export const createNativeEventsApiClient = (
  tokens: AccessTokenProvider,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
) => createApiClient({
  baseUrl: runtimeConfig.api.eventsApiUrl,
  authentication: { mode: 'bearer', tokens },
  fetch: fetchImplementation,
  defaultTimeoutMs: 30_000,
});

export type NativeEventsApiClient = ReturnType<typeof createNativeEventsApiClient>;
