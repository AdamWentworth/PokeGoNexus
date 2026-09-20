import {
  usersContract,
  type CollectionSummary,
} from '@pokemongonexus/shared-contracts/users';
import type { NativeUsersApiClient } from './nativeApiClients';

export const getCollectionSummary = (
  client: Pick<NativeUsersApiClient, 'get'>,
): Promise<CollectionSummary> =>
  client.get<CollectionSummary>(usersContract.endpoints.collectionSummary);
