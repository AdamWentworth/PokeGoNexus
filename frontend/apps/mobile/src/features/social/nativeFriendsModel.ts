import type {
  FriendSummary,
  FriendsOverview,
  TrainerAutocompleteEntry,
} from '@pokemongonexus/shared-contracts/users';
import {
  buildNativeTrainerSearchRows,
  type NativeTrainerSearchRow,
} from '../search/trainerSearchModel';

export type NativeFriendRow = NativeTrainerSearchRow & {
  friendshipId: string;
  userId: string;
};

export type NativeFriendsOverviewModel = {
  blocked: NativeFriendRow[];
  friends: NativeFriendRow[];
  incoming: NativeFriendRow[];
  outgoing: NativeFriendRow[];
};

export const EMPTY_NATIVE_FRIENDS_OVERVIEW: NativeFriendsOverviewModel = {
  blocked: [],
  friends: [],
  incoming: [],
  outgoing: [],
};

const buildFriendRow = (entry: FriendSummary): NativeFriendRow => ({
  ...buildNativeTrainerSearchRows([entry])[0],
  friendshipId: entry.friendship_id,
  userId: entry.user_id,
});

const compareRows = (left: NativeTrainerSearchRow, right: NativeTrainerSearchRow): number => (
  (left.pokemonGoName ?? left.username).localeCompare(
    right.pokemonGoName ?? right.username,
    undefined,
    { sensitivity: 'base' },
  )
);

export const buildNativeFriendsOverviewModel = (
  overview: FriendsOverview,
): NativeFriendsOverviewModel => ({
  blocked: overview.blocked.map(buildFriendRow).sort(compareRows),
  friends: overview.friends.map(buildFriendRow).sort(compareRows),
  incoming: overview.incoming.map(buildFriendRow).sort(compareRows),
  outgoing: overview.outgoing.map(buildFriendRow).sort(compareRows),
});

export const filterNativeFriendSearchResults = ({
  entries,
  username,
}: {
  entries: TrainerAutocompleteEntry[];
  username: string;
}): NativeTrainerSearchRow[] => {
  const viewer = username.trim().toLocaleLowerCase();
  return buildNativeTrainerSearchRows(entries)
    .filter((entry) => entry.username.toLocaleLowerCase() !== viewer)
    .sort(compareRows);
};
