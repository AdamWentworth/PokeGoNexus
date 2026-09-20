import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativeTrainerWorkspaceRoute } from '../../../../src/features/social/NativeTrainerWorkspaceRoute';
import NativeFriendsRoute from '../../../../src/app/native/friends';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true), setParams: jest.fn() };
let mockParams: Record<string, string> = {};
let mockSignedIn = true;
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
  Redirect: ({ href }: { href: unknown }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="redirect">{JSON.stringify(href)}</Text>;
  },
}));
jest.mock('../../../../src/auth/NativeSessionContext', () => ({
  useNativeSession: () => ({ status: mockSignedIn ? 'signed-in' : 'signed-out', user: mockSignedIn ? { user_id: 'trainer-id', username: 'Trainer' } : null }),
}));
jest.mock('../../../../src/features/social/NativeTrainerProfileRoute', () => ({
  NativeTrainerProfileRoute: () => { const { Text } = jest.requireActual('react-native'); return <Text>Profile contents</Text>; },
}));
jest.mock('../../../../src/features/social/NativeFriendsPanel', () => ({
  NativeFriendsPanel: () => { const { Text } = jest.requireActual('react-native'); return <Text>Friends contents</Text>; },
}));
jest.mock('../../../../src/components/NativeActionMenuAnchor', () => ({ NativeActionMenuAnchor: () => null }));
jest.mock('../../../../src/components/NativeActionMenu', () => ({ NativeActionMenu: () => null }));

const Workspace = () => <SafeAreaProvider initialMetrics={{
  frame: { x: 0, y: 0, width: 412, height: 915 },
  insets: { top: 24, right: 0, bottom: 20, left: 0 },
}}><NativeTrainerWorkspaceRoute /></SafeAreaProvider>;

describe('NativeTrainerWorkspaceRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockSignedIn = true;
  });
  afterEach(() => jest.restoreAllMocks());

  it('changes panel parameters without pushing or replacing any native screen', async () => {
    const view = render(<Workspace />);
    await act(async () => Promise.resolve());
    fireEvent.press(view.getByRole('tab', { name: 'Friends' }));
    expect(mockRouter.setParams).toHaveBeenLastCalledWith({ workspace: 'friends' });
    mockParams = { workspace: 'friends' };
    view.rerender(<Workspace />);
    expect(view.getByText('Friends contents')).toBeTruthy();
    expect(view.queryByText('Profile contents')).toBeNull();
    fireEvent.press(view.getByRole('tab', { name: 'Profile' }));
    expect(mockRouter.setParams).toHaveBeenLastCalledWith({ workspace: 'profile' });
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('handles hardware and header Back inside Friends, then leaves from Profile', async () => {
    const subscribe = jest.spyOn(BackHandler, 'addEventListener');
    mockParams = { workspace: 'friends' };
    const view = render(<Workspace />);
    await act(async () => Promise.resolve());
    const hardwareBack = subscribe.mock.calls.at(-1)![1];
    expect(hardwareBack({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);
    expect(mockRouter.setParams).toHaveBeenLastCalledWith({ workspace: 'profile' });
    fireEvent.press(view.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).not.toHaveBeenCalled();
    mockParams = { workspace: 'profile' };
    view.rerender(<Workspace />);
    expect(subscribe.mock.calls.at(-1)![1]({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(false);
    fireEvent.press(view.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('keeps Friends notification sub-tabs when entering the canonical workspace', () => {
    mockParams = { tab: 'requests' };
    const view = render(<NativeFriendsRoute />);
    expect(JSON.parse(view.getByTestId('redirect').props.children)).toEqual({
      pathname: '/native/profile', params: { workspace: 'friends', tab: 'requests' },
    });
  });

  it('preserves the intended Friends panel and sub-tab through sign-in', () => {
    mockSignedIn = false;
    mockParams = { workspace: 'friends', tab: 'requests' };
    const view = render(<Workspace />);
    expect(JSON.parse(view.getByTestId('redirect').props.children)).toEqual({
      pathname: '/native/login', params: { returnTo: '/native/profile?workspace=friends&tab=requests' },
    });
  });
});
