import type {
  CreateCustomTagRequest,
  CustomTagDefinition,
  DeleteCustomTagResponse,
  PokemonTagOrderEnvelope,
  UpdateCustomTagRequest,
  UpdatePokemonTagOrderRequest,
} from '@pokemongonexus/shared-contracts/users';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import type { NativeUsersApiClient } from './nativeApiClients';

export const createNativeCustomTag = async (
  client: NativeUsersApiClient,
  request: CreateCustomTagRequest,
): Promise<CustomTagDefinition> => {
  const response = await client.post<{ tag: CustomTagDefinition }>(
    usersContract.endpoints.tags,
    request,
  );
  return response.tag;
};

export const updateNativeCustomTag = async (
  client: NativeUsersApiClient,
  tagId: string,
  request: UpdateCustomTagRequest,
): Promise<CustomTagDefinition> => {
  const response = await client.put<{ tag: CustomTagDefinition }>(
    usersContract.endpoints.tag(tagId),
    request,
  );
  return response.tag;
};

export const deleteNativeCustomTag = (
  client: NativeUsersApiClient,
  tagId: string,
): Promise<DeleteCustomTagResponse> => client.delete(
  usersContract.endpoints.tag(tagId),
);

export const updateNativePokemonTagOrder = (
  client: NativeUsersApiClient,
  request: UpdatePokemonTagOrderRequest,
): Promise<PokemonTagOrderEnvelope> => client.put(
  usersContract.endpoints.tagOrder,
  request,
);
