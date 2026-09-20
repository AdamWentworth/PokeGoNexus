import { usersContract } from '@pokemongonexus/shared-contracts/users';
import { getCollectionSummary } from '../../../src/services/collectionSummaryApi';

describe('getCollectionSummary', () => {
  it('loads the bounded dashboard aggregate from the users service', async () => {
    const summary = {
      collection_total: 24,
      caught: 20,
      for_trade: 4,
      wanted: 7,
      favorite: 3,
      most_wanted: 2,
    };
    const client = { get: jest.fn().mockResolvedValue(summary) };

    await expect(getCollectionSummary(client)).resolves.toEqual(summary);
    expect(client.get).toHaveBeenCalledWith(usersContract.endpoints.collectionSummary);
  });
});
