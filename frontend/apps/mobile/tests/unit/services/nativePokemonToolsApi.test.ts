import { getNativeCommunityRankings, getNativeMovesData, getNativePvpData, getNativeToolCatalog } from '../../../src/services/nativePokemonToolsApi';

describe('native Pokémon tools API', () => {
  it('uses versioned public catalog endpoints', async () => {
    const get = jest.fn().mockResolvedValue([]);
    await getNativeToolCatalog({ get } as never);
    await getNativePvpData({ get } as never);
    await getNativeMovesData({ get } as never);
    expect(get).toHaveBeenNthCalledWith(1, '/catalog');
    expect(get).toHaveBeenNthCalledWith(2, '/pvp-data');
    expect(get).toHaveBeenNthCalledWith(3, '/moves');
  });

  it('requests the bounded community rankings snapshot', async () => {
    const get = jest.fn().mockResolvedValue({});
    await getNativeCommunityRankings({ get } as never, 250);
    expect(get).toHaveBeenCalledWith('/rankings', { query: { limit: 250 } });
  });
});
