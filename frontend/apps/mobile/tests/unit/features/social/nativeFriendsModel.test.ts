import {
  buildNativeFriendsOverviewModel,
  filterNativeFriendSearchResults,
} from '../../../../src/features/social/nativeFriendsModel';

describe('nativeFriendsModel', () => {
  it('normalizes and sorts each authoritative friends group', () => {
    const model = buildNativeFriendsOverviewModel({
      friends: [
        { user_id: '2', username: 'Brock', pokemonGoName: 'Zed', friendship_id: 'f2' },
        { user_id: '1', username: 'Misty', pokemonGoName: 'Amy', friendship_id: 'f1' },
      ],
      incoming: [],
      outgoing: [],
      blocked: [],
    });
    expect(model.friends.map((row) => row.username)).toEqual(['Misty', 'Brock']);
    expect(model.friends[0]).toMatchObject({
      avatarLabel: 'M',
      friendshipId: 'f1',
      pokemonGoName: 'Amy',
      userId: '1',
    });
  });

  it('removes the signed-in trainer from find results without hiding namesakes', () => {
    const rows = filterNativeFriendSearchResults({
      username: 'AdamZilla',
      entries: [
        { username: 'adamzilla', pokemonGoName: 'AdamGo' },
        { username: 'OtherTrainer', pokemonGoName: 'AdamZilla' },
      ],
    });
    expect(rows.map((row) => row.username)).toEqual(['OtherTrainer']);
  });
});
