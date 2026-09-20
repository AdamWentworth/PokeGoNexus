import type {
  CreateCustomTagRequest,
  CustomTagDefinition,
  CustomTagsEnvelope,
  DeleteCustomTagResponse,
  PokemonTagOrderEnvelope,
  UpdatePokemonTagOrderRequest,
  UpdateCustomTagRequest,
} from '@shared-contracts/users';
import { usersContract } from '@shared-contracts/users';

import {
  buildUrl,
  parseJsonSafe,
  requestWithPolicy,
  toHttpError,
} from './httpClient';

const USERS_API_URL = import.meta.env.VITE_USERS_API_URL;

async function tagRequest<T>(
  endpoint: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await requestWithPolicy(buildUrl(USERS_API_URL, endpoint), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const data = await parseJsonSafe<T>(response);
  if (!response.ok || !data) throw toHttpError(response.status, data);
  return data;
}

export async function fetchCustomTags(): Promise<CustomTagsEnvelope> {
  return tagRequest<CustomTagsEnvelope>(usersContract.endpoints.tags);
}

export async function createCustomTag(
  request: CreateCustomTagRequest,
): Promise<CustomTagDefinition> {
  const response = await tagRequest<{ tag: CustomTagDefinition }>(usersContract.endpoints.tags, {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.tag;
}

export async function updateCustomTag(
  tagId: string,
  request: UpdateCustomTagRequest,
): Promise<CustomTagDefinition> {
  const response = await tagRequest<{ tag: CustomTagDefinition }>(usersContract.endpoints.tag(tagId), {
    method: 'PUT',
    body: JSON.stringify(request),
  });
  return response.tag;
}

export async function deleteCustomTag(tagId: string): Promise<DeleteCustomTagResponse> {
  return tagRequest<DeleteCustomTagResponse>(usersContract.endpoints.tag(tagId), {
    method: 'DELETE',
  });
}

export async function updatePokemonTagOrder(
  request: UpdatePokemonTagOrderRequest,
): Promise<PokemonTagOrderEnvelope> {
  return tagRequest<PokemonTagOrderEnvelope>(usersContract.endpoints.tagOrder, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}
