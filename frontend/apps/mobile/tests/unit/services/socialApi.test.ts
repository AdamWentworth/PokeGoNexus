import { usersContract } from '@pokemongonexus/shared-contracts/users';
import {
  acceptNativeFriendRequest,
  blockNativeTrainer,
  deleteNativeFriendRequest,
  getNativeFriendsOverview,
  getNativeTrainerProfile,
  removeNativeFriend,
  sendNativeFriendRequest,
  unblockNativeTrainer,
} from '../../../src/services/socialApi';

const profile = {
  user: { user_id: 'user-1', username: 'AdamZilla', app_joined_at: '2026-01-01' },
  trainer_titles: [],
  stats: { caught: 1, for_trade: 2, wanted: 3, favorites: 4, registered: 5 },
  highlights: [],
  viewer: { relationship: 'self', can_view_profile: true, can_view_collection: true },
};

describe('getNativeTrainerProfile', () => {
  it('uses the own-profile endpoint when no trainer is supplied', async () => {
    const client = { get: jest.fn().mockResolvedValue(profile) };
    await expect(getNativeTrainerProfile(client)).resolves.toEqual(profile);
    expect(client.get).toHaveBeenCalledWith(usersContract.endpoints.profile);
  });

  it('normalizes a foreign trainer and uses the canonical endpoint', async () => {
    const client = { get: jest.fn().mockResolvedValue(profile) };
    await getNativeTrainerProfile(client, ' AdamZilla ');
    expect(client.get).toHaveBeenCalledWith(usersContract.endpoints.profileByUsername('AdamZilla'));
  });

  it('rejects a malformed profile rather than rendering invented state', async () => {
    const client = { get: jest.fn().mockResolvedValue({ user: { username: 'Broken' } }) };
    await expect(getNativeTrainerProfile(client)).rejects.toThrow('invalid');
  });
});

describe('native profile relationship commands', () => {
  it('uses the authoritative friendship endpoints and payloads', async () => {
    const client = {
      post: jest.fn().mockResolvedValue({ friendship_id: 'friendship-1' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    await expect(sendNativeFriendRequest(client, ' AdamZilla ')).resolves.toBe('friendship-1');
    expect(client.post).toHaveBeenNthCalledWith(1, usersContract.endpoints.friendRequests, {
      username: 'AdamZilla',
    });

    await acceptNativeFriendRequest(client, 'friendship-1');
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      usersContract.endpoints.acceptFriendRequest('friendship-1'),
    );
    await deleteNativeFriendRequest(client, 'friendship-1');
    expect(client.delete).toHaveBeenNthCalledWith(
      1,
      usersContract.endpoints.friendRequest('friendship-1'),
    );
    await removeNativeFriend(client, 'user-2');
    expect(client.delete).toHaveBeenNthCalledWith(2, usersContract.endpoints.friend('user-2'));
    await blockNativeTrainer(client, 'user-2');
    expect(client.post).toHaveBeenNthCalledWith(3, usersContract.endpoints.friendBlocks, {
      user_id: 'user-2',
    });
    await unblockNativeTrainer(client, 'user-2');
    expect(client.delete).toHaveBeenNthCalledWith(
      3,
      usersContract.endpoints.friendBlock('user-2'),
    );
  });

  it('rejects missing identifiers and malformed command responses', async () => {
    const client = { post: jest.fn().mockResolvedValue({}), delete: jest.fn() };
    await expect(sendNativeFriendRequest(client, 'trainer')).rejects.toThrow('invalid');
    await expect(acceptNativeFriendRequest(client, ' ')).rejects.toThrow('required');
    await expect(removeNativeFriend(client, '')).rejects.toThrow('required');
  });
});

describe('getNativeFriendsOverview', () => {
  const friend = {
    user_id: 'user-2',
    username: 'Misty',
    friendship_id: 'friendship-1',
  };

  it('accepts the complete authoritative friends envelope', async () => {
    const overview = {
      friends: [friend],
      incoming: [],
      outgoing: [],
      blocked: [],
    };
    const client = { get: jest.fn().mockResolvedValue(overview) };
    await expect(getNativeFriendsOverview(client)).resolves.toEqual(overview);
    expect(client.get).toHaveBeenCalledWith(usersContract.endpoints.friends);
  });

  it('rejects partial or malformed friends state', async () => {
    await expect(getNativeFriendsOverview({
      get: jest.fn().mockResolvedValue({ friends: [friend] }),
    })).rejects.toThrow('invalid');
    await expect(getNativeFriendsOverview({
      get: jest.fn().mockResolvedValue({ friends: [{}], incoming: [], outgoing: [], blocked: [] }),
    })).rejects.toThrow('invalid');
  });
});
