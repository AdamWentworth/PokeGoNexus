import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NativeFriendsScreen,
  type NativeFriendsView,
} from '../../../src/screens/NativeFriendsScreen';
import type { NativeFriendsOverviewModel } from '../../../src/features/social/nativeFriendsModel';

const friend = {
  userId: 'user-misty',
  friendshipId: 'friendship-misty',
  username: 'Misty',
  pokemonGoName: 'CeruleanLeader',
  avatarLabel: 'M',
  team: 'mystic' as const,
  teamLabel: 'Team Mystic',
  trainerLevel: 50,
};

const overview: NativeFriendsOverviewModel = {
  friends: [friend],
  incoming: [{ ...friend, userId: 'user-brock', friendshipId: 'friendship-brock', username: 'Brock', pokemonGoName: 'PewterLeader', avatarLabel: 'B' }],
  outgoing: [{ ...friend, userId: 'user-blue', friendshipId: 'friendship-blue', username: 'Blue', pokemonGoName: null, avatarLabel: 'B' }],
  blocked: [{ ...friend, userId: 'user-rocket', friendshipId: 'friendship-rocket', username: 'Rocket', pokemonGoName: null, avatarLabel: 'R' }],
};

const renderScreen = (
  activeView: NativeFriendsView,
  props: Partial<React.ComponentProps<typeof NativeFriendsScreen>> = {},
) => render(
  <SafeAreaProvider initialMetrics={{
    frame: { x: 0, y: 0, width: 412, height: 915 },
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  }}>
    <NativeFriendsScreen
      activeView={activeView}
      onBack={jest.fn()}
      onCommand={jest.fn()}
      onOpenProfile={jest.fn()}
      onOpenProfileHome={jest.fn()}
      onQueryChange={jest.fn()}
      onRunSearch={jest.fn()}
      onViewChange={jest.fn()}
      overview={overview}
      query=""
      searchResults={[]}
      {...props}
    />
  </SafeAreaProvider>,
);

describe('NativeFriendsScreen', () => {
  it('embeds all Friends tabs below the shared workspace bar without another page header', () => {
    const view = renderScreen('friends', { embedded: true });
    expect(view.queryByText('TRAINER NETWORK')).toBeNull();
    expect(view.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(view.queryByTestId('native-trainer-workspace-nav')).toBeNull();
    expect(view.getByRole('tab', { name: 'Friends view' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Requests view' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Find view' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Blocked view' })).toBeTruthy();
    expect(view.getByText('Your friends')).toBeTruthy();
  });
  beforeEach(() => jest.clearAllMocks());

  it('renders the canonical four views and opens a trainer profile', () => {
    const onBack = jest.fn();
    const onOpenProfile = jest.fn();
    const onViewChange = jest.fn();
    const view = renderScreen('friends', { onBack, onOpenProfile, onViewChange });
    expect(view.getByText('TRAINER NETWORK')).toBeTruthy();
    expect(view.getByRole('header', { name: 'Friends' })).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(view.getByRole('tab', { name: 'Friends view' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Requests view' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Find view' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'Blocked view' })).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: "Open Misty's profile" }));
    expect(onOpenProfile).toHaveBeenCalledWith('Misty');
    fireEvent.press(view.getByRole('tab', { name: 'Requests view' }));
    expect(onViewChange).toHaveBeenCalledWith('requests');
  });

  it('confirms friend removal before issuing the authoritative command', () => {
    const onCommand = jest.fn();
    const view = renderScreen('friends', { onCommand });
    fireEvent.press(view.getByRole('button', { name: 'Remove Misty' }));
    expect(view.getByText('Remove Misty?')).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: 'Remove friend' }));
    expect(onCommand).toHaveBeenCalledWith({ action: 'remove-friend', userId: 'user-misty' });
  });

  it('keeps incoming, outgoing, search, and unblock commands distinct', () => {
    const onCommand = jest.fn();
    const requests = renderScreen('requests', { onCommand });
    fireEvent.press(requests.getByRole('button', { name: 'Accept Brock' }));
    fireEvent.press(requests.getByRole('button', { name: 'Decline Brock' }));
    fireEvent.press(requests.getByRole('button', { name: 'Cancel request to Blue' }));
    expect(onCommand).toHaveBeenCalledWith({ action: 'accept', friendshipId: 'friendship-brock' });
    expect(onCommand).toHaveBeenCalledWith({ action: 'delete-request', friendshipId: 'friendship-brock', message: 'Friend request declined.' });
    expect(onCommand).toHaveBeenCalledWith({ action: 'delete-request', friendshipId: 'friendship-blue', message: 'Friend request canceled.' });
    requests.unmount();

    const blocked = renderScreen('blocked', { onCommand });
    fireEvent.press(blocked.getByRole('button', { name: 'Unblock Rocket' }));
    expect(onCommand).toHaveBeenCalledWith({ action: 'unblock', userId: 'user-rocket' });
  });

  it('searches by either identity and adds the selected trainer', () => {
    const onCommand = jest.fn();
    const onRunSearch = jest.fn();
    const view = renderScreen('find', {
      onCommand,
      onRunSearch,
      query: 'cerulean',
      searchResults: [friend],
    });
    expect(view.getByPlaceholderText('Username or Pokémon GO name')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Search' }));
    fireEvent.press(view.getByRole('button', { name: 'Add Misty' }));
    expect(onRunSearch).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ action: 'add', username: 'Misty' });
  });

  it('keeps loading, error, and feedback states immediate and visible', () => {
    const loading = renderScreen('friends', { isLoading: true });
    expect(loading.getByText('Loading friends')).toBeTruthy();
    loading.unmount();
    const failed = renderScreen('friends', { error: 'Friends service offline.' });
    expect(failed.getByText('Friends service offline.')).toBeTruthy();
    failed.unmount();
    const feedback = renderScreen('friends', { feedback: { tone: 'success', text: 'Friend removed.' } });
    expect(feedback.getByText('Friend removed.')).toBeTruthy();
  });
});
