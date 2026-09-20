import { usersContract } from '@pokemongonexus/shared-contracts/users';
import {
  createNativeCustomTag,
  deleteNativeCustomTag,
  updateNativeCustomTag,
  updateNativePokemonTagOrder,
} from '../../../src/services/nativeTagApi';

describe('nativeTagApi', () => {
  const client = {
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it('uses the shared authenticated users-service contracts for tag CRUD and ordering', async () => {
    const tag = {
      tag_id: 'tag-1', parent: 'caught', name: 'Shadow Shinies', color: '#7C3AED',
      sort: 0, created_at: '2026-08-24T00:00:00Z',
    } as const;
    (client as { post: jest.Mock }).post.mockResolvedValue({ tag });
    (client as { put: jest.Mock }).put
      .mockResolvedValueOnce({ tag: { ...tag, name: 'Shadow favorites' } })
      .mockResolvedValueOnce({ parent: 'caught', tag_keys: ['custom:tag-1'] });
    (client as { delete: jest.Mock }).delete.mockResolvedValue({
      tag_id: 'tag-1', affected_instance_ids: [],
    });

    await expect(createNativeCustomTag(client, {
      parent: 'caught', name: 'Shadow Shinies', color: '#7C3AED',
    })).resolves.toEqual(tag);
    expect((client as { post: jest.Mock }).post).toHaveBeenCalledWith(
      usersContract.endpoints.tags,
      { parent: 'caught', name: 'Shadow Shinies', color: '#7C3AED' },
    );

    await updateNativeCustomTag(client, 'tag-1', { name: 'Shadow favorites' });
    expect((client as { put: jest.Mock }).put).toHaveBeenNthCalledWith(
      1,
      usersContract.endpoints.tag('tag-1'),
      { name: 'Shadow favorites' },
    );

    await updateNativePokemonTagOrder(client, {
      parent: 'caught', tag_keys: ['custom:tag-1'],
    });
    expect((client as { put: jest.Mock }).put).toHaveBeenNthCalledWith(
      2,
      usersContract.endpoints.tagOrder,
      { parent: 'caught', tag_keys: ['custom:tag-1'] },
    );

    await deleteNativeCustomTag(client, 'tag-1');
    expect((client as { delete: jest.Mock }).delete).toHaveBeenCalledWith(
      usersContract.endpoints.tag('tag-1'),
    );
  });
});
