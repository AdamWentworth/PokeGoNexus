import type { Instances } from '@/types/instances';
import { buildUrl, requestWithPolicy, parseJsonSafe } from '@/services/httpClient';
import type {
  ErrorEnvelope,
  ForeignInstancesFetchOutcome,
  TrainerAutocompleteOutcome,
  TrainerAutocompleteEntry,
  UserInstancesEnvelope,
} from '@shared-contracts/users';
import { usersContract } from '@shared-contracts/users';
export type {
  ForeignInstancesFetchOutcome,
  TrainerAutocompleteOutcome,
} from '@shared-contracts/users';

const USERS_API_URL = import.meta.env.VITE_USERS_API_URL;

export type TrainerAutocompleteResult = TrainerAutocompleteEntry;

type PublicUserSnapshotEnvelope = {
  user?: {
    user_id?: string;
    username?: string;
  };
};

export type PublicUserLookupOutcome =
  | { type: 'success'; username: string; userId: string | null }
  | { type: 'notFound' }
  | { type: 'error'; status: number; message: string };

const buildConditionalHeaders = (etag?: string | null): Record<string, string> =>
  etag ? { 'If-None-Match': etag } : {};

export async function fetchForeignInstancesByUsername(
  username: string,
  etag?: string | null,
): Promise<ForeignInstancesFetchOutcome<Instances>> {
  const headers = buildConditionalHeaders(etag);

  let response = await requestWithPolicy(buildUrlForUsersEndpoint(usersContract.endpoints.instancesByUsername(username)), {
    headers,
  });

  if (response.status === 403 || response.status === 404) {
    const publicResponse = await requestWithPolicy(
      buildUrlForUsersEndpoint(usersContract.endpoints.publicUserByUsername(username)),
      { headers },
    );

    if (publicResponse.ok || publicResponse.status === 304 || publicResponse.status === 404) {
      response = publicResponse;
    }
  }

  if (response.status === 304) return { type: 'notModified' };
  if (response.status === 404) return { type: 'notFound' };
  if (response.status === 403) return { type: 'forbidden' };
  if (!response.ok) {
    return { type: 'error', status: response.status, statusText: response.statusText };
  }

  const body = await parseJsonSafe<UserInstancesEnvelope<Instances>>(response);
  if (!body) {
    return { type: 'error', status: 502, statusText: 'Invalid JSON response' };
  }

  const resolvedUsername = body.username ?? body.user?.username ?? username;
  const instances = body.instances ?? {};

  return {
    type: 'success',
    username: resolvedUsername,
    instances,
    etag: response.headers.get('ETag') ?? null,
  };
}

const buildUrlForUsersEndpoint = (pathWithQuery: string): string =>
  buildUrl(USERS_API_URL, pathWithQuery);

export async function fetchTrainerAutocomplete(query: string): Promise<TrainerAutocompleteOutcome> {
  const response = await requestWithPolicy(buildUrlForUsersEndpoint(usersContract.endpoints.autocompleteTrainers(query)));

  if (!response.ok) {
    const body = await parseJsonSafe<ErrorEnvelope>(response);
    return {
      type: 'error',
      status: response.status,
      message: body?.message ?? `Server returned ${response.status}`,
    };
  }

  const body = await parseJsonSafe<TrainerAutocompleteEntry[]>(response);
  if (!Array.isArray(body)) {
    return {
      type: 'error',
      message: "Looks like this trainer hasn't signed up for Pokémon Go Nexus yet.",
    };
  }

  return { type: 'success', results: body };
}

export async function fetchPublicUserByUsername(
  username: string,
): Promise<PublicUserLookupOutcome> {
  const response = await requestWithPolicy(
    buildUrlForUsersEndpoint(usersContract.endpoints.publicUserByUsername(username)),
  );

  if (response.status === 404) {
    return { type: 'notFound' };
  }

  const body = await parseJsonSafe<PublicUserSnapshotEnvelope & ErrorEnvelope>(response);

  if (!response.ok) {
    return {
      type: 'error',
      status: response.status,
      message: body?.message ?? `Server returned ${response.status}`,
    };
  }

  const resolvedUsername = body?.user?.username ?? username;
  const resolvedUserId = body?.user?.user_id ?? null;

  return {
    type: 'success',
    username: resolvedUsername,
    userId: resolvedUserId,
  };
}
